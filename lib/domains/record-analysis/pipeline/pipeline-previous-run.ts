// ============================================
// Previous Run Outputs Loader (PR 5, 2026-04-17).
//
// 같은 학생 + 동일 `pipeline_type` 의 가장 최근 completed 파이프라인의 task_results 스냅샷을 로드한다.
// Cross-run feedback 루프(이전 실행 terminal 산출물 → 다음 실행 상류 태스크)의 단일 진실 소스.
//
// 사용처: `loadPipelineContext()` 에서 `ctx.previousRunOutputs` 를 채운다. 각 runner 는 이 필드만
// 참조하고 직접 DB 재조회하지 않는다 (동일 실행 내 중복 호출 방지).
// ============================================

import { logActionWarn } from "@/lib/logging/actionLogger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PreviousRunOutputs } from "./pipeline-types";

const LOG_CTX = { domain: "record-analysis", action: "previous-run-loader" };

/**
 * 직전 실행(completed) 파이프라인의 task_results 로드.
 *
 * @param excludePipelineId 현재 실행 중인 파이프라인 ID — 자기 자신을 "직전 실행" 으로 잡지 않기 위해 제외.
 *                          재실행 시나리오(같은 row 재사용)와 신규 run(다른 row)을 모두 고려.
 */
export async function loadPreviousRunOutputs(
  supabase: SupabaseClient<Database>,
  studentId: string,
  tenantId: string,
  pipelineType: string,
  excludePipelineId: string,
): Promise<PreviousRunOutputs> {
  try {
    const { data, error } = await supabase
      .from("student_record_analysis_pipelines")
      .select("id, task_results, completed_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("pipeline_type", pipelineType)
      .eq("status", "completed")
      .neq("id", excludePipelineId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logActionWarn(LOG_CTX, `이전 실행 조회 실패: ${error.message}`, {
        studentId,
        pipelineType,
      });
      return { runId: null, completedAt: null, taskResults: {} };
    }

    if (!data) {
      // 최초 실행 — 정상 흐름
      return { runId: null, completedAt: null, taskResults: {} };
    }

    return {
      runId: data.id,
      completedAt: data.completed_at,
      taskResults: (data.task_results ?? {}) as Record<string, unknown>,
    };
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      `이전 실행 로드 예외: ${err instanceof Error ? err.message : String(err)}`,
      { studentId, pipelineType },
    );
    return { runId: null, completedAt: null, taskResults: {} };
  }
}

/**
 * 헬퍼: `ctx.previousRunOutputs.taskResults[taskKey]` 를 타입 안전하게 꺼낸다.
 * manifest 의 `writesForNextRun` 에 선언된 태스크만 읽어야 함 — CI 가 검증.
 */
export function getPreviousRunResult<T = unknown>(
  previousRunOutputs: PreviousRunOutputs | undefined,
  taskKey: string,
): T | undefined {
  if (!previousRunOutputs || !previousRunOutputs.runId) return undefined;
  return previousRunOutputs.taskResults[taskKey] as T | undefined;
}
