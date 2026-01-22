/**
 * 플랜 관련 핵심 상수 정의
 * @module lib/constants/plan
 * @see docs/refactoring/03_phase_todo_list.md [P1-3], [P1-7]
 */

// ============================================
// 더미 콘텐츠 ID
// ============================================

/**
 * 비학습 항목용 더미 콘텐츠 ID
 * 이동, 점심, 학원 고정 일정 등 학습이 아닌 항목에 사용
 */
export const DUMMY_NON_LEARNING_CONTENT_ID =
  "00000000-0000-0000-0000-000000000000";

/**
 * 자율학습 항목용 더미 콘텐츠 ID
 * 지정휴일/자유시간에 잡는 generic self-study에 사용
 */
export const DUMMY_SELF_STUDY_CONTENT_ID =
  "00000000-0000-0000-0000-000000000001";

/**
 * 모든 더미 콘텐츠 ID 목록
 */
export const DUMMY_CONTENT_IDS = [
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_SELF_STUDY_CONTENT_ID,
] as const;

// ============================================
// 더미 콘텐츠 메타데이터
// ============================================

/**
 * 더미 콘텐츠의 기본 메타데이터
 */
export const DUMMY_CONTENT_METADATA = {
  [DUMMY_NON_LEARNING_CONTENT_ID]: {
    id: DUMMY_NON_LEARNING_CONTENT_ID,
    title: "비학습 항목",
    content_type: "custom" as const,
    total_page_or_time: 0,
    isNonLearning: true,
    isSelfStudy: false,
  },
  [DUMMY_SELF_STUDY_CONTENT_ID]: {
    id: DUMMY_SELF_STUDY_CONTENT_ID,
    title: "자율학습",
    content_type: "custom" as const,
    total_page_or_time: 0,
    isNonLearning: false,
    isSelfStudy: true,
  },
} as const;

// ============================================
// 플랜 완료 기준
// ============================================

/**
 * 플랜 완료 기준 정의
 *
 * 이진 완료 기준 (2026-01-21 단순화):
 * - 기본 기준: status === 'completed' (명시적 상태 완료)
 * - 대체 기준: actual_end_time이 설정됨 (backward compatibility)
 *
 * @example
 * ```typescript
 * import { isCompletedPlan } from '@/lib/utils/planUtils';
 *
 * const completed = plans.filter(plan => isCompletedPlan(plan));
 * ```
 */
export const PLAN_COMPLETION_CRITERIA = {
  /**
   * 기본 완료 기준: status === 'completed'
   * 명시적 상태 완료
   */
  PRIMARY: "status",

  /**
   * 대체 완료 기준: actual_end_time이 설정됨
   * 타이머를 통해 플랜을 완료한 경우 (backward compatibility)
   */
  SECONDARY: "actual_end_time",

  /**
   * @deprecated progress 기반 완료 판별 제거됨. status 사용 권장.
   * 완료로 인정하는 최소 진행률
   */
  MIN_PROGRESS_FOR_COMPLETION: 100,
} as const;

// ============================================
// 비학습/자율학습 집계 정책
// ============================================

/**
 * 더미 콘텐츠(비학습/자율학습) 집계 정책
 * 
 * @see docs/refactoring/metrics_policy.md (예정)
 */
export const DUMMY_CONTENT_AGGREGATION_POLICY = {
  /**
   * 전체 플랜 수에 포함 여부
   */
  includeInTotalCount: true,

  /**
   * 완료율 계산에 포함 여부
   * false: 완료율 = 완료된 학습 플랜 / 전체 학습 플랜 (더미 제외)
   */
  includeInCompletionRate: false,

  /**
   * 학습 시간 집계에 포함 여부
   * false: 학습 시간에는 실제 학습만 포함
   */
  includeInStudyTime: false,

  /**
   * 타임라인 표시 여부
   */
  showInTimeline: true,
} as const;

// ============================================
// 타입 정의
// ============================================

/**
 * 더미 콘텐츠 ID 유니온 타입
 */
export type DummyContentId =
  | typeof DUMMY_NON_LEARNING_CONTENT_ID
  | typeof DUMMY_SELF_STUDY_CONTENT_ID;

