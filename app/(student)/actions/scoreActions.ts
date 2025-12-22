/**
 * scoreActions.ts - 성적 관련 Server Actions
 *
 * 이 파일은 lib/domains/score의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/score에서 직접 import 사용을 권장합니다.
 */

export {
  addMockScore,
  updateMockScoreFormAction as updateMockScoreAction,
  deleteMockScoreFormAction as deleteMockScoreAction,
} from "@/lib/domains/score";
