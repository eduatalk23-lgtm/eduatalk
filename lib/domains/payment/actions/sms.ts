"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/services/smsService";
import { getOverdueMessage } from "../sms/templates";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** 개별 결제 독촉 SMS 발송 */
export async function sendPaymentReminderAction(
  paymentId: string
): Promise<ActionResult> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 결제 정보 조회
    const { data: payment } = await adminClient
      .from("payment_records")
      .select(
        "id, student_id, amount, paid_amount, due_date, status, tenant_id"
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment || payment.tenant_id !== tenantId) {
      return { success: false, error: "결제 정보를 찾을 수 없습니다." };
    }

    if (payment.status !== "unpaid" && payment.status !== "partial") {
      return { success: false, error: "미납 상태가 아닙니다." };
    }

    // 학생 이름 조회
    const { data: student } = await adminClient
      .from("students")
      .select("name")
      .eq("id", payment.student_id)
      .maybeSingle();

    // 학생 연락처 조회
    const { data: profile } = await adminClient
      .from("student_profiles")
      .select("phone, mother_phone, father_phone")
      .eq("id", payment.student_id)
      .maybeSingle();

    const phone =
      profile?.phone || profile?.mother_phone || profile?.father_phone;
    if (!phone) {
      return { success: false, error: "학생의 연락처를 찾을 수 없습니다." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = payment.due_date
      ? new Date(payment.due_date + "T00:00:00")
      : today;
    const daysPastDue = Math.max(
      0,
      Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    const message = getOverdueMessage({
      studentName: student?.name ?? "학생",
      amount: payment.amount - payment.paid_amount,
      daysPastDue,
    });

    const smsResult = await sendSMS({
      recipientPhone: phone,
      message,
      recipientId: payment.student_id,
      tenantId,
    });

    if (!smsResult.success) {
      return { success: false, error: smsResult.error ?? "SMS 발송에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "SMS 발송 중 오류가 발생했습니다.",
    };
  }
}
