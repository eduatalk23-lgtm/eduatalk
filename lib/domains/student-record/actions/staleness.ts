"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPipelineStaleness, checkBlueprintStaleness } from "../stale-detection";

/** 파이프라인 stale 여부 조회 (서버 액션) */
export async function checkPipelineStalenessAction(
  studentId: string,
): Promise<{ isStale: boolean }> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return { isStale: false };

    const result = await checkPipelineStaleness(studentId, tenantId);
    return { isStale: result.isStale };
  } catch {
    return { isStale: false };
  }
}

/**
 * Blueprint staleness 조회 — 활성 메인 탐구가 blueprint 완료 이후 갱신되었는지 판정.
 * UI 배지/경고 표시용 server action.
 */
export async function checkBlueprintStalenessAction(
  studentId: string,
): Promise<{
  isStale: boolean;
  mainExplorationUpdatedAt: string | null;
  blueprintCompletedAt: string | null;
}> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return {
        isStale: false,
        mainExplorationUpdatedAt: null,
        blueprintCompletedAt: null,
      };
    }
    return await checkBlueprintStaleness(studentId, tenantId);
  } catch {
    return {
      isStale: false,
      mainExplorationUpdatedAt: null,
      blueprintCompletedAt: null,
    };
  }
}

/** 진단 staleness 조회 — 엣지 stale 상태 + 파이프라인 stale 결합 */
export async function checkDiagnosisStalenessAction(
  studentId: string,
): Promise<{ isStale: boolean; staleEdgeCount: number; pipelineStale: boolean }> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return { isStale: false, staleEdgeCount: 0, pipelineStale: false };

    const supabase = await createSupabaseServerClient();

    // 병렬: stale 엣지 카운트 + 파이프라인 stale 체크
    const [edgeResult, pipelineResult] = await Promise.all([
      supabase
        .from("student_record_edges")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("is_stale", true),
      checkPipelineStaleness(studentId, tenantId),
    ]);

    const staleEdgeCount = edgeResult.count ?? 0;
    const pipelineStale = pipelineResult.isStale;

    return {
      isStale: staleEdgeCount > 0 || pipelineStale,
      staleEdgeCount,
      pipelineStale,
    };
  } catch {
    return { isStale: false, staleEdgeCount: 0, pipelineStale: false };
  }
}
