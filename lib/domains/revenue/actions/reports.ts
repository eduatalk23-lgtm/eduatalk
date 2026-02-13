"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  RevenueSummary,
  MonthlyRevenue,
  ProgramRevenue,
  RevenueFilters,
} from "../types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 매출 요약 조회 (DB 함수 get_revenue_summary 호출)
 */
export async function getRevenueSummaryAction(
  filters: RevenueFilters
): Promise<ActionResult<RevenueSummary>> {
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

    const { data, error } = await adminClient.rpc("get_revenue_summary", {
      p_tenant_id: tenantId,
      p_start: filters.startDate,
      p_end: filters.endDate,
      p_program_id: filters.programId,
      p_consultant_id: filters.consultantId,
    });

    if (error) {
      // DB 함수가 아직 없을 수 있음 → 직접 쿼리 fallback
      return await getRevenueSummaryFallback(
        adminClient,
        tenantId,
        filters
      );
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return {
        success: true,
        data: {
          total_billed: 0,
          total_paid: 0,
          total_unpaid: 0,
          collection_rate: 0,
          payment_count: 0,
          student_count: 0,
        },
      };
    }

    return {
      success: true,
      data: {
        total_billed: Number(row.total_billed) || 0,
        total_paid: Number(row.total_paid) || 0,
        total_unpaid: Number(row.total_unpaid) || 0,
        collection_rate: Number(row.collection_rate) || 0,
        payment_count: Number(row.payment_count) || 0,
        student_count: Number(row.student_count) || 0,
      },
    };
  } catch (error) {
    logActionError(
      { domain: "revenue", action: "getRevenueSummary" },
      error
    );
    return {
      success: false,
      error: "매출 요약 조회 중 오류가 발생했습니다.",
    };
  }
}

/** DB 함수 미존재 시 직접 쿼리 fallback */
async function getRevenueSummaryFallback(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  tenantId: string,
  filters: RevenueFilters
): Promise<ActionResult<RevenueSummary>> {
  let query = adminClient
    .from("payment_records")
    .select("amount, paid_amount, student_id, enrollments!inner(program_id)")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("cancelled","refunded")')
    .gte("created_at", `${filters.startDate}T00:00:00`)
    .lte("created_at", `${filters.endDate}T23:59:59`);

  if (filters.programId) {
    query = query.eq("enrollments.program_id", filters.programId);
  }

  const { data: records, error } = await query;

  if (error || !records) {
    return {
      success: true,
      data: {
        total_billed: 0,
        total_paid: 0,
        total_unpaid: 0,
        collection_rate: 0,
        payment_count: 0,
        student_count: 0,
      },
    };
  }

  const rows = records as { amount: number; paid_amount: number; student_id: string }[];
  const totalBilled = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + (r.paid_amount || 0), 0);
  const students = new Set(rows.map((r) => r.student_id));

  return {
    success: true,
    data: {
      total_billed: totalBilled,
      total_paid: totalPaid,
      total_unpaid: totalBilled - totalPaid,
      collection_rate: totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 1000) / 10 : 0,
      payment_count: rows.length,
      student_count: students.size,
    },
  };
}

/**
 * 월별 매출 조회 (DB 함수 get_monthly_revenue 호출)
 */
export async function getMonthlyRevenueAction(
  startDate: string,
  endDate: string,
  programId?: string
): Promise<ActionResult<MonthlyRevenue[]>> {
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

    const { data, error } = await adminClient.rpc("get_monthly_revenue", {
      p_tenant_id: tenantId,
      p_start: startDate,
      p_end: endDate,
      p_program_id: programId,
    });

    if (error) {
      // fallback: 직접 쿼리
      return await getMonthlyRevenueFallback(
        adminClient,
        tenantId,
        startDate,
        endDate,
        programId
      );
    }

    const rows = (data ?? []) as Record<string, unknown>[];

    return {
      success: true,
      data: rows.map((row) => ({
        month: String(row.month),
        billed: Number(row.billed) || 0,
        paid: Number(row.paid) || 0,
        unpaid: Number(row.unpaid) || 0,
        rate: Number(row.rate) || 0,
      })),
    };
  } catch (error) {
    logActionError(
      { domain: "revenue", action: "getMonthlyRevenue" },
      error
    );
    return {
      success: false,
      error: "월별 매출 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 월별 매출 fallback */
async function getMonthlyRevenueFallback(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  tenantId: string,
  startDate: string,
  endDate: string,
  programId?: string
): Promise<ActionResult<MonthlyRevenue[]>> {
  let query = adminClient
    .from("payment_records")
    .select("amount, paid_amount, created_at, enrollments!inner(program_id)")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("cancelled","refunded")')
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`);

  if (programId) {
    query = query.eq("enrollments.program_id", programId);
  }

  const { data: records } = await query;

  if (!records) {
    return { success: true, data: [] };
  }

  const monthMap = new Map<string, { billed: number; paid: number }>();

  for (const r of records as { amount: number; paid_amount: number; created_at: string }[]) {
    const month = r.created_at.slice(0, 7);
    const entry = monthMap.get(month) ?? { billed: 0, paid: 0 };
    entry.billed += r.amount || 0;
    entry.paid += r.paid_amount || 0;
    monthMap.set(month, entry);
  }

  const result: MonthlyRevenue[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, { billed, paid }]) => ({
      month,
      billed,
      paid,
      unpaid: billed - paid,
      rate: billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0,
    }));

  return { success: true, data: result };
}

/**
 * 프로그램별 매출 조회 (DB 함수 get_program_revenue 호출)
 */
export async function getProgramRevenueAction(
  startDate: string,
  endDate: string
): Promise<ActionResult<ProgramRevenue[]>> {
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

    const { data, error } = await adminClient.rpc("get_program_revenue", {
      p_tenant_id: tenantId,
      p_start: startDate,
      p_end: endDate,
    });

    if (error) {
      return await getProgramRevenueFallback(
        adminClient,
        tenantId,
        startDate,
        endDate
      );
    }

    const rows = (data ?? []) as Record<string, unknown>[];

    return {
      success: true,
      data: rows.map((row) => ({
        program_id: String(row.program_id),
        program_name: String(row.program_name),
        total_billed: Number(row.total_billed) || 0,
        total_paid: Number(row.total_paid) || 0,
        enrollment_count: Number(row.enrollment_count) || 0,
        pct: Number(row.pct) || 0,
      })),
    };
  } catch (error) {
    logActionError(
      { domain: "revenue", action: "getProgramRevenue" },
      error
    );
    return {
      success: false,
      error: "프로그램별 매출 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 프로그램별 매출 fallback */
async function getProgramRevenueFallback(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<ActionResult<ProgramRevenue[]>> {
  const { data: records } = await adminClient
    .from("payment_records")
    .select("amount, paid_amount, enrollment_id, enrollments(program_id, programs(name))")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("cancelled","refunded")')
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`);

  if (!records) {
    return { success: true, data: [] };
  }

  const programMap = new Map<
    string,
    { name: string; billed: number; paid: number; enrollments: Set<string> }
  >();

  let grandTotal = 0;

  for (const r of records as Record<string, unknown>[]) {
    const enrollment = r.enrollments as {
      program_id: string;
      programs: { name: string } | null;
    } | null;

    if (!enrollment) continue;

    const programId = enrollment.program_id;
    const programName = enrollment.programs?.name ?? "알 수 없음";
    const entry = programMap.get(programId) ?? {
      name: programName,
      billed: 0,
      paid: 0,
      enrollments: new Set<string>(),
    };
    const amount = (r.amount as number) || 0;
    entry.billed += amount;
    entry.paid += ((r.paid_amount as number) || 0);
    entry.enrollments.add(r.enrollment_id as string);
    grandTotal += amount;
    programMap.set(programId, entry);
  }

  const result: ProgramRevenue[] = Array.from(programMap.entries())
    .sort(([, a], [, b]) => b.billed - a.billed)
    .map(([id, { name, billed, paid, enrollments }]) => ({
      program_id: id,
      program_name: name,
      total_billed: billed,
      total_paid: paid,
      enrollment_count: enrollments.size,
      pct: grandTotal > 0 ? Math.round((billed / grandTotal) * 1000) / 10 : 0,
    }));

  return { success: true, data: result };
}

/**
 * 매출 데이터를 CSV 문자열로 내보내기 (BOM 포함, 엑셀 한글 호환)
 */
export async function exportRevenueCSVAction(
  filters: RevenueFilters
): Promise<ActionResult<string>> {
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

    const { data: records } = await adminClient
      .from("payment_records")
      .select(
        "amount, paid_amount, status, payment_method, created_at, paid_date, billing_period, students(name), enrollments(programs(name))"
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", `${filters.startDate}T00:00:00`)
      .lte("created_at", `${filters.endDate}T23:59:59`)
      .order("created_at", { ascending: false });

    if (!records || records.length === 0) {
      return { success: false, error: "내보낼 데이터가 없습니다." };
    }

    const rows = records as Record<string, unknown>[];

    // BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const header = "학생명,프로그램,청구액,납부액,미수금,상태,결제방법,청구기간,생성일,납부일";

    const STATUS_KR: Record<string, string> = {
      unpaid: "미납",
      paid: "완납",
      partial: "부분납",
      refunded: "환불",
      cancelled: "취소",
    };
    const METHOD_KR: Record<string, string> = {
      cash: "현금",
      card: "카드",
      transfer: "이체",
      other: "기타",
    };

    const csvRows = rows.map((r) => {
      const student = r.students as { name: string } | null;
      const enrollment = r.enrollments as { programs: { name: string } | null } | null;
      const amount = (r.amount as number) || 0;
      const paid = (r.paid_amount as number) || 0;

      return [
        student?.name ?? "",
        enrollment?.programs?.name ?? "",
        amount,
        paid,
        amount - paid,
        STATUS_KR[r.status as string] ?? r.status,
        METHOD_KR[r.payment_method as string] ?? r.payment_method ?? "",
        (r.billing_period as string) ?? "",
        ((r.created_at as string) ?? "").slice(0, 10),
        (r.paid_date as string) ?? "",
      ].join(",");
    });

    const csv = BOM + header + "\n" + csvRows.join("\n");

    return { success: true, data: csv };
  } catch (error) {
    logActionError(
      { domain: "revenue", action: "exportRevenueCSV" },
      error
    );
    return {
      success: false,
      error: "CSV 내보내기 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 프로그램 목록 조회 (필터용)
 */
export async function getProgramsForFilterAction(): Promise<
  ActionResult<{ id: string; name: string }[]>
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

    const { data } = await adminClient
      .from("programs")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("name");

    return {
      success: true,
      data: (data ?? []).map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
      })),
    };
  } catch (error) {
    return { success: false, error: "프로그램 목록 조회 실패" };
  }
}
