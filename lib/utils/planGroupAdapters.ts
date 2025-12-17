/**
 * PlanGroup → WizardData 변환 어댑터
 * 
 * Phase 5.3에서 구현
 * DetailView에서 Step 컴포넌트를 재사용하기 위한 타입 변환
 */

import type { PlanGroup, PlanExclusion, AcademySchedule, PlanPurpose, SchedulerType, ExclusionType } from "@/lib/types/plan";
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";

/**
 * PlanGroup을 WizardData로 변환
 * 
 * @param group - 플랜 그룹
 * @param exclusions - 제외일 목록
 * @param academySchedules - 학원 일정 목록
 * @param contents - 콘텐츠 목록 (선택)
 * @param templateBlocks - 템플릿 블록 목록 (선택)
 * @param templateBlockSetName - 템플릿 블록세트 이름 (선택)
 * @returns WizardData 형식
 */
export function planGroupToWizardData(
  group: PlanGroup,
  exclusions: PlanExclusion[] = [],
  academySchedules: AcademySchedule[] = [],
  contents?: Array<any>,
  templateBlocks?: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>,
  templateBlockSetName?: string | null
): WizardData {
  // scheduler_options에서 time_settings 추출
  const schedulerOptions = getSchedulerOptionsWithTimeSettings(group);
  const timeSettings = schedulerOptions?.time_settings;

  // 콘텐츠 분리 (학생/추천)
  let studentContents: any[] = [];
  let recommendedContents: any[] = [];
  
  if (contents && contents.length > 0) {
    const { studentContents: student, recommendedContents: recommended } = 
      contentsToWizardFormat(
        contents.map((c: any) => ({
          id: c.id || c.content_id,
          content_id: c.content_id,
          content_type: c.content_type,
          start_range: c.start_range,
          end_range: c.end_range,
          contentTitle: c.contentTitle || c.title || "알 수 없음",
          contentSubtitle: c.contentSubtitle || c.subject_category || null,
          isRecommended: c.isRecommended || c.is_recommended || false,
        }))
      );
    studentContents = student;
    recommendedContents = recommended;
  }

  return {
    // Step 1: 기본 정보
    name: group.name || "",
    plan_purpose: (group.plan_purpose as PlanPurpose) || "",
    scheduler_type: (group.scheduler_type as SchedulerType) || "",
    scheduler_options: {
      study_days: schedulerOptions.study_days,
      review_days: schedulerOptions.review_days,
    },
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date || undefined,
    block_set_id: group.block_set_id || "",

    // Step 2: 제외일 및 학원 일정
    exclusions: exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as ExclusionType,
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

    // Step 3: 콘텐츠
    student_contents: studentContents,
    recommended_contents: recommendedContents,

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

