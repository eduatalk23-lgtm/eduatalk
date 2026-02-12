"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  PaymentStatus,
  PaymentMethod,
  DiscountType,
  PaymentRecordWithEnrollment,
  CreatePaymentInput,
  ConfirmPaymentInput,
} from "../types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** 학생의 전체 수납 기록 조회 */
export async function getStudentPaymentsAction(
  studentId: string
): Promise<ActionResult<PaymentRecordWithEnrollment[]>> {
  try {
    await requireAdminOrConsultant();

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data, error } = await adminClient
      .from("payment_records")
      .select("*, enrollments(program_id, programs(name, code))")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const payments: PaymentRecordWithEnrollment[] = (data ?? []).map((row) => {
      const r = row as typeof row & {
        original_amount?: number | null;
        discount_type?: string | null;
        discount_value?: number | null;
      };
      const enrollment = r.enrollments as {
        program_id: string;
        programs: { name: string; code: string } | null;
      } | null;
      return {
        id: r.id,
        tenant_id: r.tenant_id,
        enrollment_id: r.enrollment_id,
        student_id: r.student_id,
        amount: r.amount,
        paid_amount: r.paid_amount,
        status: r.status as PaymentStatus,
        payment_method: r.payment_method as PaymentMethod | null,
        due_date: r.due_date,
        paid_date: r.paid_date,
        billing_period: r.billing_period,
        memo: r.memo,
        created_by: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        toss_order_id: r.toss_order_id ?? null,
        toss_payment_key: r.toss_payment_key ?? null,
        toss_method: r.toss_method ?? null,
        toss_receipt_url: r.toss_receipt_url ?? null,
        toss_approved_at: r.toss_approved_at ?? null,
        cash_receipt_url: r.cash_receipt_url ?? null,
        cash_receipt_key: r.cash_receipt_key ?? null,
        cash_receipt_type: r.cash_receipt_type as "소득공제" | "지출증빙" | null ?? null,
        payment_order_id: r.payment_order_id ?? null,
        original_amount: r.original_amount ?? null,
        discount_type: (r.discount_type as DiscountType | null) ?? null,
        discount_value: r.discount_value != null ? Number(r.discount_value) : null,
        program_name: enrollment?.programs?.name ?? "",
        program_code: enrollment?.programs?.code ?? "",
      };
    });

    return { success: true, data: payments };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "수납 목록 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 수납 기록 생성 (수강에 대한 납부 건 추가) */
export async function createPaymentAction(
  input: CreatePaymentInput
): Promise<ActionResult<{ id: string }>> {
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

    // enrollment 테넌트 소유권 검증
    const { data: enrollment } = await adminClient
      .from("enrollments")
      .select("tenant_id")
      .eq("id", input.enrollment_id)
      .maybeSingle();

    if (!enrollment || enrollment.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    // 할인 계산
    let finalAmount = input.amount;
    let originalAmount: number | null = null;
    let discountType: string | null = null;
    let discountValue: number | null = null;

    if (input.discount_type && input.discount_value != null && input.discount_value > 0) {
      if (input.discount_type === "rate" && input.discount_value > 100) {
        return { success: false, error: "할인율은 100% 이하여야 합니다." };
      }
      if (input.discount_type === "fixed" && input.discount_value >= input.amount) {
        return { success: false, error: "할인 금액은 원가보다 작아야 합니다." };
      }

      originalAmount = input.amount;
      discountType = input.discount_type;
      discountValue = input.discount_value;

      if (input.discount_type === "fixed") {
        finalAmount = input.amount - input.discount_value;
      } else {
        finalAmount = Math.round(input.amount * (1 - input.discount_value / 100));
      }

      if (finalAmount <= 0) {
        return { success: false, error: "할인 후 금액은 0원보다 커야 합니다." };
      }
    }

    const { data, error } = await adminClient
      .from("payment_records")
      .insert({
        tenant_id: tenantId,
        enrollment_id: input.enrollment_id,
        student_id: input.student_id,
        amount: finalAmount,
        original_amount: originalAmount,
        discount_type: discountType,
        discount_value: discountValue,
        due_date: input.due_date ?? null,
        billing_period: input.billing_period ?? null,
        memo: input.memo ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      logActionError(
        { domain: "payment", action: "create", tenantId, userId },
        error,
        { enrollmentId: input.enrollment_id, studentId: input.student_id }
      );
      return { success: false, error: "수납 기록 생성에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    return { success: true, data: { id: data.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "수납 기록 생성 중 오류가 발생했습니다.",
    };
  }
}

/** 수납 처리 (오프라인 결제 기록) */
export async function confirmPaymentAction(
  input: ConfirmPaymentInput
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

    // 테넌트 소유권 + 금액 정보 조회
    const { data: record } = await adminClient
      .from("payment_records")
      .select("tenant_id, amount")
      .eq("id", input.payment_id)
      .maybeSingle();

    if (!record || record.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const status: PaymentStatus =
      input.paid_amount >= record.amount ? "paid" : "partial";

    const updateData: Record<string, unknown> = {
      paid_amount: input.paid_amount,
      payment_method: input.payment_method,
      paid_date: input.paid_date,
      status,
    };
    if (input.memo !== undefined) {
      updateData.memo = input.memo;
    }

    const { error } = await adminClient
      .from("payment_records")
      .update(updateData)
      .eq("id", input.payment_id);

    if (error) {
      logActionError(
        { domain: "payment", action: "confirm", tenantId, userId },
        error,
        { paymentId: input.payment_id }
      );
      return { success: false, error: "수납 처리에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    revalidatePath("/parent/payments");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "수납 처리 중 오류가 발생했습니다.",
    };
  }
}

/** 미납 청구서 금액 수정 */
export async function updatePaymentAmountAction(
  paymentId: string,
  newAmount: number,
  memo?: string
): Promise<ActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (newAmount < 0) {
      return { success: false, error: "금액은 0 이상이어야 합니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data: record } = await adminClient
      .from("payment_records")
      .select("tenant_id, status")
      .eq("id", paymentId)
      .maybeSingle();

    if (!record || record.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    if (record.status !== "unpaid") {
      return {
        success: false,
        error: "미납 상태의 청구서만 금액을 수정할 수 있습니다.",
      };
    }

    // 금액 직접 수정 시 할인 정보 초기화 (정합성 유지)
    const updateData: Record<string, unknown> = {
      amount: newAmount,
      original_amount: null,
      discount_type: null,
      discount_value: null,
    };
    if (memo !== undefined) {
      updateData.memo = memo;
    }

    const { error } = await adminClient
      .from("payment_records")
      .update(updateData)
      .eq("id", paymentId);

    if (error) {
      logActionError(
        { domain: "payment", action: "updateAmount", tenantId, userId },
        error,
        { paymentId }
      );
      return { success: false, error: "금액 수정에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/billing");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "금액 수정 중 오류가 발생했습니다.",
    };
  }
}

/** 수납 기록 삭제 */
export async function deletePaymentAction(
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

    const { data: record } = await adminClient
      .from("payment_records")
      .select("tenant_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (!record || record.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await adminClient
      .from("payment_records")
      .delete()
      .eq("id", paymentId);

    if (error) {
      logActionError(
        { domain: "payment", action: "delete", tenantId, userId },
        error,
        { paymentId }
      );
      return { success: false, error: "삭제에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "삭제 중 오류가 발생했습니다.",
    };
  }
}
