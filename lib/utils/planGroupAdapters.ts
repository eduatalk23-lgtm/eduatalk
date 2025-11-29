/**
 * PlanGroup → WizardData 변환 어댑터
 * 
 * Phase 5.3에서 구현
 * DetailView에서 Step 컴포넌트를 재사용하기 위한 타입 변환
 */

import type { PlanGroup, PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";

/**
 * PlanGroup을 WizardData로 변환
 * 
 * @param group - 플랜 그룹
 * @param exclusions - 제외일 목록
 * @param academySchedules - 학원 일정 목록
 * @returns WizardData 형식
 */
export function planGroupToWizardData(
  group: PlanGroup,
  exclusions: PlanExclusion[] = [],
  academySchedules: AcademySchedule[] = []
): WizardData {
  // scheduler_options에서 time_settings 추출
  const schedulerOptions = (group.scheduler_options as any) || {};
  const timeSettings = schedulerOptions.time_settings;

  return {
    // Step 1: 기본 정보
    name: group.name,
    plan_purpose: (group.plan_purpose as any) || "",
    scheduler_type: (group.scheduler_type as any) || "",
    scheduler_options: {
      study_days: schedulerOptions.study_days,
      review_days: schedulerOptions.review_days,
    },
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date || undefined,
    block_set_id: group.block_set_id,

    // Step 2: 제외일 및 학원 일정
    exclusions: exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as any,
      reason: e.reason || undefined,
      source: "student",
    })),
    academy_schedules: academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    time_settings: timeSettings,
    non_study_time_blocks: [],

    // Step 3: 콘텐츠 (빈 배열로 초기화, 별도 조회 필요)
    student_contents: [],
    recommended_contents: [],

    // Step 4+: 기타 (선택)
    subject_allocations: [],
  };
}

/**
 * WizardData를 PlanGroup 생성 데이터로 변환
 * 
 * @param data - WizardData
 * @returns PlanGroup 생성에 필요한 데이터
 */
export function wizardDataToPlanGroupCreationData(data: WizardData) {
  return {
    name: data.name,
    plan_purpose: data.plan_purpose,
    scheduler_type: data.scheduler_type,
    scheduler_options: {
      ...data.scheduler_options,
      time_settings: data.time_settings,
    },
    period_start: data.period_start,
    period_end: data.period_end,
    target_date: data.target_date,
    block_set_id: data.block_set_id,
    exclusions: data.exclusions,
    academy_schedules: data.academy_schedules,
    non_study_time_blocks: data.non_study_time_blocks,
    student_contents: data.student_contents,
    recommended_contents: data.recommended_contents,
    subject_allocations: data.subject_allocations,
  };
}

/**
 * PlanContent 배열을 학생/추천 콘텐츠로 분리하여 WizardData 형식으로 변환
 * 
 * @param contents - PlanContent 배열
 * @returns 학생 콘텐츠와 추천 콘텐츠
 */
export function contentsToWizardFormat(
  contents: Array<{
    id: string;
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    start_range: number;
    end_range: number;
    contentTitle: string;
    contentSubtitle: string | null;
    isRecommended: boolean;
  }>
) {
  const studentContents = contents
    .filter((c) => !c.isRecommended)
    .map((c) => ({
      content_id: c.content_id,
      content_type: c.content_type,
      start_range: c.start_range,
      end_range: c.end_range,
      subject_category: c.contentSubtitle || undefined,
      title: c.contentTitle,
    }));

  const recommendedContents = contents
    .filter((c) => c.isRecommended)
    .map((c) => ({
      content_id: c.content_id,
      content_type: c.content_type,
      start_range: c.start_range,
      end_range: c.end_range,
      subject_category: c.contentSubtitle || undefined,
      title: c.contentTitle,
      is_auto_recommended: false,
    }));

  return { studentContents, recommendedContents };
}

