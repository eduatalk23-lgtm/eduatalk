/**
 * 스케줄러 옵션 병합 유틸리티
 * time_settings 병합 시 보호 필드를 안전하게 처리합니다.
 */

/**
 * 병합 시 보호해야 할 필드 목록
 * 이 필드들은 time_settings 병합 시 덮어쓰이지 않도록 보호됩니다.
 */
const PROTECTED_FIELDS = ["template_block_set_id", "camp_template_id"];

/**
 * time_settings를 scheduler_options에 안전하게 병합합니다.
 * 보호 필드는 병합 후에도 유지됩니다.
 *
 * @param schedulerOptions - 기존 scheduler_options 객체
 * @param timeSettings - 병합할 time_settings 객체 (null 또는 undefined 가능)
 * @returns 병합된 scheduler_options 객체
 */
export function mergeTimeSettingsSafely(
  schedulerOptions: Record<string, any>,
  timeSettings: Record<string, any> | null | undefined
): Record<string, any> {
  if (!timeSettings) {
    return schedulerOptions;
  }

  // 보호 필드 추출 (schedulerOptions에 존재하는 경우만)
  const protected = Object.fromEntries(
    PROTECTED_FIELDS
      .filter((key) => schedulerOptions[key] !== undefined)
      .map((key) => [key, schedulerOptions[key]])
  );

  // 병합 (보호 필드 제외)
  const merged = {
    ...schedulerOptions,
    ...timeSettings,
    ...protected, // 보호 필드 재적용
  };

  return merged;
}

/**
 * study_review_cycle을 scheduler_options에 병합합니다.
 *
 * @param schedulerOptions - 기존 scheduler_options 객체
 * @param studyReviewCycle - 병합할 study_review_cycle 객체 (null 또는 undefined 가능)
 * @returns 병합된 scheduler_options 객체
 */
export function mergeStudyReviewCycle(
  schedulerOptions: Record<string, any>,
  studyReviewCycle: { study_days: number; review_days: number } | null | undefined
): Record<string, any> {
  if (!studyReviewCycle) {
    return schedulerOptions;
  }

  return {
    ...schedulerOptions,
    study_days: studyReviewCycle.study_days,
    review_days: studyReviewCycle.review_days,
  };
}

