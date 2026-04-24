// ============================================
// AI 생기부 분석 파이프라인 유틸리티 함수
// (pipeline-types.ts에서 분리)
// ============================================

import type { PipelineTaskResults, PipelineTaskResultMap } from "./pipeline-types";
import type { PipelineTaskKey } from "./pipeline-types";
import { PIPELINE_TASK_DEPENDENTS } from "./pipeline-config";

/**
 * 타입 안전한 ctx.results 읽기 헬퍼.
 * `as` 캐스트를 이 함수 1곳으로 집약한다.
 *
 * @example
 *   const diag = getTaskResult(ctx.results, "ai_diagnosis");
 *   diag?.overallGrade  // string | undefined
 */
export function getTaskResult<K extends keyof PipelineTaskResultMap>(
  results: PipelineTaskResults,
  key: K,
): PipelineTaskResultMap[K] | undefined {
  const raw = results[key];
  if (raw == null) return undefined;
  return raw as PipelineTaskResultMap[K];
}

/**
 * 타입 안전한 ctx.results 쓰기 헬퍼.
 * `as` 캐스트를 이 함수 1곳으로 집약한다.
 *
 * @example
 *   setTaskResult(ctx.results, "ai_diagnosis", { overallGrade: "A", weaknessCount: 2, improvementCount: 3 });
 */
export function setTaskResult<K extends keyof PipelineTaskResultMap>(
  results: PipelineTaskResults,
  key: K,
  value: PipelineTaskResultMap[K],
): void {
  results[key] = value;
}

/**
 * 타입 안전한 ctx.results 병합 헬퍼.
 * 기존 값과 새 partial 을 shallow merge. 청크 누적, elapsedMs 부착 등에 사용.
 *
 * @example
 *   mergeTaskResult(ctx.results, "competency_setek", { chunksProcessed: 3, elapsedMs: 12_000 });
 */
export function mergeTaskResult<K extends keyof PipelineTaskResultMap>(
  results: PipelineTaskResults,
  key: K,
  partial: Partial<PipelineTaskResultMap[K]> & Record<string, unknown>,
): void {
  const prev = (results[key] as Record<string, unknown> | undefined) ?? {};
  results[key] = { ...prev, ...partial } as PipelineTaskResultMap[K];
}

/**
 * 재실행할 태스크 + cascade 의존 태스크 셋 계산
 * rerunPipelineTasks에서 사용하는 순수 로직
 */
export function computeCascadeResetKeys(taskKeys: PipelineTaskKey[]): Set<PipelineTaskKey> {
  const toReset = new Set<PipelineTaskKey>(taskKeys);
  for (const key of taskKeys) {
    for (const dep of PIPELINE_TASK_DEPENDENTS[key] ?? []) toReset.add(dep);
  }
  return toReset;
}
