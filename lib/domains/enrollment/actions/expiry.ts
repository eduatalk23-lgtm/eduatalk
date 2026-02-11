"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExpiringEnrollment } from "../types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** 만료 예정 수강 조회 (30일 이내) */
export async function getExpiringEnrollmentsAction(
  daysAhead: number = 30
): Promise<ActionResult<ExpiringEnrollment[]>> {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const { data, error } = await adminClient
      .from("enrollments")
      .select("id, tenant_id, student_id, program_id, start_date, end_date, students(name), programs(name)")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .not("end_date", "is", null)
      .gte("end_date", todayStr)
      .lte("end_date", futureDateStr)
      .order("end_date", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const enrollments: ExpiringEnrollment[] = (data ?? []).map((row) => {
      const student = row.students as { name: string } | null;
      const program = row.programs as { name: string } | null;
      const endDate = new Date(row.end_date + "T00:00:00");
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        student_id: row.student_id,
        student_name: student?.name ?? "",
        program_id: row.program_id,
        program_name: program?.name ?? "",
        start_date: row.start_date,
        end_date: row.end_date!,
        days_until_expiry: daysUntilExpiry,
      };
    });

    return { success: true, data: enrollments };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "만료 예정 조회 중 오류가 발생했습니다.",
    };
  }
}
