/**
 * 게스트 결제 승인 API
 * POST /api/payments/toss/confirm-guest
 *
 * 인증 없이 토큰으로 검증하여 결제를 승인한다.
 */

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";
import { confirmTossPayment, mapTossErrorToMessage } from "@/lib/services/tossPayments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentStatus } from "@/lib/domains/payment/types";
import type { PaymentLinkStatus, DeliveryMethod } from "@/lib/domains/payment/paymentLink/types";
import { sendPaymentReceiptNotification } from "@/lib/domains/payment/paymentLink/delivery";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, paymentKey, orderId, amount } = body as {
      token?: string;
      paymentKey?: string;
      orderId?: string;
      amount?: number;
    };

    if (!token || !paymentKey || !orderId || amount == null) {
      return apiBadRequest("token, paymentKey, orderId, amount는 필수입니다.");
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return apiBadRequest("서버 오류: DB 클라이언트 초기화 실패");
    }

    // 1. 토큰으로 결제 링크 조회
    const { data: link, error: linkError } = await adminClient
      .from("payment_links")
      .select("id, payment_record_id, amount, status, expires_at, tenant_id, academy_name, student_name, program_name, recipient_phone, delivery_method")
      .eq("token", token)
      .maybeSingle();

    if (linkError || !link) {
      return apiBadRequest("유효하지 않은 결제 링크입니다.");
    }

    // 2. 링크 상태 검증
    if (link.status !== "active") {
      return apiBadRequest("이 결제 링크는 더 이상 유효하지 않습니다.");
    }

    if (new Date(link.expires_at) <= new Date()) {
      await adminClient
        .from("payment_links")
        .update({ status: "expired" as PaymentLinkStatus })
        .eq("id", link.id);
      return apiBadRequest("만료된 결제 링크입니다.");
    }

    // 3. 금액 검증 (링크 생성 시점 금액과 일치해야 함)
    if (amount !== link.amount) {
      return apiBadRequest("결제 금액이 일치하지 않습니다.", {
        expected: link.amount,
        received: amount,
      });
    }

    // 4. payment_record 조회 및 상태 확인
    const { data: record, error: recordError } = await adminClient
      .from("payment_records")
      .select("id, amount, paid_amount, status, toss_order_id")
      .eq("id", link.payment_record_id)
      .maybeSingle();

    if (recordError || !record) {
      return apiBadRequest("결제 레코드를 찾을 수 없습니다.");
    }

    if (record.status === "paid") {
      return apiBadRequest("이미 결제가 완료된 건입니다.");
    }

    // orderId 일치 확인
    if (record.toss_order_id && record.toss_order_id !== orderId) {
      return apiBadRequest("주문 정보가 일치하지 않습니다.");
    }

    // 5. 토스 API 결제 승인
    let tossResponse;
    try {
      tossResponse = await confirmTossPayment({ paymentKey, orderId, amount });
    } catch (tossError) {
      const err = tossError as Error & { code?: string };
      const message = err.code
        ? mapTossErrorToMessage(err.code)
        : err.message;
      return apiBadRequest(message);
    }

    // 6. payment_records DB 업데이트
    const existingPaid = record.paid_amount ?? 0;
    const newPaidAmount = existingPaid + amount;
    const paidStatus: PaymentStatus =
      newPaidAmount >= record.amount ? "paid" : "partial";

    const { error: updateError } = await adminClient
      .from("payment_records")
      .update({
        status: paidStatus,
        paid_amount: newPaidAmount,
        paid_date: new Date().toISOString().split("T")[0],
        payment_method: "card",
        toss_payment_key: tossResponse.paymentKey,
        toss_method: tossResponse.method ?? null,
        toss_receipt_url: tossResponse.receipt?.url ?? null,
        toss_raw_response: JSON.parse(JSON.stringify(tossResponse)),
        toss_requested_at: tossResponse.requestedAt ?? null,
        toss_approved_at: tossResponse.approvedAt ?? null,
      })
      .eq("id", record.id);

    if (updateError) {
      console.error(
        "[api/payments/toss/confirm-guest] DB 업데이트 실패:",
        updateError
      );
      return apiBadRequest(
        "결제는 승인되었으나 DB 업데이트에 실패했습니다. 관리자에게 문의하세요."
      );
    }

    // 7. payment_links 상태 업데이트
    await adminClient
      .from("payment_links")
      .update({
        status: "completed" as PaymentLinkStatus,
        paid_at: new Date().toISOString(),
        toss_payment_key: tossResponse.paymentKey,
      })
      .eq("id", link.id);

    // 8. 결제 완료 영수증 알림 (비동기, 실패해도 결제 응답에 영향 없음)
    if (link.recipient_phone && link.delivery_method && link.delivery_method !== "manual") {
      sendPaymentReceiptNotification({
        recipientPhone: link.recipient_phone,
        academyName: link.academy_name,
        studentName: link.student_name,
        programName: link.program_name,
        amount,
        tenantId: link.tenant_id,
        receiptUrl: tossResponse.receipt?.url ?? null,
        deliveryMethod: link.delivery_method as DeliveryMethod,
      }).catch((err) => {
        console.error("[confirm-guest] 영수증 알림 발송 실패:", err);
      });
    }

    revalidatePath("/admin/students");
    revalidatePath("/parent/payments");

    return apiSuccess({
      paymentKey: tossResponse.paymentKey,
      orderId: tossResponse.orderId,
      status: paidStatus,
      method: tossResponse.method,
      receiptUrl: tossResponse.receipt?.url ?? null,
    });
  } catch (error) {
    return handleApiError(error, "[api/payments/toss/confirm-guest]");
  }
}
