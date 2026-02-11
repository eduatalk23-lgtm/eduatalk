"use server";

import { requireParent } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLinkedStudents } from "@/lib/domains/parent/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PaymentStatus,
  PaymentMethod,
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
      const enrollment = row.enrollments as {
        program_id: string;
        programs: { name: string; code: string } | null;
      } | null;
      return {
        id: row.id,
        tenant_id: row.tenant_id,
        enrollment_id: row.enrollment_id,
        student_id: row.student_id,
        amount: row.amount,
        paid_amount: row.paid_amount,
        status: row.status as PaymentStatus,
        payment_method: row.payment_method as PaymentMethod | null,
        due_date: row.due_date,
        paid_date: row.paid_date,
        billing_period: row.billing_period,
        memo: row.memo,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        toss_order_id: row.toss_order_id ?? null,
        toss_payment_key: row.toss_payment_key ?? null,
        toss_method: row.toss_method ?? null,
        toss_receipt_url: row.toss_receipt_url ?? null,
        toss_approved_at: row.toss_approved_at ?? null,
        cash_receipt_url: row.cash_receipt_url ?? null,
        cash_receipt_key: row.cash_receipt_key ?? null,
        cash_receipt_type: (row.cash_receipt_type as
          | "소득공제"
          | "지출증빙"
          | null) ?? null,
        payment_order_id: row.payment_order_id ?? null,
        program_name: enrollment?.programs?.name ?? "",
        program_code: enrollment?.programs?.code ?? "",
        student_name: studentNameMap.get(row.student_id) ?? "이름 없음",
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
