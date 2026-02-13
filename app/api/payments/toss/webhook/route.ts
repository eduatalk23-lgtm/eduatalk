/**
 * 토스페이먼츠 웹훅 API
 * POST /api/payments/toss/webhook
 *
 * 토스에서 결제 상태 변경 이벤트를 수신한다.
 * - DONE: 가상계좌 입금 완료
 * - CANCELED: 전액 환불 (토스 대시보드 등에서 직접 환불 시 동기화)
 * - PARTIAL_CANCELED: 부분 환불
 *
 * 보안: orderId 접두사 검증 + 토스 API 결제 상태 직접 확인 후 DB 업데이트.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaymentByOrderId } from "@/lib/services/tossPayments";
import type { TossPaymentResponse } from "@/lib/services/tossPayments";
import type { PaymentStatus } from "@/lib/domains/payment/types";

/** 우리 시스템의 orderId 접두사 (다른 사이트 주문 필터링용) */
const ORDER_ID_PREFIX = "TLU-";

/** 토스 결제 상태 중 처리 대상 */
const HANDLED_STATUSES = ["DONE", "CANCELED", "PARTIAL_CANCELED"] as const;

export async function POST(request: NextRequest) {
  // 토스 웹훅은 항상 200을 즉시 반환해야 함
  try {
    const body = await request.json();
    const { orderId, status } = body as {
      orderId?: string;
      status?: string;
    };

    // orderId 없으면 무시
    if (!orderId) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 우리 시스템의 주문만 처리 (다른 사이트 웹훅 무시)
    if (!orderId.startsWith(ORDER_ID_PREFIX)) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 처리 대상 상태가 아니면 무시
    if (!status || !HANDLED_STATUSES.includes(status as typeof HANDLED_STATUSES[number])) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 토스 API로 실제 결제 상태 직접 검증 (스푸핑 방지)
    let tossPayment: TossPaymentResponse;
    try {
      tossPayment = await getPaymentByOrderId(orderId);
    } catch {
      console.error("[webhook] 토스 API 결제 조회 실패:", orderId);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 토스 API 응답 상태와 웹훅 상태 일치 확인
    if (tossPayment.status !== status) {
      console.warn("[webhook] 토스 API 상태 불일치:", {
        webhookStatus: status,
        tossApiStatus: tossPayment.status,
        orderId,
      });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 가상계좌 입금 완료
    if (status === "DONE") {
      await handlePaymentDone(adminClient, orderId, tossPayment);
    }

    // 전액 또는 부분 환불 (토스 대시보드에서 직접 환불한 경우 동기화)
    if (status === "CANCELED" || status === "PARTIAL_CANCELED") {
      await handlePaymentCanceled(adminClient, orderId, tossPayment);
    }

    revalidatePath("/admin/students");
    revalidatePath("/parent/payments");
  } catch (error) {
    console.error("[api/payments/toss/webhook] 웹훅 처리 오류:", error);
  }

  // 항상 200 반환
  return NextResponse.json({ success: true }, { status: 200 });
}

/**
 * 결제 완료 처리 (가상계좌 입금 등)
 */
async function handlePaymentDone(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  orderId: string,
  tossPayment: TossPaymentResponse
) {
  const { data: record } = await adminClient
    .from("payment_records")
    .select("id, amount, status")
    .eq("toss_order_id", orderId)
    .eq("status", "unpaid")
    .maybeSingle();

  if (!record) return;

  // 금액 검증
  if (tossPayment.totalAmount !== record.amount) {
    console.error("[webhook] 금액 불일치:", {
      expected: record.amount,
      received: tossPayment.totalAmount,
      orderId,
    });
    return;
  }

  const paidStatus: PaymentStatus =
    tossPayment.totalAmount >= record.amount ? "paid" : "partial";

  await adminClient
    .from("payment_records")
    .update({
      status: paidStatus,
      paid_amount: tossPayment.totalAmount,
      paid_date: new Date().toISOString().split("T")[0],
      payment_method: "card",
      toss_payment_key: tossPayment.paymentKey,
      toss_method: tossPayment.method ?? null,
      toss_receipt_url: tossPayment.receipt?.url ?? null,
      toss_raw_response: JSON.parse(JSON.stringify(tossPayment)),
      toss_requested_at: tossPayment.requestedAt ?? null,
      toss_approved_at: tossPayment.approvedAt ?? null,
    })
    .eq("id", record.id)
    .eq("status", "unpaid"); // optimistic lock
}

/**
 * 환불 동기화 처리 (토스 대시보드에서 환불 시)
 * CANCELED → 전액 환불, PARTIAL_CANCELED → 부분 환불
 */
async function handlePaymentCanceled(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  orderId: string,
  tossPayment: TossPaymentResponse
) {
  // paid 또는 partial 상태인 결제만 대상
  const { data: record } = await adminClient
    .from("payment_records")
    .select("id, amount, paid_amount, status, toss_payment_key")
    .eq("toss_order_id", orderId)
    .in("status", ["paid", "partial"])
    .maybeSingle();

  if (!record) return;

  // 토스 API의 balanceAmount로 잔액 판단
  const remainingAmount = tossPayment.balanceAmount ?? 0;
  const isFullRefund = remainingAmount <= 0;

  // 취소 사유 추출 (가장 최근 취소 건)
  const latestCancel = tossPayment.cancels?.[tossPayment.cancels.length - 1];
  const cancelReason = latestCancel?.cancelReason ?? "토스 대시보드 환불";
  const cancelAmount = latestCancel?.cancelAmount ?? record.paid_amount;

  const newStatus: PaymentStatus = isFullRefund ? "refunded" : "partial";

  await adminClient
    .from("payment_records")
    .update({
      status: newStatus,
      paid_amount: isFullRefund ? 0 : remainingAmount,
      memo: `[웹훅 동기화] 환불: ${cancelReason} (${cancelAmount.toLocaleString()}원)`,
      toss_raw_response: JSON.parse(JSON.stringify(tossPayment)),
    })
    .eq("id", record.id)
    .in("status", ["paid", "partial"]); // optimistic lock
}
