/**
 * AI Framework 유틸리티 함수
 *
 * DB 저장 및 변환을 위한 헬퍼 함수들입니다.
 *
 * @module lib/domains/plan/llm/utils/frameworkUtils
 */

import type {
  AIRecommendations,
  FrameworkConversionResult,
} from "../types/aiFramework";

/**
 * 프레임워크 결과에서 스케줄러 옵션만 추출
 *
 * plan_groups 테이블에 저장하기 위한 형식으로 변환합니다.
 */
export function extractSchedulerOptionsForDB(
  conversionResult: FrameworkConversionResult
): Record<string, unknown> {
  const { schedulerOptions } = conversionResult;

  return {
    weak_subject_focus: schedulerOptions.weak_subject_focus,
    study_days: schedulerOptions.study_days,
    review_days: schedulerOptions.review_days,
    subject_allocations: schedulerOptions.subject_allocations,
    content_allocations: schedulerOptions.content_allocations,
    // AI 생성 표시
    _generated_by: "ai_framework",
    _generated_at: new Date().toISOString(),
  };
}

/**
 * AI 추천사항을 plan_groups.meta에 저장하기 위한 형식으로 변환
 */
export function extractRecommendationsForDB(
  recommendations: AIRecommendations
): Record<string, unknown> {
  return {
    ai_study_tips: recommendations.studyTips,
    ai_warnings: recommendations.warnings,
    ai_suggested_adjustments: recommendations.suggestedAdjustments,
    ai_focus_areas: recommendations.focusAreas,
    ai_motivational_notes: recommendations.motivationalNotes,
  };
}

/**
 * 콘텐츠 정렬 순서 맵을 배열로 변환 (DB 저장용)
 */
export function extractContentOrderingForDB(
  contentOrdering: Map<string, number>
): Array<{ contentId: string; order: number }> {
  return Array.from(contentOrdering.entries())
    .map(([contentId, order]) => ({ contentId, order }))
    .sort((a, b) => a.order - b.order);
}
