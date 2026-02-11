"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  issueCashReceipt,
  cancelCashReceipt,
  type CashReceiptType,
} from "@/lib/services/tossPayments";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 현금영수증 발급 (오프라인 현금/이체 결제 건 대상)
 */
export async function issueCashReceiptAction(
  paymentId: string,
  customerIdentityNumber: string,
  type: CashReceiptType
): Promise<ActionResult<{ receiptUrl: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 결제 조회
    const { data: payment, error: fetchError } = await adminClient
      .from("payment_records")
      .select("id, amount, paid_amount, status, payment_method, enrollment_id, tenant_id, cash_receipt_key")
      .eq("id", paymentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (fetchError || !payment) {
      return { success: false, error: "결제 정보를 찾을 수 없습니다." };
    }

    // 검증: paid 상태만 가능
    if (payment.status !== "paid") {
      return { success: false, error: "완납된 결제에 대해서만 현금영수증을 발급할 수 있습니다." };
    }

    // 검증: 현금 또는 이체 결제만 가능
    if (payment.payment_method !== "cash" && payment.payment_method !== "transfer") {
      return { success: false, error: "현금 또는 이체 결제에 대해서만 현금영수증을 발급할 수 있습니다." };
    }

    // 중복 발급 방지
    if (payment.cash_receipt_key) {
      return { success: false, error: "이미 현금영수증이 발급된 결제입니다." };
    }

    // 주문 정보 조회 (orderName에 프로그램명 사용)
    const { data: enrollment } = await adminClient
      .from("enrollments")
      .select("programs(name)")
      .eq("id", payment.enrollment_id)
      .maybeSingle();

    const programName =
      enrollment?.programs &&
      typeof enrollment.programs === "object" &&
      !Array.isArray(enrollment.programs)
        ? (enrollment.programs as { name: string }).name
        : "수강료";

    const orderId = `CR-${paymentId.slice(0, 8)}-${Date.now()}`;

    // 토스 API 호출
    const receipt = await issueCashReceipt({
      amount: payment.paid_amount ?? payment.amount,
      orderId,
      orderName: `${programName} 수강료`,
      customerIdentityNumber,
      type,
    });

    // DB 업데이트
    await adminClient
      .from("payment_records")
      .update({
        cash_receipt_url: receipt.receiptUrl,
        cash_receipt_key: receipt.receiptKey,
        cash_receipt_type: type,
      })
      .eq("id", paymentId);

    revalidatePath("/admin/students");

    return { success: true, data: { receiptUrl: receipt.receiptUrl } };
  } catch (error) {
    logActionError(
      { domain: "payment", action: "issueCashReceipt" },
      error,
      { paymentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "현금영수증 발급 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 현금영수증 취소
 */
export async function cancelCashReceiptAction(
  paymentId: string
): Promise<ActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data: payment } = await adminClient
      .from("payment_records")
      .select("id, tenant_id, cash_receipt_key")
      .eq("id", paymentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!payment) {
      return { success: false, error: "결제 정보를 찾을 수 없습니다." };
    }

    const receiptKey = payment.cash_receipt_key;

    if (!receiptKey) {
      return { success: false, error: "현금영수증 정보가 없습니다." };
    }

    // 토스 API 취소
    await cancelCashReceipt(receiptKey);

    // DB 초기화
    await adminClient
      .from("payment_records")
      .update({
        cash_receipt_url: null,
        cash_receipt_key: null,
        cash_receipt_type: null,
      })
      .eq("id", paymentId);

    revalidatePath("/admin/students");

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "payment", action: "cancelCashReceipt" },
      error,
      { paymentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "현금영수증 취소 중 오류가 발생했습니다.",
    };
  }
}
