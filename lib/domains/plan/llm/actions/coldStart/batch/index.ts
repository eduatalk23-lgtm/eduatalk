/**
 * 콜드 스타트 배치 처리 모듈
 *
 * 주요 교과/과목 조합을 사전 크롤링하여 DB에 축적합니다.
 *
 * @example
 * ```typescript
 * import {
 *   runColdStartBatch,
 *   dryRunBatch,
 *   CORE_TARGETS,
 * } from "@/lib/domains/plan/llm/actions/coldStart/batch";
 *
 * // 드라이런으로 대상 확인
 * const { targets, estimatedDurationMinutes } = dryRunBatch("core");
 * console.log(`${targets.length}개 대상, 예상 ${estimatedDurationMinutes}분`);
 *
 * // 실제 배치 실행
 * const result = await runColdStartBatch("core", {
 *   saveToDb: true,
 *   onProgress: (p) => console.log(`${p.percentComplete}% 완료`),
 * });
 * ```
 *
 * @module lib/domains/plan/llm/actions/coldStart/batch
 */

// 타입 export
export type {
  BatchTarget,
  BatchOptions,
  BatchResult,
  BatchItemResult,
  BatchError,
  BatchProgress,
  BatchPreset,
} from "./types";

// 대상 목록 export
export {
  CORE_TARGETS,
  MATH_TARGETS,
  ENGLISH_TARGETS,
  SCIENCE_TARGETS,
  ALL_TARGETS,
  getTargetsForPreset,
  targetToString,
} from "./targets";

// 실행 함수 export
export { runColdStartBatch, dryRunBatch } from "./runner";
