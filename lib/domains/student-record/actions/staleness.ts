"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkPipelineStaleness } from "../stale-detection";

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
