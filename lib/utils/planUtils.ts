/**
 * 플랜 관련 유틸리티 함수
 * @module lib/utils/planUtils
 * @see docs/refactoring/03_phase_todo_list.md [P1-4], [P1-8]
 */

import {
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_SELF_STUDY_CONTENT_ID,
  DUMMY_CONTENT_IDS,
  DUMMY_CONTENT_METADATA,
  PLAN_COMPLETION_CRITERIA,
  DUMMY_CONTENT_AGGREGATION_POLICY,
  type DummyContentId,
} from "@/lib/constants/plan";

// ============================================
// 더미 콘텐츠 판별 함수
// ============================================

/**
 * 주어진 content_id가 더미 콘텐츠인지 확인
 *
 * @param contentId - 확인할 콘텐츠 ID
 * @returns 더미 콘텐츠 여부
 *
 * @example
 * ```typescript
 * if (isDummyContent(plan.content_id)) {
 *   // 더미 콘텐츠 처리
 * }
 * ```
 */
export function isDummyContent(
  contentId: string | null | undefined
): contentId is DummyContentId {
  if (!contentId) return false;
  return (DUMMY_CONTENT_IDS as readonly string[]).includes(contentId);
}

/**
 * 주어진 content_id가 비학습 항목인지 확인
 *
 * @param contentId - 확인할 콘텐츠 ID
 * @returns 비학습 항목 여부
 */
export function isNonLearningContent(
  contentId: string | null | undefined
): boolean {
  return contentId === DUMMY_NON_LEARNING_CONTENT_ID;
}

/**
 * 주어진 content_id가 자율학습 항목인지 확인
 *
 * @param contentId - 확인할 콘텐츠 ID
 * @returns 자율학습 항목 여부
 */
export function isSelfStudyContent(
  contentId: string | null | undefined
): boolean {
  return contentId === DUMMY_SELF_STUDY_CONTENT_ID;
}

/**
 * 더미 콘텐츠의 메타데이터 반환
 *
 * @param contentId - 콘텐츠 ID
 * @returns 더미 콘텐츠 메타데이터 또는 null
 */
export function getDummyContentMetadata(contentId: string | null | undefined) {
  if (!contentId || !isDummyContent(contentId)) return null;
  return DUMMY_CONTENT_METADATA[contentId];
}

// ============================================
// 플랜 완료 판별 함수
// ============================================

/**
 * 플랜 완료 판별에 필요한 최소 필드
 */
export type PlanCompletionFields = {
  actual_end_time?: string | null;
  status?: string | null;
  /** @deprecated Use status instead */
  progress?: number | null;
};

/**
 * 주어진 플랜이 완료되었는지 확인
 *
 * 완료 기준 (OR 조건, 우선순위 순):
 * 1. status === 'completed' (명시적 상태 완료)
 * 2. actual_end_time이 설정됨 (타이머 완료)
 *
 * @param plan - 확인할 플랜 (status, actual_end_time 필드 포함)
 * @returns 완료 여부
 *
 * @example
 * ```typescript
 * const completedPlans = plans.filter(plan => isCompletedPlan(plan));
 * const completionRate = completedPlans.length / plans.length;
 * ```
 */
export function isCompletedPlan(plan: PlanCompletionFields): boolean {
  // 기본 기준: status === 'completed'
  if (plan.status === "completed") {
    return true;
  }

  // 대체 기준: actual_end_time 설정됨 (backward compatibility)
  if (plan.actual_end_time !== null && plan.actual_end_time !== undefined) {
    return true;
  }

  return false;
}

/**
 * 학습 플랜만 필터링 (더미 콘텐츠 제외)
 *
 * @param plans - 플랜 배열
 * @returns 학습 플랜만 포함된 배열
 *
 * @example
 * ```typescript
 * const learningPlans = filterLearningPlans(allPlans);
 * ```
 */
export function filterLearningPlans<
  T extends { content_id?: string | null }
>(plans: T[]): T[] {
  return plans.filter((plan) => !isDummyContent(plan.content_id));
}

/**
 * 완료된 학습 플랜 수 계산 (더미 콘텐츠 제외)
 *
 * @param plans - 플랜 배열
 * @returns 완료된 학습 플랜 수
 */
export function countCompletedLearningPlans<
  T extends PlanCompletionFields & { content_id?: string | null }
>(plans: T[]): number {
  if (!DUMMY_CONTENT_AGGREGATION_POLICY.includeInCompletionRate) {
    // 더미 콘텐츠 제외
    return plans.filter(
      (plan) => !isDummyContent(plan.content_id) && isCompletedPlan(plan)
    ).length;
  }

  // 더미 콘텐츠 포함
  return plans.filter((plan) => isCompletedPlan(plan)).length;
}

/**
 * 학습 플랜 완료율 계산
 *
 * @param plans - 플랜 배열
 * @returns 완료율 (0-100)
 */
export function calculateCompletionRate<
  T extends PlanCompletionFields & { content_id?: string | null }
>(plans: T[]): number {
  let totalPlans: T[];
  let completedCount: number;

  if (!DUMMY_CONTENT_AGGREGATION_POLICY.includeInCompletionRate) {
    // 더미 콘텐츠 제외
    totalPlans = filterLearningPlans(plans);
    completedCount = totalPlans.filter((plan) => isCompletedPlan(plan)).length;
  } else {
    // 더미 콘텐츠 포함
    totalPlans = plans;
    completedCount = plans.filter((plan) => isCompletedPlan(plan)).length;
  }

  if (totalPlans.length === 0) return 0;
  return Math.round((completedCount / totalPlans.length) * 100);
}

// ============================================
// 상수 재내보내기 (편의성)
// ============================================

export {
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_SELF_STUDY_CONTENT_ID,
  DUMMY_CONTENT_IDS,
  DUMMY_CONTENT_METADATA,
  PLAN_COMPLETION_CRITERIA,
  DUMMY_CONTENT_AGGREGATION_POLICY,
};

