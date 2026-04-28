"use server";

// ============================================
// 학년별 예상 mode (analysis/design) 산출
//
// 파이프라인 실행 도중에는 NEIS 레코드/수강계획이 변하지 않으므로
// 폴링 응답에서 분리해 별도 query 로 캐시 (staleTime 5분).
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import type {
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
} from "@/lib/domains/record-analysis/pipeline";
import { resolveRecordData, deriveGradeCategories } from "@/lib/domains/record-analysis/pipeline";

const LOG_CTX = { domain: "student-record", action: "pipeline-orchestrator-modes" };

export type ExpectedModes = Record<number, "analysis" | "design">;

export async function fetchExpectedModes(
  studentId: string,
): Promise<ActionResponse<ExpectedModes>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const expectedModes: ExpectedModes = {};

    const { data: student } = await supabase
      .from("students")
      .select("grade, tenant_id")
      .eq("id", studentId)
      .single();

    if (!student) return createSuccessResponse(expectedModes);

    const tenantId = student.tenant_id as string;
    const [sRes, cRes, hRes, cpRes] = await Promise.all([
      supabase.from("student_record_seteks")
        .select("grade, imported_content")
        .eq("student_id", studentId).eq("tenant_id", tenantId).is("deleted_at", null),
      supabase.from("student_record_changche")
        .select("grade, imported_content")
        .eq("student_id", studentId).eq("tenant_id", tenantId),
      supabase.from("student_record_haengteuk")
        .select("grade, imported_content")
        .eq("student_id", studentId).eq("tenant_id", tenantId),
      supabase.from("student_course_plans")
        .select("grade")
        .eq("student_id", studentId).in("plan_status", ["confirmed", "recommended"]),
    ]);

    const resolvedRecords = resolveRecordData(
      (sRes.data ?? []) as CachedSetek[],
      (cRes.data ?? []) as CachedChangche[],
      (hRes.data ?? []) as CachedHaengteuk[],
    );
    const { neisGrades } = deriveGradeCategories(resolvedRecords);
    const coursePlanGrades = [...new Set(
      ((cpRes.data ?? []) as { grade: number }[]).map((r) => r.grade).filter((g) => g >= 1 && g <= 3),
    )];

    const allGrades = [...new Set([
      ...Object.keys(resolvedRecords).map(Number),
      ...coursePlanGrades,
    ])].filter((g) => g >= 1 && g <= 3);

    for (const grade of allGrades) {
      expectedModes[grade] = neisGrades.includes(grade) ? "analysis" : "design";
    }

    return createSuccessResponse(expectedModes);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchExpectedModes" }, error, { studentId });
    return createErrorResponse("예상 mode 조회 실패");
  }
}
