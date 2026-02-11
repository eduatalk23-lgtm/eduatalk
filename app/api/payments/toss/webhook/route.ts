/**
 * 토스페이먼츠 웹훅 API
 * POST /api/payments/toss/webhook
 *
 * 토스에서 결제 상태 변경 이벤트를 수신한다 (가상계좌 입금 등).
 * 보안: orderId 접두사 검증 + 토스 API 결제 상태 직접 확인 후 DB 업데이트.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPaymentByOrderId } from "@/lib/services/tossPayments";
import type { PaymentStatus } from "@/lib/domains/payment/types";

/** 우리 시스템의 orderId 접두사 (다른 사이트 주문 필터링용) */
const ORDER_ID_PREFIX = "TLU-";

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

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 가상계좌 입금 완료 등의 이벤트 처리
    if (status === "DONE") {
      // DB에서 결제 레코드 확인 (존재 여부 + 현재 상태)
      const { data: record } = await adminClient
        .from("payment_records")
        .select("id, amount, status")
        .eq("toss_order_id", orderId)
        .eq("status", "unpaid")
        .maybeSingle();

      if (!record) {
        // 이미 처리됐거나 우리 레코드가 아님
        return NextResponse.json({ success: true }, { status: 200 });
      }

      // 토스 API로 실제 결제 상태 직접 검증 (스푸핑 방지)
      let tossPayment;
      try {
        tossPayment = await getPaymentByOrderId(orderId);
      } catch {
        console.error(
          "[webhook] 토스 API 결제 조회 실패:",
          orderId
        );
        return NextResponse.json({ success: true }, { status: 200 });
      }

      // 토스 API 응답의 상태가 실제로 DONE인지 확인
      if (tossPayment.status !== "DONE") {
        console.warn(
          "[webhook] 토스 API 상태 불일치:",
          { webhookStatus: status, tossApiStatus: tossPayment.status, orderId }
        );
        return NextResponse.json({ success: true }, { status: 200 });
      }

      // 금액 검증
      if (tossPayment.totalAmount !== record.amount) {
        console.error(
          "[webhook] 금액 불일치:",
          { expected: record.amount, received: tossPayment.totalAmount, orderId }
        );
        return NextResponse.json({ success: true }, { status: 200 });
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
        .eq("status", "unpaid"); // optimistic lock: 이미 처리된 건 방지
    }
  } catch (error) {
    console.error("[api/payments/toss/webhook] 웹훅 처리 오류:", error);
  }

  // 항상 200 반환
  return NextResponse.json({ success: true }, { status: 200 });
}
