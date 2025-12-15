/**
 * WizardData와 PlanGroupCreationData 간 데이터 동기화 및 변환 유틸리티
 * 데이터 일관성을 보장하기 위한 중앙화된 변환 로직
 */

import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type {
  PlanGroupCreationData,
  PlanPurpose,
  SchedulerType,
  PlanContentInput,
  ExclusionType,
} from "@/lib/types/plan";
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import { mergeTimeSettingsSafely } from "@/lib/utils/schedulerOptionsMerge";
import { validateWizardDataSafe, validatePartialWizardDataSafe } from "@/lib/schemas/planWizardSchema";

/**
 * WizardData를 PlanGroupCreationData로 변환
 * 데이터 일관성을 보장하고 중복 저장을 방지합니다.
 */
export function syncWizardDataToCreationData(
  wizardData: WizardData
): PlanGroupCreationData {
  try {
    // Zod 스키마로 입력 데이터 검증
    const validation = validateWizardDataSafe(wizardData);
    if (!validation.success) {
      const errorMessages = validation.error.errors.map((err) => {
        const path = err.path.join(".");
        return `${path}: ${err.message}`;
      });
      throw new PlanGroupError(
        `데이터 검증 실패: ${errorMessages.join(", ")}`,
        PlanGroupErrorCodes.VALIDATION_FAILED,
        "입력된 데이터 형식이 올바르지 않습니다. 페이지를 새로고침해주세요.",
        false,
        { validationErrors: errorMessages }
      );
    }
    
    // 검증된 데이터 사용
    const validatedData = validation.data;
    // 1. scheduler_options 구성
    const schedulerOptions: Record<string, unknown> = {
      ...(validatedData.scheduler_options || {}),
    };

    // study_review_cycle을 scheduler_options에 병합
    if (validatedData.study_review_cycle) {
      schedulerOptions.study_days = validatedData.study_review_cycle.study_days;
      schedulerOptions.review_days = validatedData.study_review_cycle.review_days;
    } else if (validatedData.scheduler_options?.study_days || validatedData.scheduler_options?.review_days) {
      // scheduler_options에 이미 있는 경우 그대로 사용
      schedulerOptions.study_days = validatedData.scheduler_options.study_days;
      schedulerOptions.review_days = validatedData.scheduler_options.review_days;
    }

    // time_settings를 scheduler_options에 안전하게 병합 (보호 필드 자동 보호)
    let finalSchedulerOptions = schedulerOptions;
    if (validatedData.time_settings) {
      finalSchedulerOptions = mergeTimeSettingsSafely(schedulerOptions, validatedData.time_settings);
    }

    // subject_allocations와 content_allocations를 scheduler_options에 저장
    if (validatedData.subject_allocations) {
      finalSchedulerOptions.subject_allocations = validatedData.subject_allocations;
    }
    if (validatedData.content_allocations) {
      finalSchedulerOptions.content_allocations = validatedData.content_allocations;
    }
    if (validatedData.student_level) {
      finalSchedulerOptions.student_level = validatedData.student_level;
    }

    // 2. daily_schedule 유효성 검증 및 필터링
    const periodStart = new Date(validatedData.period_start);
    const periodEnd = new Date(validatedData.period_end);
    
    // 추가 기간이 있으면 유효한 기간 범위 확장
    let validStart = periodStart;
    let validEnd = periodEnd;
    
    if (validatedData.additional_period_reallocation) {
      const additionalStart = new Date(validatedData.additional_period_reallocation.period_start);
      const additionalEnd = new Date(validatedData.additional_period_reallocation.period_end);
      
      // 유효한 기간: 원래 기간 + 추가 기간
      validStart = periodStart < additionalStart ? periodStart : additionalStart;
      validEnd = periodEnd > additionalEnd ? periodEnd : additionalEnd;
    }
    
    const validatedDailySchedule = validatedData.daily_schedule?.filter(
      (schedule) => {
        try {
          const scheduleDate = new Date(schedule.date);

          return (
            scheduleDate >= validStart &&
            scheduleDate <= validEnd &&
            schedule.study_hours >= 0
          );
        } catch {
          return false;
        }
      }
    );

    // 3. 콘텐츠 데이터 검증 및 변환
    const allContents = [
      ...validatedData.student_contents,
      ...validatedData.recommended_contents,
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
    // plan_purpose 변환: 빈 문자열은 null, "모의고사(수능)"은 "모의고사"로 변환
    const wizardPlanPurpose = validatedData.plan_purpose;
    const normalizedPlanPurpose: PlanPurpose | null =
      !wizardPlanPurpose || wizardPlanPurpose === null
        ? null
        : wizardPlanPurpose === "모의고사(수능)"
          ? "모의고사"
          : (wizardPlanPurpose as PlanPurpose);

    // scheduler_type 변환: 빈 문자열은 null
    const wizardSchedulerType = wizardData.scheduler_type as string; // Cast to string for empty check
    const normalizedSchedulerType: SchedulerType | null =
      !wizardSchedulerType || wizardSchedulerType === ""
        ? null
        : (wizardSchedulerType as SchedulerType);

    const creationData: PlanGroupCreationData = {
      name: validatedData.name || null,
      plan_purpose: normalizedPlanPurpose || "모의고사", // Default fallback if null
      scheduler_type: normalizedSchedulerType || "1730_timetable", // Default fallback if null
      scheduler_options:
        Object.keys(finalSchedulerOptions).length > 0 ? finalSchedulerOptions : null,
      period_start: validatedData.period_start || new Date().toISOString().split('T')[0], // Fallback to today
      period_end: validatedData.period_end || new Date().toISOString().split('T')[0],
      target_date: validatedData.target_date || null,
      block_set_id: validatedData.block_set_id || null,
      contents: allContents.map((c, idx) => {
        // PlanContentInput 타입에 맞게 구성
        // master_content_id 설정
        let masterContentId: string | null = null;
        // 1. WizardData에서 명시적으로 설정된 경우 우선 사용
        if ("master_content_id" in c && c.master_content_id) {
          masterContentId = c.master_content_id;
        } else {
          // 2. 추천 콘텐츠인 경우: content_id 자체가 마스터 콘텐츠 ID
          const isRecommended = validatedData.recommended_contents.some(
            (rc) => rc.content_id === c.content_id && rc.content_type === c.content_type
          );
          if (isRecommended) {
            masterContentId = c.content_id;
          }
        }

        const contentItem: PlanContentInput & {
          is_auto_recommended?: boolean;
          recommendation_source?: "auto" | "admin" | "template" | null;
          recommendation_reason?: string | null;
          recommendation_metadata?: any;
        } = {
          content_type: c.content_type,
          content_id: c.content_id,
          start_range: c.start_range,
          end_range: c.end_range,
          start_detail_id: "start_detail_id" in c ? (c.start_detail_id ?? null) : null,
          end_detail_id: "end_detail_id" in c ? (c.end_detail_id ?? null) : null,
          display_order: idx,
          ...(masterContentId ? { master_content_id: masterContentId } : {}),
        };

        // 자동 추천 관련 필드 추가
        // Step 4에서 자동 배정된 콘텐츠는 is_auto_recommended: true, recommendation_source: "auto"로 설정됨
        // 이 플래그들은 DB에 저장되어 관리자 일괄 적용 기능과 구분됨
        if ("is_auto_recommended" in c && c.is_auto_recommended !== undefined) {
          contentItem.is_auto_recommended = c.is_auto_recommended;
        }
        if ("recommendation_source" in c && c.recommendation_source) {
          contentItem.recommendation_source = c.recommendation_source;
        }
        if ("recommendation_reason" in c && c.recommendation_reason) {
          contentItem.recommendation_reason = typeof c.recommendation_reason === 'string' ? c.recommendation_reason : null;
        }
        if ("recommendation_metadata" in c && c.recommendation_metadata) {
          contentItem.recommendation_metadata = c.recommendation_metadata;
        }

        return contentItem;
      }),
      exclusions: validatedData.exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type as ExclusionType,
        reason: e.reason || null,
      })),
      academy_schedules: validatedData.academy_schedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        academy_name: s.academy_name || undefined,
        subject: s.subject || undefined,
        travel_time: s.travel_time,
      })),
      // 1730 Timetable 추가 필드
      study_review_cycle: validatedData.study_review_cycle,
      student_level: validatedData.student_level,
      subject_allocations: validatedData.subject_allocations,
      subject_constraints: validatedData.subject_constraints
        ? {
            ...validatedData.subject_constraints,
            required_subjects: validatedData.subject_constraints.required_subjects?.map(
              (req) => ({
                subject_category: req.subject_category,
                subject: req.subject_category, // fallback
                min_count: req.min_count,
                subjects_by_curriculum: req.subjects_by_curriculum
                  ?.filter((s) => s.subject_id) // subject_id가 있는 것만 필터링
                  .map((s) => ({
                    curriculum_revision_id: s.curriculum_revision_id,
                    subject_id: s.subject_id!, // 필터링했으므로 non-null assertion 가능
                    subject_name: s.subject_name,
                  })),
              })
            ),
          }
        : undefined,
      additional_period_reallocation: validatedData.additional_period_reallocation,
      non_study_time_blocks: validatedData.non_study_time_blocks,
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
    start_detail_id?: string | null; // 시작 범위 상세 정보 ID
    end_detail_id?: string | null; // 종료 범위 상세 정보 ID
    display_order: number;
    is_auto_recommended?: boolean;
    recommendation_source?: string | null;
    recommendation_reason?: string | null;
    title?: string; // 콘텐츠 제목
    subject_category?: string; // 과목 카테고리
    master_content_id?: string | null; // 마스터 콘텐츠 ID
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
    const schedulerOptions = (group.scheduler_options && typeof group.scheduler_options === "object") 
      ? group.scheduler_options as Record<string, unknown>
      : {};
    const timeSettings: WizardData["time_settings"] = {
      lunch_time: schedulerOptions.lunch_time as { start: string; end: string } | undefined,
      camp_study_hours: schedulerOptions.camp_study_hours as { start: string; end: string } | undefined,
      camp_self_study_hours: schedulerOptions.camp_self_study_hours as { start: string; end: string } | undefined,
      designated_holiday_hours: schedulerOptions.designated_holiday_hours as { start: string; end: string } | undefined,
      use_self_study_with_blocks: schedulerOptions.use_self_study_with_blocks as boolean | undefined,
      enable_self_study_for_holidays: schedulerOptions.enable_self_study_for_holidays as boolean | undefined,
      enable_self_study_for_study_days: schedulerOptions.enable_self_study_for_study_days as boolean | undefined,
    };

    // time_settings 필드 중 하나라도 값이 있으면 포함
    const hasTimeSettings =
      (timeSettings && timeSettings.lunch_time !== undefined) ||
      (timeSettings && timeSettings.camp_study_hours !== undefined) ||
      (timeSettings && timeSettings.camp_self_study_hours !== undefined) ||
      (timeSettings && timeSettings.designated_holiday_hours !== undefined) ||
      (timeSettings && timeSettings.use_self_study_with_blocks !== undefined) ||
      (timeSettings && timeSettings.enable_self_study_for_holidays !== undefined) ||
      (timeSettings && timeSettings.enable_self_study_for_study_days !== undefined);

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
      content_allocations,
      ...schedulerOptionsWithoutTimeSettings
    } = schedulerOptions;

    // 콘텐츠 분류: is_auto_recommended가 true이거나 recommendation_source가 있는 경우 추천 콘텐츠
    // - is_auto_recommended: true, recommendation_source: "auto" → Step 4에서 자동 배정된 콘텐츠
    // - is_auto_recommended: false, recommendation_source: "admin" → 관리자가 일괄 적용한 콘텐츠
    // - 둘 다 없으면 → 학생이 직접 등록한 콘텐츠 (student_contents)
    const studentContents: WizardData["student_contents"] = [];
    const recommendedContents: WizardData["recommended_contents"] = [];

    contents.forEach((c) => {
      const contentItem = {
        content_type: c.content_type as "book" | "lecture",
        content_id: c.content_id,
        start_range: c.start_range,
        end_range: c.end_range,
        // 상세 정보 ID 포함
      ...((c.start_detail_id) ? { start_detail_id: c.start_detail_id } : {}),
        ...((c.end_detail_id) ? { end_detail_id: c.end_detail_id } : {}),
        // title과 subject_category가 있으면 포함
        ...((c.title) ? { title: c.title } : {}),
        ...((c.subject_category) ? { subject_category: c.subject_category } : {}),
        // master_content_id가 있으면 포함 (마스터에서 가져온 교재/강의 표시용)
        ...("master_content_id" in c && c.master_content_id ? { master_content_id: c.master_content_id } : {}),
      };

      if (c.is_auto_recommended || c.recommendation_source) {
        // recommendation_source 타입 검증
        const recommendationSource = c.recommendation_source;
        const validSource = recommendationSource === "auto" || recommendationSource === "admin" || recommendationSource === "template"
          ? recommendationSource
          : null;
        
        recommendedContents.push({
          ...contentItem,
          is_auto_recommended: c.is_auto_recommended ?? false,
          recommendation_source: validSource,
          recommendation_reason: c.recommendation_reason ?? null,
        });
      } else {
        studentContents.push(contentItem);
      }
    });

    // WizardData 구성
    // plan_purpose 변환: null은 빈 문자열로, PlanPurpose는 그대로 사용
    const wizardPlanPurpose: WizardData["plan_purpose"] =
      group.plan_purpose === null || group.plan_purpose === ""
        ? ""
        : (group.plan_purpose === "모의고사" || group.plan_purpose === "수능")
          ? "모의고사(수능)"
          : group.plan_purpose === "내신대비"
            ? "내신대비"
            : "";

    // scheduler_type 변환: null은 빈 문자열로, SchedulerType은 그대로 사용
    const wizardSchedulerType: WizardData["scheduler_type"] =
      group.scheduler_type === null || group.scheduler_type === ""
        ? ""
        : group.scheduler_type === "1730_timetable"
          ? "1730_timetable"
          : "";

    const wizardData: WizardData = {
      name: group.name || "",
      plan_purpose: wizardPlanPurpose,
      scheduler_type: wizardSchedulerType,
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
        exclusion_type: e.exclusion_type as ExclusionType,
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
        (typeof study_days === "number" || typeof review_days === "number")
          ? {
              study_days: typeof study_days === "number" ? study_days : 6,
              review_days: typeof review_days === "number" ? review_days : 1,
            }
          : undefined,
      student_level: student_level as "high" | "medium" | "low" | undefined,
      subject_allocations: subject_allocations as Array<{
        subject_id: string;
        subject_name: string;
        subject_type: "strategy" | "weakness";
        weekly_days?: number;
      }> | undefined,
      content_allocations: content_allocations as Array<{
        content_type: "book" | "lecture";
        content_id: string;
        subject_type: "strategy" | "weakness";
        weekly_days?: number;
      }> | undefined,
      subject_constraints: group.subject_constraints || undefined,
      additional_period_reallocation: group.additional_period_reallocation || undefined,
      non_study_time_blocks: group.non_study_time_blocks || undefined,
      daily_schedule: group.daily_schedule || undefined,
    };

    // 출력 데이터 검증 (부분 스키마 사용 - DB에서 온 데이터는 일부 필드가 없을 수 있음)
    const outputValidation = validatePartialWizardDataSafe(wizardData);
    if (!outputValidation.success) {
      // 검증 실패는 경고만 출력하고 데이터는 반환 (하위 호환성)
      console.warn("[syncCreationDataToWizardData] 출력 데이터 검증 실패:", {
        errors: outputValidation.error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        })),
      });
    }

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
    const periodStart = new Date(wizardData.period_start);
    const periodEnd = new Date(wizardData.period_end);
    
    // 추가 기간이 있으면 유효한 기간 범위 확장
    let validStart = periodStart;
    let validEnd = periodEnd;
    
    if (wizardData.additional_period_reallocation) {
      const additionalStart = new Date(wizardData.additional_period_reallocation.period_start);
      const additionalEnd = new Date(wizardData.additional_period_reallocation.period_end);
      
      // 유효한 기간: 원래 기간 + 추가 기간
      validStart = periodStart < additionalStart ? periodStart : additionalStart;
      validEnd = periodEnd > additionalEnd ? periodEnd : additionalEnd;
    }
    
    const invalidSchedules = wizardData.daily_schedule.filter((schedule) => {
      const scheduleDate = new Date(schedule.date);
      return scheduleDate < validStart || scheduleDate > validEnd;
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

