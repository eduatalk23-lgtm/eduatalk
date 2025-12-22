/**
 * PlanGenerationContext
 *
 * 플랜 생성 파이프라인의 모드별 설정을 통합 관리하는 컨텍스트 모듈
 * - 캠프 모드와 일반 모드의 설정 차이를 추상화
 * - 모드 감지 로직 통합
 * - 설정 병합 로직 표준화
 */

import type { NonStudyTimeBlock } from "@/lib/types/plan";

/**
 * 플랜 생성 모드
 */
export type PlanGenerationMode = "normal" | "camp" | "template";

/**
 * 시간 범위 타입
 */
export interface TimeRange {
  start: string;
  end: string;
}

// NonStudyTimeBlock은 lib/types/plan에서 import하여 재사용
export type { NonStudyTimeBlock };

/**
 * 스케줄러 설정
 */
export interface SchedulerSettings {
  /** 학습일 수 */
  studyDays: number;
  /** 복습일 수 */
  reviewDays: number;
  /** 취약 과목 집중 설정 */
  weakSubjectFocus: "low" | "medium" | "high" | boolean;
  /** 복습 범위 */
  reviewScope?: string;
  /** 점심 시간 */
  lunchTime?: TimeRange;
  /** 캠프 학습 시간 (캠프 모드에서만 사용) */
  campStudyHours?: TimeRange;
  /** 자기주도 학습 시간 */
  selfStudyHours?: TimeRange;
  /** 캠프 자기주도 학습 시간 (캠프 모드에서만 사용) */
  campSelfStudyHours?: TimeRange;
  /** 지정 휴일 학습 시간 */
  designatedHolidayHours?: TimeRange;
  /** 비학습 시간 블록 */
  nonStudyTimeBlocks?: NonStudyTimeBlock[];
}

/**
 * 블록 설정
 */
export interface BlockSettings {
  /** 블록 사용 여부 */
  useBlocks: boolean;
  /** 자기주도 학습과 블록 함께 사용 */
  useSelfStudyWithBlocks: boolean;
  /** 휴일에 자기주도 학습 활성화 */
  enableSelfStudyForHolidays: boolean;
  /** 학습일에 자기주도 학습 활성화 */
  enableSelfStudyForStudyDays: boolean;
}

/**
 * 플랜 생성 컨텍스트
 *
 * 플랜 생성에 필요한 모든 모드별 설정을 포함
 */
export interface PlanGenerationContext {
  /** 플랜 생성 모드 */
  mode: PlanGenerationMode;

  /** 캠프 모드 여부 (편의 프로퍼티) */
  isCampMode: boolean;

  /** 템플릿 모드 여부 (편의 프로퍼티) */
  isTemplateMode: boolean;

  /** 캠프 템플릿 ID (캠프 모드일 때만 존재) */
  campTemplateId?: string;

  /** 테넌트 ID */
  tenantId: string;

  /** 학생 ID */
  studentId: string;

  /** 플랜 그룹 ID */
  planGroupId: string;

  /** 스케줄러 타입 */
  schedulerType: "1730_timetable" | "default";

  /** 스케줄러 설정 */
  schedulerSettings: SchedulerSettings;

  /** 블록 설정 */
  blockSettings: BlockSettings;

  /** 기간 */
  period: {
    start: string;
    end: string;
  };
}

/**
 * 플랜 그룹에서 모드 감지
 *
 * @param planGroup - 플랜 그룹 데이터
 * @returns 플랜 생성 모드
 */
export function detectPlanGenerationMode(planGroup: {
  camp_template_id?: string | null;
  plan_type?: string | null;
}): PlanGenerationMode {
  // 캠프 템플릿 ID가 있으면 캠프 모드
  if (planGroup.camp_template_id) {
    return "camp";
  }

  // plan_type이 template이면 템플릿 모드
  if (planGroup.plan_type === "template") {
    return "template";
  }

  // 기본은 일반 모드
  return "normal";
}

/**
 * 캠프 모드인지 확인
 *
 * 다음 조건 중 하나라도 해당하면 캠프 모드:
 * - plan_type이 "camp"
 * - camp_template_id가 존재
 * - camp_invitation_id가 존재
 *
 * @param planGroup - 플랜 그룹 데이터
 * @returns 캠프 모드 여부
 */
export function isCampMode(planGroup: {
  plan_type?: string | null;
  camp_template_id?: string | null;
  camp_invitation_id?: string | null;
}): boolean {
  return (
    planGroup.plan_type === "camp" ||
    !!planGroup.camp_template_id ||
    !!planGroup.camp_invitation_id
  );
}

/**
 * 템플릿 모드인지 확인
 *
 * @param planGroup - 플랜 그룹 데이터
 * @returns 템플릿 모드 여부
 */
export function isTemplateMode(planGroup: {
  plan_type?: string | null;
}): boolean {
  return planGroup.plan_type === "template";
}

/**
 * 플랜 그룹 데이터 타입 (컨텍스트 생성에 필요한 최소 필드)
 */
export interface PlanGroupData {
  id: string;
  tenant_id: string;
  student_id: string;
  camp_template_id?: string | null;
  plan_type?: string | null;
  scheduler_type?: string | null;
  period_start: string;
  period_end: string;
  scheduler_options?: Record<string, unknown> | null;
}

/**
 * 병합된 스케줄러 설정 타입 (getMergedSchedulerSettings 반환 타입)
 */
export interface MergedSchedulerSettingsInput {
  study_review_ratio: {
    study_days: number;
    review_days: number;
  };
  weak_subject_focus?: "low" | "medium" | "high" | boolean;
  review_scope?: string;
  lunch_time?: TimeRange;
  study_hours?: TimeRange;
  self_study_hours?: TimeRange;
}

/**
 * 플랜 생성 컨텍스트 생성
 *
 * @param planGroup - 플랜 그룹 데이터
 * @param mergedSettings - 병합된 스케줄러 설정
 * @param groupSchedulerOptions - 그룹별 스케줄러 옵션
 * @returns 플랜 생성 컨텍스트
 *
 * @example
 * ```typescript
 * const context = createPlanGenerationContext(
 *   group,
 *   await getMergedSchedulerSettings(group.tenant_id, group.camp_template_id),
 *   getSchedulerOptionsWithTimeSettings(group)
 * );
 *
 * if (context.isCampMode) {
 *   // 캠프 모드 특화 로직
 * }
 * ```
 */
export function createPlanGenerationContext(
  planGroup: PlanGroupData,
  mergedSettings: MergedSchedulerSettingsInput,
  groupSchedulerOptions?: {
    use_self_study_with_blocks?: boolean;
    enable_self_study_for_holidays?: boolean;
    enable_self_study_for_study_days?: boolean;
    camp_self_study_hours?: TimeRange;
    designated_holiday_hours?: TimeRange;
    non_study_time_blocks?: NonStudyTimeBlock[];
  }
): PlanGenerationContext {
  const mode = detectPlanGenerationMode(planGroup);

  return {
    mode,
    isCampMode: mode === "camp",
    isTemplateMode: mode === "template",
    campTemplateId: planGroup.camp_template_id || undefined,
    tenantId: planGroup.tenant_id,
    studentId: planGroup.student_id,
    planGroupId: planGroup.id,
    schedulerType:
      (planGroup.scheduler_type as "1730_timetable" | "default") ||
      "1730_timetable",
    schedulerSettings: {
      studyDays: mergedSettings.study_review_ratio.study_days,
      reviewDays: mergedSettings.study_review_ratio.review_days,
      weakSubjectFocus: mergedSettings.weak_subject_focus ?? false,
      reviewScope: mergedSettings.review_scope,
      lunchTime: mergedSettings.lunch_time,
      campStudyHours: mergedSettings.study_hours,
      selfStudyHours: mergedSettings.self_study_hours,
      campSelfStudyHours: groupSchedulerOptions?.camp_self_study_hours,
      designatedHolidayHours: groupSchedulerOptions?.designated_holiday_hours,
      nonStudyTimeBlocks: groupSchedulerOptions?.non_study_time_blocks,
    },
    blockSettings: {
      useBlocks: true, // 기본값
      useSelfStudyWithBlocks:
        groupSchedulerOptions?.use_self_study_with_blocks ?? false,
      enableSelfStudyForHolidays:
        groupSchedulerOptions?.enable_self_study_for_holidays ?? false,
      enableSelfStudyForStudyDays:
        groupSchedulerOptions?.enable_self_study_for_study_days ?? false,
    },
    period: {
      start: planGroup.period_start,
      end: planGroup.period_end,
    },
  };
}

/**
 * 컨텍스트에서 스케줄러 옵션 추출 (기존 API 호환용)
 *
 * @param context - 플랜 생성 컨텍스트
 * @returns 스케줄러 옵션 객체
 */
export function extractSchedulerOptions(context: PlanGenerationContext): {
  study_days: number;
  review_days: number;
  weak_subject_focus: "low" | "medium" | "high" | boolean;
  review_scope?: string;
  lunch_time?: TimeRange;
  camp_study_hours?: TimeRange;
  self_study_hours?: TimeRange;
} {
  return {
    study_days: context.schedulerSettings.studyDays,
    review_days: context.schedulerSettings.reviewDays,
    weak_subject_focus: context.schedulerSettings.weakSubjectFocus,
    review_scope: context.schedulerSettings.reviewScope,
    lunch_time: context.schedulerSettings.lunchTime,
    camp_study_hours: context.schedulerSettings.campStudyHours,
    self_study_hours: context.schedulerSettings.selfStudyHours,
  };
}

/**
 * 컨텍스트에서 스케줄 계산 옵션 추출
 *
 * @param context - 플랜 생성 컨텍스트
 * @returns 스케줄 계산 옵션
 */
export function extractScheduleCalculationOptions(
  context: PlanGenerationContext
): {
  scheduler_type: "1730_timetable" | "default";
  scheduler_options: {
    study_days: number;
    review_days: number;
  };
  use_self_study_with_blocks: boolean;
  enable_self_study_for_holidays: boolean;
  enable_self_study_for_study_days: boolean;
  lunch_time?: TimeRange;
  camp_study_hours?: TimeRange;
  camp_self_study_hours?: TimeRange;
  designated_holiday_hours?: TimeRange;
  non_study_time_blocks?: NonStudyTimeBlock[];
} {
  return {
    scheduler_type: context.schedulerType,
    scheduler_options: {
      study_days: context.schedulerSettings.studyDays,
      review_days: context.schedulerSettings.reviewDays,
    },
    use_self_study_with_blocks: context.blockSettings.useSelfStudyWithBlocks,
    enable_self_study_for_holidays:
      context.blockSettings.enableSelfStudyForHolidays,
    enable_self_study_for_study_days:
      context.blockSettings.enableSelfStudyForStudyDays,
    lunch_time: context.schedulerSettings.lunchTime,
    camp_study_hours: context.schedulerSettings.campStudyHours,
    camp_self_study_hours: context.schedulerSettings.campSelfStudyHours,
    designated_holiday_hours: context.schedulerSettings.designatedHolidayHours,
    non_study_time_blocks: context.schedulerSettings.nonStudyTimeBlocks,
  };
}
