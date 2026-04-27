// ============================================
// M1-c W3 (2026-04-27): Pipeline Manifest Hash for staleness detection
//
// 파이프라인 별 task graph 의 stable hash 를 계산한다.
// 풀런 완료 시 student_record_analysis_pipelines.task_manifest_hash 컬럼에 영속.
// 이후 코드 변경으로 새 task 가 추가/제거되면 hash 가 바뀌어 stale 감지 트리거.
//
// 입력: pipelineType ('grade' | 'synthesis' | 'past_analytics' | 'blueprint')
// 출력: djb2 hex hash (8 chars)
//
// 별도 파일로 분리한 이유: pipeline-task-manifest.ts 는 거대한 PIPELINE_TASK_MANIFEST
// 객체를 module-level 에서 평가하므로, 그 파일에 새 module-level const 를 추가하면
// Next.js chunk graph evaluation 시점에 TDZ 를 유발할 수 있음 (실측 확인됨).
// 이 파일은 pipeline-config 의 task key 배열만 의존하는 작은 모듈로 유지.
//
// client-safe (no server imports). 다이내믹 import 불필요.
// ============================================

import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  PAST_ANALYTICS_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
} from "./pipeline-config";

export type PipelineHashType = "grade" | "synthesis" | "past_analytics" | "blueprint";

const TASK_KEYS_BY_PIPELINE: Record<PipelineHashType, readonly string[]> = {
  grade: GRADE_PIPELINE_TASK_KEYS,
  synthesis: SYNTHESIS_PIPELINE_TASK_KEYS,
  past_analytics: PAST_ANALYTICS_TASK_KEYS,
  blueprint: BLUEPRINT_TASK_KEYS,
};

/**
 * djb2 hash → 8자리 hex string. 결정적, 외부 의존성 0.
 */
function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * 주어진 pipelineType 의 현재 manifest task keys 를 hash 한다.
 * task 추가/삭제 시 hash 가 바뀌어 staleness 감지에 사용.
 *
 * @param pipelineType - 'grade' / 'synthesis' / 'past_analytics' / 'blueprint'
 * @returns 8자리 hex hash (e.g. "1a2b3c4d")
 */
export function computeManifestHash(pipelineType: PipelineHashType): string {
  const keys = TASK_KEYS_BY_PIPELINE[pipelineType];
  if (!keys || keys.length === 0) return "00000000";
  // 정렬해서 task 등록 순서 변경에는 hash 영향 없도록 (의도: graph 변화만 추적)
  const sorted = [...keys].sort();
  return djb2Hex(sorted.join(","));
}
