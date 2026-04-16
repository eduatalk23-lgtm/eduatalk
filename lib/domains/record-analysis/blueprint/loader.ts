// ============================================
// Blueprint Loader — ctx.blueprint 캐시용 DB 로더
//
// 4축×3층 통합 아키텍처 2026-04-16 D 결정 5.
// Grade Pipeline 설계 모드(P4~P7)가 프롬프트 주입을 위해 호출한다.
// Blueprint Pipeline이 가장 최근 완료시킨 _blueprintPhase task result를 읽어
// BlueprintPhaseOutput으로 반환.
// ============================================

import { logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BlueprintPhaseOutput } from "./types";

const LOG_CTX = { domain: "record-analysis", action: "blueprint-loader" };

/**
 * 가장 최근 완료된 blueprint 파이프라인의 _blueprintPhase 산출물을 로드.
 * 찾지 못하면 null (로깅만 남기고 조용히 실패).
 *
 * Admin 클라이언트 사용 — 파이프라인 엔진(서버리스 route) 내부 호출 전용.
 * createSupabaseServerClient는 cookies() 의존이라 tsx 스크립트/background worker에서 실패.
 */
export async function loadBlueprintForStudent(
  studentId: string,
  tenantId: string,
): Promise<BlueprintPhaseOutput | null> {
  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      logActionWarn(LOG_CTX, "admin 클라이언트 미설정 — blueprint 로드 불가", { studentId });
      return null;
    }
    const { data, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, task_results, updated_at, status")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("pipeline_type", "blueprint")
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logActionWarn(LOG_CTX, `blueprint pipeline 조회 실패: ${error.message}`, {
        studentId,
      });
      return null;
    }
    if (!data?.task_results) return null;

    const results = data.task_results as Record<string, unknown>;
    const raw = results._blueprintPhase as unknown;
    if (!raw || typeof raw !== "object") return null;

    // 구조 검증 (최소 필드) — targetConvergences 또는 milestones 중 하나는 있어야 의미 있음
    const bp = raw as BlueprintPhaseOutput;
    if (!Array.isArray(bp.targetConvergences) && !bp.milestones) {
      return null;
    }

    return bp;
  } catch (err) {
    logActionWarn(LOG_CTX, `blueprint 로드 예외: ${err instanceof Error ? err.message : String(err)}`, {
      studentId,
    });
    return null;
  }
}
