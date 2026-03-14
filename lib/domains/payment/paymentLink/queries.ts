"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentLinkStatus } from "./types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** 결제 링크 통계 */
export type PaymentLinkStats = {
  total: number;
  active: number;
  completed: number;
  expired: number;
  cancelled: number;
  totalAmount: number;
  paidAmount: number;
  conversionRate: number; // completed / (completed + expired + cancelled) %
};

/** 결제 링크 목록 항목 */
export type PaymentLinkListItem = {
  id: string;
  token: string;
  student_name: string;
  program_name: string;
  amount: number;
  status: PaymentLinkStatus;
  delivery_method: string | null;
  delivery_status: string;
  recipient_phone: string | null;
  expires_at: string;
  paid_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

export type PaymentLinkFilters = {
  status?: PaymentLinkStatus | "all";
  search?: string;
};

/** 결제 링크 통계 조회 */
export async function getPaymentLinkStatsAction(): Promise<
  ActionResult<PaymentLinkStats>
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
      .from("payment_links")
      .select("status, amount, paid_at")
      .eq("tenant_id", tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = data ?? [];
    const total = rows.length;
    const active = rows.filter((r) => r.status === "active").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const expired = rows.filter((r) => r.status === "expired").length;
    const cancelled = rows.filter((r) => r.status === "cancelled").length;
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
    const paidAmount = rows
      .filter((r) => r.status === "completed")
      .reduce((s, r) => s + r.amount, 0);

    const resolved = completed + expired + cancelled;
    const conversionRate =
      resolved > 0 ? Math.round((completed / resolved) * 100) : 0;

    return {
      success: true,
      data: {
        total,
        active,
        completed,
        expired,
        cancelled,
        totalAmount,
        paidAmount,
        conversionRate,
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

/** 결제 링크 목록 조회 */
export async function getPaymentLinksAction(
  filters?: PaymentLinkFilters
): Promise<ActionResult<PaymentLinkListItem[]>> {
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
      .from("payment_links")
      .select(
        "id, token, student_name, program_name, amount, status, delivery_method, delivery_status, recipient_phone, expires_at, paid_at, view_count, last_viewed_at, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `student_name.ilike.%${filters.search}%,program_name.ilike.%${filters.search}%,recipient_phone.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query.limit(200);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []) as PaymentLinkListItem[],
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "목록 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 미결제 건 목록 조회 (대량 링크 생성용) */
export async function getUnpaidRecordsForBulkAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      student_name: string;
      program_name: string;
      amount: number;
      paid_amount: number;
      due_date: string | null;
      billing_period: string | null;
      has_active_link: boolean;
    }>
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

    // 미결제 payment_records 조회
    const { data: records, error: recordError } = await adminClient
      .from("payment_records")
      .select(
        "id, amount, paid_amount, due_date, billing_period, student_id, enrollments(programs(name)), students(user_profiles(name))"
      )
      .eq("tenant_id", tenantId)
      .in("status", ["unpaid", "partial"])
      .order("due_date", { ascending: true, nullsFirst: false });

    if (recordError) {
      return { success: false, error: recordError.message };
    }

    // 활성 링크가 있는 payment_record_id 집합 조회
    const { data: activeLinks } = await adminClient
      .from("payment_links")
      .select("payment_record_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    const activeLinkSet = new Set(
      (activeLinks ?? []).map((l) => l.payment_record_id)
    );

    const items = (records ?? []).map((r) => {
      const enrollment = r.enrollments as {
        programs: { name: string } | null;
      } | null;
      const studentRaw = r.students as unknown;
      const sObj = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
      const sUp = (sObj as Record<string, unknown> | null)?.user_profiles;
      const sUpObj = Array.isArray(sUp) ? sUp[0] : sUp;
      const studentName = (sUpObj as Record<string, unknown> | null)?.name as string | null;

      return {
        id: r.id,
        student_name: studentName ?? "학생",
        program_name: enrollment?.programs?.name ?? "수강료",
        amount: r.amount,
        paid_amount: r.paid_amount ?? 0,
        due_date: r.due_date,
        billing_period: r.billing_period,
        has_active_link: activeLinkSet.has(r.id),
      };
    });

    return { success: true, data: items };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "미결제 목록 조회 중 오류가 발생했습니다.",
    };
  }
}
