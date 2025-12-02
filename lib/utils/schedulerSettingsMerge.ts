/**
 * 스케줄러 설정 병합 유틸리티
 * 
 * 전역(기관) → 템플릿 → 플랜그룹 순으로 설정 병합
 * 하위 레벨 설정이 상위 레벨을 오버라이드
 */

import {
  DEFAULT_SCHEDULER_SETTINGS,
  type SchedulerSettings,
  type PartialSchedulerSettings,
  type StudyReviewRatio,
} from "@/lib/types/schedulerSettings";

/**
 * 두 개의 부분 설정을 병합
 * target이 source를 오버라이드
 */
function mergePartialSettings(
  source: PartialSchedulerSettings,
  target: PartialSchedulerSettings
): PartialSchedulerSettings {
  return {
    ...source,
    ...target,
    // study_review_ratio는 개별 필드 병합
    study_review_ratio: {
      ...(source.study_review_ratio || {}),
      ...(target.study_review_ratio || {}),
    },
  };
}

/**
 * 전역 → 템플릿 → 플랜그룹 순으로 설정 병합
 * 
 * @param globalSettings 전역 설정 (tenant_scheduler_settings)
 * @param templateSettings 템플릿 설정 (camp_templates.template_data.scheduler_settings)
 * @param groupSettings 플랜그룹 설정 (plan_groups.scheduler_options)
 * @returns 병합된 최종 설정
 */
export function mergeSchedulerSettings(
  globalSettings: PartialSchedulerSettings | null,
  templateSettings: PartialSchedulerSettings | null,
  groupSettings: PartialSchedulerSettings | null
): SchedulerSettings {
  // 1. 기본값으로 시작
  let merged: PartialSchedulerSettings = { ...DEFAULT_SCHEDULER_SETTINGS };

  // 2. 전역 설정 병합
  if (globalSettings) {
    merged = mergePartialSettings(merged, globalSettings);
  }

  // 3. 템플릿 설정 병합
  if (templateSettings) {
    merged = mergePartialSettings(merged, templateSettings);
  }

  // 4. 플랜그룹 설정 병합
  if (groupSettings) {
    merged = mergePartialSettings(merged, groupSettings);
  }

  // 5. 최종 타입 보장 (study_review_ratio는 필수)
  return {
    study_review_ratio: {
      study_days:
        merged.study_review_ratio?.study_days ||
        DEFAULT_SCHEDULER_SETTINGS.study_review_ratio.study_days,
      review_days:
        merged.study_review_ratio?.review_days ||
        DEFAULT_SCHEDULER_SETTINGS.study_review_ratio.review_days,
    },
    weak_subject_focus:
      merged.weak_subject_focus ||
      DEFAULT_SCHEDULER_SETTINGS.weak_subject_focus,
    review_scope: merged.review_scope || DEFAULT_SCHEDULER_SETTINGS.review_scope,
    lunch_time: merged.lunch_time || DEFAULT_SCHEDULER_SETTINGS.lunch_time,
    study_hours: merged.study_hours || DEFAULT_SCHEDULER_SETTINGS.study_hours,
    self_study_hours: merged.self_study_hours,
  };
}

/**
 * TenantSchedulerSettings DB 레코드를 PartialSchedulerSettings로 변환
 */
export function dbToPartialSettings(
  dbSettings: {
    default_study_days: number;
    default_review_days: number;
    default_weak_subject_focus?: string;
    default_review_scope?: string;
    default_lunch_time?: { start: string; end: string };
    default_study_hours?: { start: string; end: string };
    default_self_study_hours?: { start: string; end: string };
  } | null
): PartialSchedulerSettings | null {
  if (!dbSettings) return null;

  return {
    study_review_ratio: {
      study_days: dbSettings.default_study_days,
      review_days: dbSettings.default_review_days,
    },
    weak_subject_focus: dbSettings.default_weak_subject_focus as
      | "low"
      | "medium"
      | "high"
      | undefined,
    review_scope: dbSettings.default_review_scope as "full" | "partial" | undefined,
    lunch_time: dbSettings.default_lunch_time,
    study_hours: dbSettings.default_study_hours,
    self_study_hours: dbSettings.default_self_study_hours,
  };
}

/**
 * PlanGroup scheduler_options를 PartialSchedulerSettings로 변환
 */
export function planGroupOptionsToPartialSettings(options: {
  study_days?: number;
  review_days?: number;
  weak_subject_focus?: string | boolean;
  review_scope?: string;
  lunch_time?: { start: string; end: string };
  camp_study_hours?: { start: string; end: string };
  self_study_hours?: { start: string; end: string };
} | null): PartialSchedulerSettings | null {
  if (!options) return null;

  const partial: PartialSchedulerSettings = {};

  if (options.study_days !== undefined || options.review_days !== undefined) {
    partial.study_review_ratio = {} as StudyReviewRatio;
    if (options.study_days !== undefined) {
      partial.study_review_ratio.study_days = options.study_days;
    }
    if (options.review_days !== undefined) {
      partial.study_review_ratio.review_days = options.review_days;
    }
  }

  if (options.weak_subject_focus !== undefined) {
    partial.weak_subject_focus = options.weak_subject_focus as
      | "low"
      | "medium"
      | "high"
      | boolean;
  }

  if (options.review_scope !== undefined) {
    partial.review_scope = options.review_scope as "full" | "partial";
  }

  if (options.lunch_time) {
    partial.lunch_time = options.lunch_time;
  }

  // camp_study_hours는 study_hours로 매핑
  if (options.camp_study_hours) {
    partial.study_hours = options.camp_study_hours;
  }

  if (options.self_study_hours) {
    partial.self_study_hours = options.self_study_hours;
  }

  return Object.keys(partial).length > 0 ? partial : null;
}

/**
 * SchedulerSettings를 PlanGroup scheduler_options 형식으로 변환
 */
export function settingsToPlanGroupOptions(settings: SchedulerSettings) {
  return {
    study_days: settings.study_review_ratio.study_days,
    review_days: settings.study_review_ratio.review_days,
    weak_subject_focus: settings.weak_subject_focus,
    review_scope: settings.review_scope,
    lunch_time: settings.lunch_time,
    camp_study_hours: settings.study_hours,
    self_study_hours: settings.self_study_hours,
  };
}

