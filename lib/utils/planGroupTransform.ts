/**
 * 플랜 그룹 데이터 변환 유틸리티
 * 
 * 데이터베이스의 PlanGroup 형식을 WizardData 형식으로 변환하는 함수들
 */

import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule, SchedulerOptions, TimeSettings } from "@/lib/types/plan";
import type { ContentDetail } from "@/lib/data/planContents";
import { classifyPlanContents } from "@/lib/data/planContents";
import { logError } from "@/lib/errors/handler";

/**
 * 변환 과정에서 필요한 외부 의존성 데이터
 * 
 * 이 타입은 의존성 주입 패턴을 적용하기 위해 정의되었습니다.
 * 외부에서 필요한 데이터를 주입받아 순수 함수로 변환할 수 있도록 합니다.
 */
export type TransformationContext = {
  // 콘텐츠 분류 결과 (외부에서 주입)
  classifiedContents?: {
    studentContents: Array<ContentDetail>;
    recommendedContents: Array<ContentDetail>;
  };
  
  // 캠프 템플릿 데이터 (외부에서 주입)
  templateData?: {
    exclusions?: Array<{ exclusion_date: string }>;
    academySchedules?: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
    blockSetId?: string;
  };
};

/**
 * WizardData 타입 (PlanGroupWizard에서 사용)
 */
export type PartialWizardData = {
  groupId?: string;
  name: string;
  plan_purpose: string;
  scheduler_type: string;
  scheduler_options?: SchedulerOptions;
  time_settings?: {
    lunch_time?: { start: string; end: string };
    camp_study_hours?: { start: string; end: string };
    camp_self_study_hours?: { start: string; end: string };
    designated_holiday_hours?: { start: string; end: string };
    use_self_study_with_blocks?: boolean;
    enable_self_study_for_holidays?: boolean;
    enable_self_study_for_study_days?: boolean;
  };
  period_start: string;
  period_end: string;
  target_date?: string;
  block_set_id: string;
  student_contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
    title?: string;
    subject_category?: string;
  }>;
  recommended_contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
    title?: string;
    subject_category?: string;
  }>;
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
  }>;
  academy_schedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string;
    subject?: string;
    travel_time?: number;
  }>;
  study_review_cycle?: {
    study_days: number;
    review_days: number;
  };
  student_level?: "high" | "medium" | "low";
  subject_allocations?: Array<{
    subject_id: string;
    subject_name: string;
    subject_type: "strategy" | "weakness";
    weekly_days?: number;
  }>;
  subject_constraints?: {
    required_subjects?: string[];
    excluded_subjects?: string[];
    constraint_handling: "strict" | "warning" | "auto_fix";
  };
  additional_period_reallocation?: {
    period_start: string;
    period_end: string;
    type: "additional_review";
    original_period_start: string;
    original_period_end: string;
    subjects?: string[];
    review_of_review_factor?: number;
  };
  non_study_time_blocks?: Array<{
    type: "아침식사" | "점심식사" | "저녁식사" | "수면" | "기타";
    start_time: string;
    end_time: string;
    day_of_week?: number[];
    description?: string;
  }>;
};

/**
 * PlanGroup 데이터를 WizardData 형식으로 변환 (순수 함수 버전)
 * 
 * 의존성 주입 패턴을 적용한 순수 함수입니다.
 * 외부에서 필요한 데이터를 context로 주입받습니다.
 * 
 * @param group 플랜 그룹 데이터
 * @param contents 플랜 콘텐츠 목록
 * @param exclusions 제외일 목록
 * @param academySchedules 학원 일정 목록
 * @param context 변환 과정에서 필요한 외부 의존성 데이터
 * @returns WizardData 형식의 초기 데이터
 */
export function transformPlanGroupToWizardDataPure(
  group: PlanGroup,
  contents: PlanContent[],
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[],
  context: TransformationContext = {}
): PartialWizardData {
  // 콘텐츠 분류 결과 사용 (context에서 주입받거나 빈 배열)
  const { studentContents, recommendedContents } = context.classifiedContents ?? {
    studentContents: [],
    recommendedContents: [],
  };

  // 캠프 플랜인 경우 템플릿의 block_set_id 조회 (context에서 주입받음)
  const blockSetId = context.templateData?.blockSetId || group.block_set_id || "";

  // scheduler_options에서 time_settings 추출
  const schedulerOptions = (group.scheduler_options as (SchedulerOptions & Partial<TimeSettings>) | null) ?? {};
  const timeSettings = {
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
    ...schedulerOptionsWithoutTimeSettings
  } = schedulerOptions;

  // 초기 데이터 구성
  return {
    groupId: group.id,
    name: group.name || "",
    plan_purpose: group.plan_purpose || "",
    scheduler_type: group.scheduler_type || "",
    scheduler_options:
      Object.keys(schedulerOptionsWithoutTimeSettings).length > 0
        ? schedulerOptionsWithoutTimeSettings
        : undefined,
    time_settings: hasTimeSettings ? timeSettings : undefined,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date || undefined,
    block_set_id: blockSetId,
    student_contents: studentContents.map((c) => {
      // 원본 contents 배열에서 content_id로 매칭하여 start_detail_id와 end_detail_id 가져오기
      const originalContent = contents.find(
        (orig) => orig.content_id === c.content_id || orig.content_id === c.masterContentId
      );
      return {
        content_type: c.content_type as "book" | "lecture" | "custom",
        content_id: c.masterContentId || c.content_id, // 추천 콘텐츠의 경우 원본 마스터 콘텐츠 ID 사용
        start_range: c.start_range,
        end_range: c.end_range,
        start_detail_id: originalContent?.start_detail_id ?? null,
        end_detail_id: originalContent?.end_detail_id ?? null,
        title: c.title,
        subject_category: c.subject_category || undefined,  // 변경: null → undefined
      };
    }),
    recommended_contents: recommendedContents.map((c) => {
      // 원본 contents 배열에서 content_id로 매칭하여 start_detail_id와 end_detail_id 가져오기
      const originalContent = contents.find((orig) => orig.content_id === c.content_id);
      return {
        content_type: c.content_type as "book" | "lecture" | "custom",
        content_id: c.content_id, // 이미 마스터 콘텐츠 ID
        start_range: c.start_range,
        end_range: c.end_range,
        start_detail_id: originalContent?.start_detail_id ?? null,
        end_detail_id: originalContent?.end_detail_id ?? null,
        title: c.title,
        subject_category: c.subject_category || undefined,  // 변경: null → undefined
        // 자동 추천 정보 포함
        is_auto_recommended: c.is_auto_recommended ?? false,
        recommendation_source: c.recommendation_source ?? null,
        recommendation_reason: c.recommendation_reason ?? null,
        recommendation_metadata: c.recommendation_metadata ?? null,
      };
    }),
    // 제외일 변환: 캠프 플랜인 경우 템플릿 제외일인지 확인하여 source/is_locked 설정
    exclusions: (() => {
      // 템플릿 제외일 (context에서 주입받음)
      const templateExclusions = context.templateData?.exclusions ?? [];

      // 날짜 비교를 위해 정규화 (YYYY-MM-DD 형식으로 통일)
      const normalizeDate = (date: string) => {
        if (!date) return "";
        // 이미 YYYY-MM-DD 형식이면 그대로 반환
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        // Date 객체로 변환 후 YYYY-MM-DD 형식으로 변환
        const d = new Date(date);
        if (isNaN(d.getTime())) return date;
        return d.toISOString().slice(0, 10);
      };

      const templateExclusionDates = new Set(
        templateExclusions.map((te) => normalizeDate(te.exclusion_date))
      );

      return exclusions.map((e) => {
        const normalizedDate = normalizeDate(e.exclusion_date);
        const isTemplateExclusion = templateExclusionDates.has(normalizedDate);
        return {
          exclusion_date: e.exclusion_date,
          exclusion_type: e.exclusion_type as "휴가" | "개인사정" | "휴일지정" | "기타",
          reason: e.reason || undefined,
          // 캠프 플랜이고 템플릿 제외일인 경우 source와 is_locked 설정
          ...(isTemplateExclusion
            ? {
                source: "template" as const,
                is_locked: true,
              }
            : {}),
        };
      });
    })(),
    // 학원 일정 변환: 캠프 플랜인 경우 템플릿 학원 일정인지 확인하여 source/is_locked 설정
    academy_schedules: (() => {
      // 템플릿 학원 일정 (context에서 주입받음)
      const templateAcademySchedules = context.templateData?.academySchedules ?? [];

      // 템플릿 학원 일정을 Set으로 변환 (비교용)
      const templateScheduleKeys = new Set(
        templateAcademySchedules.map(
          (s) => `${s.day_of_week}-${s.start_time}-${s.end_time}`
        )
      );

      return academySchedules.map((s) => {
        const scheduleKey = `${s.day_of_week}-${s.start_time}-${s.end_time}`;
        const isTemplateSchedule = templateScheduleKeys.has(scheduleKey);
        return {
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          academy_name: s.academy_name || undefined,
          subject: s.subject || undefined,
          travel_time: undefined, // TODO: travel_time 저장/로드 추가 필요
          // 캠프 플랜이고 템플릿 학원 일정인 경우 source와 is_locked 설정
          ...(isTemplateSchedule
            ? {
                source: "template" as const,
                is_locked: true,
              }
            : {}),
        };
      });
    })(),
    // 1730 Timetable 추가 필드
    study_review_cycle:
      schedulerOptions.study_days || schedulerOptions.review_days
        ? {
            study_days: schedulerOptions.study_days || 6,
            review_days: schedulerOptions.review_days || 1,
          }
        : undefined,
    student_level: schedulerOptions.student_level,
    subject_allocations: schedulerOptions.subject_allocations,
    subject_constraints: group.subject_constraints
      ? (group.subject_constraints as PartialWizardData["subject_constraints"])
      : undefined,
    additional_period_reallocation: group.additional_period_reallocation || undefined,
    non_study_time_blocks: group.non_study_time_blocks || undefined,
  };
}

