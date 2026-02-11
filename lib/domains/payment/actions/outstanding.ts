"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentStatus } from "../types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type OutstandingStats = {
  total_outstanding: number;
  this_month_billed: number;
  this_month_paid: number;
  collection_rate: number;
};

export type OutstandingPayment = {
  id: string;
  enrollment_id: string;
  student_id: string;
  student_name: string;
  program_name: string;
  amount: number;
  paid_amount: number;
  status: PaymentStatus;
  due_date: string | null;
  billing_period: string | null;
  days_overdue: number;
  created_at: string;
};

export type OutstandingFilters = {
  billingPeriod?: string;
  programId?: string;
  status?: string;
  overdueLevel?: "all" | "upcoming" | "overdue_7" | "overdue_14" | "overdue_30";
};

/** 미수금 통계 조회 */
export async function getOutstandingStatsAction(): Promise<
  ActionResult<OutstandingStats>
> {
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

    // 총 미수금 (unpaid + partial)
    const { data: outstandingData } = await adminClient
      .from("payment_records")
      .select("amount, paid_amount")
      .eq("tenant_id", tenantId)
      .in("status", ["unpaid", "partial"]);

    const totalOutstanding = (outstandingData ?? []).reduce(
      (sum, r) => sum + (r.amount - r.paid_amount),
      0
    );

    // 이번 달 청구/수납
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const { data: monthData } = await adminClient
      .from("payment_records")
      .select("amount, paid_amount")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd + "T23:59:59");

    const thisMonthBilled = (monthData ?? []).reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const thisMonthPaid = (monthData ?? []).reduce(
      (sum, r) => sum + r.paid_amount,
      0
    );
    const collectionRate =
      thisMonthBilled > 0
        ? Math.round((thisMonthPaid / thisMonthBilled) * 1000) / 10
        : 0;

    return {
      success: true,
      data: {
        total_outstanding: totalOutstanding,
        this_month_billed: thisMonthBilled,
        this_month_paid: thisMonthPaid,
        collection_rate: collectionRate,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "통계 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 미수금 목록 조회 */
export async function getOutstandingPaymentsAction(
  filters: OutstandingFilters = {}
): Promise<ActionResult<OutstandingPayment[]>> {
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

    let query = adminClient
      .from("payment_records")
      .select(
        "id, enrollment_id, student_id, amount, paid_amount, status, due_date, billing_period, created_at, students(name), enrollments(program_id, programs(name))"
      )
      .eq("tenant_id", tenantId)
      .in("status", ["unpaid", "partial"])
      .order("due_date", { ascending: true, nullsFirst: false });

    if (filters.billingPeriod) {
      query = query.eq("billing_period", filters.billingPeriod);
    }

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      return { success: false, error: error.message };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments: OutstandingPayment[] = (data ?? [])
      .map((row) => {
        const student = row.students as { name: string } | null;
        const enrollment = row.enrollments as {
          program_id: string;
          programs: { name: string } | null;
        } | null;

        const dueDate = row.due_date ? new Date(row.due_date + "T00:00:00") : null;
        const daysOverdue = dueDate
          ? Math.floor(
              (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;

        return {
          id: row.id,
          enrollment_id: row.enrollment_id,
          student_id: row.student_id,
          student_name: student?.name ?? "",
          program_name:
            (enrollment?.programs as { name: string } | null)?.name ?? "",
          amount: row.amount,
          paid_amount: row.paid_amount,
          status: row.status as PaymentStatus,
          due_date: row.due_date,
          billing_period: row.billing_period,
          days_overdue: daysOverdue,
          created_at: row.created_at,
        };
      })
      .filter((p) => {
        // 프로그램 필터
        if (filters.programId) {
          const enrollment = (data ?? []).find(
            (d) => d.id === p.id
          )?.enrollments as { program_id: string } | null;
          if (enrollment?.program_id !== filters.programId) return false;
        }

        // 연체 수준 필터
        if (filters.overdueLevel && filters.overdueLevel !== "all") {
          switch (filters.overdueLevel) {
            case "upcoming":
              return p.days_overdue < 0;
            case "overdue_7":
              return p.days_overdue >= 0 && p.days_overdue <= 7;
            case "overdue_14":
              return p.days_overdue > 7 && p.days_overdue <= 14;
            case "overdue_30":
              return p.days_overdue > 14;
          }
        }
        return true;
      });

    return { success: true, data: payments };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "미수금 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 일괄 청구 가능한 active 수강 목록 */
export async function getActiveEnrollmentsForBillingAction(): Promise<
  ActionResult<
    {
      id: string;
      student_id: string;
      student_name: string;
      program_name: string;
      price: number;
      billing_type: string;
    }[]
  >
> {
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

    const { data, error } = await adminClient
      .from("enrollments")
      .select("id, student_id, price, students(name), programs(name, price, billing_type)")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = (data ?? []).map((row) => {
      const student = row.students as { name: string } | null;
      const program = row.programs as {
        name: string;
        price: number;
        billing_type: string;
      } | null;

      return {
        id: row.id,
        student_id: row.student_id,
        student_name: student?.name ?? "",
        program_name: program?.name ?? "",
        price: row.price ?? program?.price ?? 0,
        billing_type: program?.billing_type ?? "recurring",
      };
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "수강 목록 조회 중 오류가 발생했습니다.",
    };
  }
}
