"use server";

// ============================================
// E2: 경고 히스토리 — 스냅샷 저장/조회
// ============================================

import { logActionWarn } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { WarningSnapshot } from "../warnings/history-types";

const LOG_CTX = { domain: "student-record", action: "warning-history" };

/**
 * 파이프라인 완료 시 경고 스냅샷을 저장한다.
 * fire-and-forget 호출 — 절대 throw하지 않는다.
 *
 * ON CONFLICT (pipeline_id) DO NOTHING → 중복 저장 방지.
 */
export async function saveWarningSnapshot(
  pipelineId: string,
  studentId: string,
  tenantId: string,
  studentGrade: number,
  pipelineType: "grade" | "synthesis",
  grade: number | null,
): Promise<void> {
  try {
    const initialSchoolYear = calculateSchoolYear();

    // overview.ts의 computeWarningsFromData 재사용
    const { computeWarningsFromData } = await import("./overview");
    const warnings = await computeWarningsFromData(
      studentId,
      tenantId,
      studentGrade,
      initialSchoolYear,
    );

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("student_record_warning_snapshots")
      .upsert(
        {
          pipeline_id: pipelineId,
          tenant_id: tenantId,
          student_id: studentId,
          pipeline_type: pipelineType,
          grade,
          warnings: warnings as unknown as Json[],
          warning_count: warnings.length,
        },
        { onConflict: "pipeline_id", ignoreDuplicates: true },
      );

    if (error) {
      logActionWarn(LOG_CTX, `스냅샷 저장 실패: ${error.message}`, { pipelineId });
    }
  } catch (err) {
    logActionWarn(LOG_CTX, `스냅샷 생성 실패: ${err instanceof Error ? err.message : String(err)}`, { pipelineId });
  }
}

/**
 * 최근 N개 경고 스냅샷을 조회한다.
 * UI에서 이전 vs 현재 비교용.
 */
export async function fetchWarningSnapshots(
  studentId: string,
  limit = 2,
): Promise<WarningSnapshot[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_record_warning_snapshots")
    .select("id, pipeline_id, pipeline_type, grade, warnings, warning_count, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logActionWarn(LOG_CTX, `스냅샷 조회 실패 (빈 배열 반환): ${error.code} ${error.message}`, { studentId });
    return [];
  }

  return (data ?? []) as unknown as WarningSnapshot[];
}
