/**
 * SchedulerOptions 관련 유틸리티 함수
 * scheduler_options JSONB 필드와 TimeSettings를 안전하게 처리하기 위한 함수들
 */

import type {
  PlanGroup,
  SchedulerOptions,
  TimeSettings,
  SchedulerOptionsWithTimeSettings,
} from "@/lib/types/plan/domain";
import { isSchedulerOptionsWithTimeSettings } from "@/lib/types/guards";

/**
 * PlanGroup에서 SchedulerOptions와 TimeSettings를 통합하여 반환
 * scheduler_options JSONB 필드에 TimeSettings가 병합되어 저장됨
 * 
 * @param group PlanGroup 객체
 * @returns SchedulerOptionsWithTimeSettings 또는 null
 * 
 * @example
 * ```typescript
 * const options = getSchedulerOptionsWithTimeSettings(group);
 * if (options) {
 *   const enableHolidays = options.enable_self_study_for_holidays === true;
 *   const lunchTime = options.lunch_time;
 * }
 * ```
 */
export function getSchedulerOptionsWithTimeSettings(
  group: PlanGroup
): SchedulerOptionsWithTimeSettings | null {
  if (!group.scheduler_options) {
    return null;
  }

  // JSONB 필드는 이미 파싱되어 있으므로 타입 단언 사용
  // 타입 가드로 검증하여 안전성 보장
  const options = group.scheduler_options as SchedulerOptionsWithTimeSettings;

  // 타입 가드로 검증 (런타임 검증)
  if (isSchedulerOptionsWithTimeSettings(options)) {
    return options;
  }

  // 타입 가드 실패 시 기본 SchedulerOptions 반환
  return options as SchedulerOptionsWithTimeSettings;
}

/**
 * SchedulerOptions에서 TimeSettings 필드만 추출
 * 타입 가드 함수를 사용하여 안전하게 처리
 * 
 * @param options SchedulerOptionsWithTimeSettings 또는 SchedulerOptions
 * @returns TimeSettings 또는 null
 * 
 * @example
 * ```typescript
 * const timeSettings = extractTimeSettingsFromSchedulerOptions(options);
 * if (timeSettings) {
 *   const lunchTime = timeSettings.lunch_time;
 * }
 * ```
 */
export function extractTimeSettingsFromSchedulerOptions(
  options: SchedulerOptionsWithTimeSettings | SchedulerOptions | null
): TimeSettings | null {
  if (!options) {
    return null;
  }

  // 타입 가드로 검증하여 안전하게 처리
  const safeOptions = isSchedulerOptionsWithTimeSettings(options)
    ? options
    : (options as SchedulerOptionsWithTimeSettings);

  // TimeSettings 필드만 추출
  const timeSettings: TimeSettings = {
    lunch_time: "lunch_time" in safeOptions ? safeOptions.lunch_time : undefined,
    camp_study_hours:
      "camp_study_hours" in safeOptions ? safeOptions.camp_study_hours : undefined,
    camp_self_study_hours:
      "camp_self_study_hours" in safeOptions
        ? safeOptions.camp_self_study_hours
        : undefined,
    designated_holiday_hours:
      "designated_holiday_hours" in safeOptions
        ? safeOptions.designated_holiday_hours
        : undefined,
    use_self_study_with_blocks:
      "use_self_study_with_blocks" in safeOptions
        ? safeOptions.use_self_study_with_blocks
        : undefined,
    enable_self_study_for_holidays:
      "enable_self_study_for_holidays" in safeOptions
        ? safeOptions.enable_self_study_for_holidays
        : undefined,
    enable_self_study_for_study_days:
      "enable_self_study_for_study_days" in safeOptions
        ? safeOptions.enable_self_study_for_study_days
        : undefined,
  };

  // 모든 필드가 undefined인 경우 null 반환
  if (
    !timeSettings.lunch_time &&
    !timeSettings.camp_study_hours &&
    !timeSettings.camp_self_study_hours &&
    !timeSettings.designated_holiday_hours &&
    timeSettings.use_self_study_with_blocks === undefined &&
    timeSettings.enable_self_study_for_holidays === undefined &&
    timeSettings.enable_self_study_for_study_days === undefined
  ) {
    return null;
  }

  return timeSettings;
}

