/**
 * WizardData와 PlanGroupCreationData 간 데이터 동기화 및 변환 유틸리티
 * 데이터 일관성을 보장하기 위한 중앙화된 변환 로직
 */

import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type { PlanGroupCreationData } from "@/lib/types/plan";
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

/**
 * WizardData를 PlanGroupCreationData로 변환
 * 데이터 일관성을 보장하고 중복 저장을 방지합니다.
 */
export function syncWizardDataToCreationData(
  wizardData: WizardData
): PlanGroupCreationData {
  try {
    // 1. scheduler_options 구성
    const schedulerOptions: Record<string, unknown> = {
      ...(wizardData.scheduler_options || {}),
    };

    // study_review_cycle을 scheduler_options에 병합
    if (wizardData.study_review_cycle) {
      schedulerOptions.study_days = wizardData.study_review_cycle.study_days;
      schedulerOptions.review_days = wizardData.study_review_cycle.review_days;
    } else if (wizardData.scheduler_options?.study_days || wizardData.scheduler_options?.review_days) {
      // scheduler_options에 이미 있는 경우 그대로 사용
      schedulerOptions.study_days = wizardData.scheduler_options.study_days;
      schedulerOptions.review_days = wizardData.scheduler_options.review_days;
    }

    // time_settings를 scheduler_options에 병합
    if (wizardData.time_settings) {
      Object.assign(schedulerOptions, wizardData.time_settings);
    }

    // 2. daily_schedule 유효성 검증 및 필터링
    const validatedDailySchedule = wizardData.daily_schedule?.filter(
      (schedule) => {
        try {
          const scheduleDate = new Date(schedule.date);
          const periodStart = new Date(wizardData.period_start);
          const periodEnd = new Date(wizardData.period_end);

          return (
            scheduleDate >= periodStart &&
            scheduleDate <= periodEnd &&
            schedule.study_hours >= 0
          );
        } catch {
          return false;
        }
      }
    );

    // 3. 콘텐츠 데이터 검증 및 변환
    const allContents = [
      ...wizardData.student_contents,
      ...wizardData.recommended_contents,
    ];

    // 중복 콘텐츠 검증
    const contentKeys = new Set<string>();
    const duplicateContents: string[] = [];
    
    allContents.forEach((content, index) => {
      const key = `${content.content_type}:${content.content_id}`;
      if (contentKeys.has(key)) {
        duplicateContents.push(`콘텐츠 ${index + 1}`);
      }
      contentKeys.add(key);
    });

    if (duplicateContents.length > 0) {
      throw new PlanGroupError(
        `중복된 콘텐츠가 있습니다: ${duplicateContents.join(', ')}`,
        PlanGroupErrorCodes.DATA_INCONSISTENCY,
        '중복된 콘텐츠가 선택되었습니다. 확인해주세요.',
        true
      );
    }

    // 4. PlanGroupCreationData 구성
    const creationData: PlanGroupCreationData = {
      name: wizardData.name || null,
      plan_purpose: wizardData.plan_purpose as any,
      scheduler_type: wizardData.scheduler_type as any,
      scheduler_options:
        Object.keys(schedulerOptions).length > 0 ? schedulerOptions : null,
      period_start: wizardData.period_start,
      period_end: wizardData.period_end,
      target_date: wizardData.target_date || null,
      block_set_id: wizardData.block_set_id || null,
      contents: allContents.map((c, idx) => ({
        content_type: c.content_type,
        content_id: c.content_id,
        start_range: c.start_range,
        end_range: c.end_range,
        display_order: idx,
      })),
      exclusions: wizardData.exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type,
        reason: e.reason || null,
      })),
      academy_schedules: wizardData.academy_schedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name || null,
        subject: s.subject || null,
        travel_time: s.travel_time,
      })),
      // 1730 Timetable 추가 필드
      study_review_cycle: wizardData.study_review_cycle,
      student_level: wizardData.student_level,
      subject_allocations: wizardData.subject_allocations,
      subject_constraints: wizardData.subject_constraints,
      additional_period_reallocation: wizardData.additional_period_reallocation,
      non_study_time_blocks: wizardData.non_study_time_blocks,
      // Step 2.5에서 생성된 일별 스케줄 정보
      daily_schedule: validatedDailySchedule || null,
    };

    return creationData;
  } catch (error) {
    if (error instanceof PlanGroupError) {
      throw error;
    }
    throw new PlanGroupError(
      `데이터 변환 실패: ${error instanceof Error ? error.message : String(error)}`,
      PlanGroupErrorCodes.DATA_TRANSFORMATION_FAILED,
      '데이터 변환 중 오류가 발생했습니다. 페이지를 새로고침해주세요.',
      false,
      { wizardData: JSON.stringify(wizardData) }
    );
  }
}

/**
 * PlanGroupCreationData (또는 PlanGroup + 관련 데이터)를 WizardData로 변환
 * 데이터베이스에서 조회한 플랜 그룹 데이터를 위저드에서 사용할 수 있는 형식으로 변환합니다.
 */
export function syncCreationDataToWizardData(data: {
  group: {
    id: string;
    name: string | null;
    plan_purpose: string | null;
    scheduler_type: string | null;
    scheduler_options?: any;
    period_start: string;
    period_end: string;
    target_date: string | null;
    block_set_id: string | null;
    daily_schedule?: any;
    subject_constraints?: any;
    additional_period_reallocation?: any;
    non_study_time_blocks?: any;
    study_hours?: any;
    self_study_hours?: any;
    plan_type?: string | null;
    camp_template_id?: string | null;
  };
  contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
    display_order: number;
    is_auto_recommended?: boolean;
    recommendation_source?: string | null;
    recommendation_reason?: string | null;
  }>;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason: string | null;
  }>;
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
    travel_time?: number | null;
  }>;
}): WizardData {
  try {
    const { group, contents, exclusions, academySchedules } = data;

    // scheduler_options에서 time_settings 추출
    const schedulerOptions = (group.scheduler_options as any) || {};
    const timeSettings: WizardData["time_settings"] = {
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.camp_self_study_hours,
      designated_holiday_hours: schedulerOptions.designated_holiday_hours,
      use_self_study_with_blocks: schedulerOptions.use_self_study_with_blocks,
      enable_self_study_for_holidays: schedulerOptions.enable_self_study_for_holidays,
      enable_self_study_for_study_days: schedulerOptions.enable_self_study_for_study_days,
    };

    // time_settings 필드 중 하나라도 값이 있으면 포함
    const hasTimeSettings =
      timeSettings.lunch_time !== undefined ||
      timeSettings.camp_study_hours !== undefined ||
      timeSettings.camp_self_study_hours !== undefined ||
      timeSettings.designated_holiday_hours !== undefined ||
      timeSettings.use_self_study_with_blocks !== undefined ||
      timeSettings.enable_self_study_for_holidays !== undefined ||
      timeSettings.enable_self_study_for_study_days !== undefined;

    // scheduler_options에서 time_settings 필드 제거
    const {
      lunch_time,
      camp_study_hours,
      camp_self_study_hours,
      designated_holiday_hours,
      use_self_study_with_blocks,
      enable_self_study_for_holidays,
      enable_self_study_for_study_days,
      study_days,
      review_days,
      student_level,
      subject_allocations,
      ...schedulerOptionsWithoutTimeSettings
    } = schedulerOptions;

    // 콘텐츠 분류: is_auto_recommended가 true이거나 recommendation_source가 있는 경우 추천 콘텐츠
    const studentContents: WizardData["student_contents"] = [];
    const recommendedContents: WizardData["recommended_contents"] = [];

    contents.forEach((c) => {
      const contentItem = {
        content_type: c.content_type as "book" | "lecture",
        content_id: c.content_id,
        start_range: c.start_range,
        end_range: c.end_range,
      };

      if (c.is_auto_recommended || c.recommendation_source) {
        recommendedContents.push({
          ...contentItem,
          is_auto_recommended: c.is_auto_recommended ?? false,
          recommendation_source: c.recommendation_source ?? null,
          recommendation_reason: c.recommendation_reason ?? null,
        } as any);
      } else {
        studentContents.push(contentItem);
      }
    });

    // WizardData 구성
    const wizardData: WizardData = {
      name: group.name || "",
      plan_purpose: (group.plan_purpose as any) || "",
      scheduler_type: (group.scheduler_type as any) || "",
      scheduler_options:
        Object.keys(schedulerOptionsWithoutTimeSettings).length > 0
          ? schedulerOptionsWithoutTimeSettings
          : undefined,
      period_start: group.period_start,
      period_end: group.period_end,
      target_date: group.target_date || undefined,
      block_set_id: group.block_set_id || "",
      exclusions: exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as any,
        reason: e.reason || undefined,
      })),
      academy_schedules: academySchedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name || undefined,
        subject: s.subject || undefined,
        travel_time: s.travel_time || undefined,
      })),
      time_settings: hasTimeSettings ? timeSettings : undefined,
      student_contents: studentContents,
      recommended_contents: recommendedContents,
      // 1730 Timetable 추가 필드
      study_review_cycle:
        study_days || review_days
          ? {
              study_days: study_days || 6,
              review_days: review_days || 1,
            }
          : undefined,
      student_level: student_level,
      subject_allocations: subject_allocations,
      subject_constraints: group.subject_constraints || undefined,
      additional_period_reallocation: group.additional_period_reallocation || undefined,
      non_study_time_blocks: group.non_study_time_blocks || undefined,
      daily_schedule: group.daily_schedule || undefined,
    };

    return wizardData;
  } catch (error) {
    throw new PlanGroupError(
      `데이터 변환 실패: ${error instanceof Error ? error.message : String(error)}`,
      PlanGroupErrorCodes.DATA_TRANSFORMATION_FAILED,
      "데이터 변환 중 오류가 발생했습니다. 페이지를 새로고침해주세요.",
      false,
      { data: JSON.stringify(data) }
    );
  }
}

/**
 * 데이터 일관성 검증
 */
export function validateDataConsistency(
  wizardData: WizardData
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. 기간 검증
  if (wizardData.period_start && wizardData.period_end) {
    const start = new Date(wizardData.period_start);
    const end = new Date(wizardData.period_end);
    if (start >= end) {
      errors.push('시작일은 종료일보다 이전이어야 합니다.');
    }
  }

  // 2. daily_schedule과 period 일치 검증
  if (wizardData.daily_schedule) {
    const invalidSchedules = wizardData.daily_schedule.filter((schedule) => {
      const scheduleDate = new Date(schedule.date);
      const periodStart = new Date(wizardData.period_start);
      const periodEnd = new Date(wizardData.period_end);
      return scheduleDate < periodStart || scheduleDate > periodEnd;
    });

    if (invalidSchedules.length > 0) {
      errors.push(
        `${invalidSchedules.length}개의 스케줄이 플랜 기간 밖에 있습니다.`
      );
    }
  }

  // 3. study_review_cycle과 scheduler_options 일치 검증
  if (wizardData.scheduler_type === '1730_timetable') {
    const studyDays =
      wizardData.study_review_cycle?.study_days ||
      wizardData.scheduler_options?.study_days;
    const reviewDays =
      wizardData.study_review_cycle?.review_days ||
      wizardData.scheduler_options?.review_days;

    if (studyDays && reviewDays) {
      if (studyDays + reviewDays > 7) {
        errors.push('학습일 수와 복습일 수의 합은 7일 이하여야 합니다.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

