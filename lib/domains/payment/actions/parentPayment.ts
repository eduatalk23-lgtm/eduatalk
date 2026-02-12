"use server";

import { requireParent } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLinkedStudents } from "@/lib/domains/parent/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PaymentStatus,
  PaymentMethod,
  DiscountType,
  PaymentRecordWithEnrollment,
} from "../types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type ParentPaymentsData = {
  students: { id: string; name: string }[];
  unpaid: PaymentRecordWithEnrollment[];
  paid: PaymentRecordWithEnrollment[];
};

/**
 * 학부모 연결 학생들의 결제 내역 조회
 * 미납(unpaid/partial) + 완납(paid/refunded) 모두 반환
 * students 목록도 함께 반환하여 탭 필터링에 사용
 */
export async function getParentPaymentsAction(): Promise<
  ActionResult<ParentPaymentsData>
> {
  try {
    const { userId } = await requireParent();

    const supabase = await createSupabaseServerClient();
    const linkedStudents = await getLinkedStudents(supabase, userId);

    if (linkedStudents.length === 0) {
      return {
        success: true,
        data: { students: [], unpaid: [], paid: [] },
      };
    }

    const studentIds = linkedStudents.map((s) => s.id);
    const studentNameMap = new Map(
      linkedStudents.map((s) => [s.id, s.name ?? "이름 없음"])
    );

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "서버 오류가 발생했습니다." };
    }

    const { data, error } = await adminClient
      .from("payment_records")
      .select("*, enrollments(program_id, programs(name, code))")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: "결제 내역 조회에 실패했습니다." };
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
        cash_receipt_type: (r.cash_receipt_type as
          | "소득공제"
          | "지출증빙"
          | null) ?? null,
        payment_order_id: r.payment_order_id ?? null,
        original_amount: r.original_amount ?? null,
        discount_type: (r.discount_type as DiscountType | null) ?? null,
        discount_value: r.discount_value != null ? Number(r.discount_value) : null,
        program_name: enrollment?.programs?.name ?? "",
        program_code: enrollment?.programs?.code ?? "",
        student_name: studentNameMap.get(r.student_id) ?? "이름 없음",
      };
    });

    const unpaid = payments.filter(
      (p) => p.status === "unpaid" || p.status === "partial"
    );
    const paid = payments.filter(
      (p) => p.status === "paid" || p.status === "refunded"
    );

    const students = linkedStudents.map((s) => ({
      id: s.id,
      name: s.name ?? "이름 없음",
    }));

    return { success: true, data: { students, unpaid, paid } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "결제 내역 조회 중 오류가 발생했습니다.",
    };
  }
}
