/**
 * 플랜 생성/미리보기 공통 데이터 준비 함수
 *
 * generatePlansWithServices와 previewPlansWithServices에서
 * 공통으로 사용하는 데이터 로딩 및 스케줄 계산 로직을 추출합니다.
 *
 * @module lib/plan/services/preparePlanGenerationData
 */

import { getPlanGroupWithDetailsByRole } from "@/lib/auth/planGroupAuth";
import { getBlockSetForPlanGroup } from "@/lib/plan/blocks";
import { getMergedSchedulerSettings } from "@/lib/data/schedulerSettings";
import { calculateAvailableDates } from "@/lib/scheduler/utils/scheduleCalculator";
import { extractScheduleMaps } from "@/lib/plan/planDataLoader";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";
import {
  adaptContentResolution,
  adaptScheduleGeneration,
  getAdapterConfig,
} from "./ServiceAdapter";
import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceContext } from "@/lib/plan/shared";
import type {
  ContentDurationMap,
  ContentMetadataMap,
} from "@/lib/types/plan-generation";
import type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";
import { subtractTimeRanges } from "@/lib/utils/time";
import { ServiceErrorCodes } from "./errors";
import type { ServiceLogger } from "./logging";

/**
 * AI 스케줄러 옵션 오버라이드 타입
 * (AIFramework에서 변환된 옵션)
 */
export type AISchedulerOptionsOverride = {
  weak_subject_focus?: "low" | "medium" | "high";
  study_days?: number;
  review_days?: number;
  subject_allocations?: Array<{
    subject_id: string;
    subject_name: string;
    subject_type: "strategy" | "weakness";
    weekly_days: number;
  }>;
  content_allocations?: Array<{
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    subject_type: "strategy" | "weakness";
    weekly_days: number;
  }>;
};

/**
 * 플랜 생성 공통 입력 타입
 */
export type PlanGenerationCommonInput = {
  groupId: string;
  context: ServiceContext;
  accessInfo: {
    userId: string;
    role: "student" | "admin" | "consultant";
  };
  /**
   * AI Framework에서 생성된 스케줄러 옵션 오버라이드
   * 제공 시 plan_group.scheduler_options보다 우선 적용됨
   */
  aiSchedulerOptionsOverride?: AISchedulerOptionsOverride;
};

/**
 * 시간 할당된 플랜 세그먼트 타입
 */
export type AllocatedPlanSegment = {
  plan: {
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    block_index: number;
    subject_type?: "strategy" | "weakness" | null;
  };
  start: string;
  end: string;
  isPartial: boolean;
  isContinued: boolean;
};

/**
 * 날짜별 메타데이터 타입
 */
export type DateMetadata = {
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  week_number: number | null;
};

/**
 * 날짜별 할당 결과 타입
 */
export type DateAllocationResult = {
  date: string;
  segments: AllocatedPlanSegment[];
  dateMetadata: DateMetadata;
  dayType: string;
};

/**
 * 플랜 생성 준비 데이터 결과 타입
 */
export type PlanGenerationPreparedData = {
  success: true;
  group: NonNullable<Awaited<ReturnType<typeof getPlanGroupWithDetailsByRole>>["group"]>;
  contents: Awaited<ReturnType<typeof getPlanGroupWithDetailsByRole>>["contents"];
  scheduleResult: ReturnType<typeof calculateAvailableDates>;
  dateTimeSlots: Map<string, Array<{ type: string; start: string; end: string }>>;
  dateMetadataMap: Map<string, DateMetadata>;
  weekDatesMap: Map<number, string[]>;
  contentIdMap: Map<string, string>;
  contentMetadataMap: ContentMetadataMap;
  contentDurationMap: ContentDurationMap;
  chapterMap: Map<string, string | null>;
  dateAllocations: DateAllocationResult[];
  /** 슬롯 모드 사용 여부 */
  useSlotMode: boolean;
  /** 슬롯 모드일 때 콘텐츠 슬롯 정보 */
  contentSlots: Array<unknown> | null;
};

/**
 * 플랜 생성 준비 에러 결과 타입
 */
export type PlanGenerationPreparedError = {
  success: false;
  error: string;
  errorCode: string;
};

/**
 * 플랜 생성 준비 결과 타입
 */
export type PlanGenerationPreparedResult =
  | PlanGenerationPreparedData
  | PlanGenerationPreparedError;

/**
 * 기존 플랜 조회 (다른 플랜 그룹의 플랜)
 * 충돌 방지를 위해 동일 학생의 동일 기간 내 플랜을 조회
 */
async function fetchExistingPlans(
  studentId: string,
  periodStart: string,
  periodEnd: string,
  excludePlanGroupId: string
): Promise<ExistingPlanInfo[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_plan")
    .select(`
      id,
      plan_date,
      start_time,
      end_time
    `)
    .eq("student_id", studentId)
    .gte("plan_date", periodStart)
    .lte("plan_date", periodEnd)
    .neq("plan_group_id", excludePlanGroupId)
    .eq("is_active", true);

  if (error) {
    console.error("[fetchExistingPlans] 기존 플랜 조회 실패:", error);
    return [];
  }

  return (data || [])
    .filter((p) => p.start_time && p.end_time) // 시간 정보 있는 플랜만
    .map((p) => ({
      date: p.plan_date,
      start_time: p.start_time!,
      end_time: p.end_time!,
    }));
}

/**
 * 시간 문자열을 분으로 변환
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 플랜 생성/미리보기에 필요한 공통 데이터 준비
 *
 * 1. 플랜 그룹 및 관련 데이터 조회
 * 2. 블록 세트 조회
 * 3. 스케줄러 설정 병합
 * 4. 스케줄 계산
 * 5. 콘텐츠 해석
 * 6. 스케줄 생성
 * 7. 날짜별 시간 할당
 */
export async function preparePlanGenerationData(
  input: PlanGenerationCommonInput,
  logger: ServiceLogger
): Promise<PlanGenerationPreparedResult> {
  const { groupId, context, accessInfo, aiSchedulerOptionsOverride } = input;
  const config = getAdapterConfig();

  // AI 오버라이드에서 study_days/review_days를 항상 제거
  // 이유: 플래너 설정(plan_group.scheduler_options)의 study_days/review_days가 우선되어야 함
  // AI가 생성한 값이 플래너 설정과 다르면 day_type이 잘못 계산됨
  let sanitizedAIOverride = aiSchedulerOptionsOverride;
  if (aiSchedulerOptionsOverride) {
    const { study_days, review_days, ...rest } = aiSchedulerOptionsOverride;
    sanitizedAIOverride = rest as AISchedulerOptionsOverride;

    if (study_days !== undefined || review_days !== undefined) {
      logger.debug("preparePlanGenerationData", "AI 오버라이드 study_days/review_days 무시 (플래너 설정 우선)", {
        aiStudyDays: study_days,
        aiReviewDays: review_days,
        reason: "플래너 설정의 study_days/review_days를 사용",
      });
    }
  }

  // AI 스케줄러 옵션 오버라이드 로깅
  if (sanitizedAIOverride) {
    logger.debug("preparePlanGenerationData", "AI 스케줄러 옵션 오버라이드 적용", {
      hasWeakSubjectFocus: !!sanitizedAIOverride.weak_subject_focus,
      hasSubjectAllocations: !!sanitizedAIOverride.subject_allocations?.length,
      hasContentAllocations: !!sanitizedAIOverride.content_allocations?.length,
      hasStudyReviewCycle: sanitizedAIOverride.study_days !== undefined,
    });
  }

  // 1. 플랜 그룹 및 관련 데이터 조회
  logger.debug("preparePlanGenerationData", "플랜 그룹 조회 중");
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetailsByRole(
      groupId,
      accessInfo.userId,
      accessInfo.role,
      context.tenantId
    );

  if (!group) {
    return {
      success: false,
      error: "플랜 그룹을 찾을 수 없습니다.",
      errorCode: ServiceErrorCodes.INVALID_INPUT,
    };
  }

  // 슬롯 모드 확인: use_slot_mode가 true이고 content_slots가 있으면 콘텐츠 없이도 허용
  const useSlotMode = (group.scheduler_options as Record<string, unknown>)?.use_slot_mode === true;
  const contentSlots = (group.scheduler_options as Record<string, unknown>)?.content_slots as Array<unknown> | undefined;
  const hasContentSlots = Array.isArray(contentSlots) && contentSlots.length > 0;

  if (contents.length === 0 && !useSlotMode) {
    return {
      success: false,
      error: "플랜 콘텐츠가 없습니다.",
      errorCode: ServiceErrorCodes.INVALID_INPUT,
    };
  }

  // 슬롯 모드인데 content_slots도 없는 경우
  if (contents.length === 0 && useSlotMode && !hasContentSlots) {
    return {
      success: false,
      error: "슬롯 모드가 활성화되었지만 콘텐츠 슬롯이 설정되지 않았습니다.",
      errorCode: ServiceErrorCodes.INVALID_INPUT,
    };
  }

  logger.debug("preparePlanGenerationData", "플랜 모드 확인", {
    useSlotMode,
    hasContentSlots,
    contentsCount: contents.length,
  });

  logger.debug("preparePlanGenerationData", "플랜 그룹 조회 완료", {
    contentsCount: contents.length,
    exclusionsCount: exclusions.length,
  });

  // 2. 블록 세트 조회
  logger.debug("preparePlanGenerationData", "블록 세트 조회 중");
  const baseBlocks = await getBlockSetForPlanGroup(
    group,
    context.studentId,
    accessInfo.userId,
    accessInfo.role,
    context.tenantId
  );

  if (baseBlocks.length === 0) {
    return {
      success: false,
      error: "블록 세트가 설정되지 않았습니다.",
      errorCode: ServiceErrorCodes.INVALID_INPUT,
    };
  }

  logger.debug("preparePlanGenerationData", "블록 세트 조회 완료", {
    blocksCount: baseBlocks.length,
  });

  // 3. 병합된 스케줄러 설정
  // sanitizedAIOverride를 사용 (유효하지 않은 study_days/review_days는 이미 제거됨)
  const effectiveGroupOptions = sanitizedAIOverride
    ? {
        ...(group.scheduler_options as Record<string, unknown>),
        ...sanitizedAIOverride,
      }
    : (group.scheduler_options as Record<string, unknown>);

  const mergedSettings = await getMergedSchedulerSettings(
    group.tenant_id,
    group.camp_template_id,
    effectiveGroupOptions
  );

  // plan_group의 시간 설정을 TimeRange 형식으로 변환
  const groupStudyHours = group.study_hours
    ? { start: group.study_hours.start_time, end: group.study_hours.end_time }
    : null;
  const groupSelfStudyHours = group.self_study_hours
    ? { start: group.self_study_hours.start_time, end: group.self_study_hours.end_time }
    : null;

  // mergedSettings에서 study_days/review_days 사용 (sanitizedAIOverride가 이미 적용됨)
  const schedulerOptions = {
    study_days: mergedSettings.study_review_ratio.study_days,
    review_days: mergedSettings.study_review_ratio.review_days,
    weak_subject_focus: sanitizedAIOverride?.weak_subject_focus ?? mergedSettings.weak_subject_focus,
    review_scope: mergedSettings.review_scope,
    // 시간 설정: plan_group 컬럼 우선, 없으면 merged settings 사용
    lunch_time: group.lunch_time || mergedSettings.lunch_time,
    camp_study_hours: groupStudyHours || mergedSettings.study_hours,
    self_study_hours: groupSelfStudyHours || mergedSettings.self_study_hours,
    // AI에서 생성된 과목/콘텐츠 할당 (있는 경우)
    ...(sanitizedAIOverride?.subject_allocations && {
      subject_allocations: sanitizedAIOverride.subject_allocations,
    }),
    ...(sanitizedAIOverride?.content_allocations && {
      content_allocations: sanitizedAIOverride.content_allocations,
    }),
  };

  logger.debug("preparePlanGenerationData", "스케줄러 옵션 결정됨", {
    studyDays: schedulerOptions.study_days,
    reviewDays: schedulerOptions.review_days,
    weakSubjectFocus: schedulerOptions.weak_subject_focus,
  });

  const groupSchedulerOptions = getSchedulerOptionsWithTimeSettings(group);

  // 4. 스케줄 계산
  const scheduleResult = calculateAvailableDates(
    group.period_start,
    group.period_end,
    baseBlocks.map((b) => ({
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    })),
    exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as "휴가" | "개인사정" | "휴일지정" | "기타",
      reason: e.reason || undefined,
    })),
    academySchedules.map((a) => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    {
      scheduler_type: "1730_timetable",
      scheduler_options: schedulerOptions || null,
      use_self_study_with_blocks: true,
      enable_self_study_for_holidays:
        groupSchedulerOptions?.enable_self_study_for_holidays === true,
      enable_self_study_for_study_days:
        groupSchedulerOptions?.enable_self_study_for_study_days === true,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      camp_self_study_hours: schedulerOptions.self_study_hours,
      designated_holiday_hours: groupSchedulerOptions?.designated_holiday_hours,
      non_study_time_blocks: group.non_study_time_blocks || undefined,
    }
  );

  // 5. 스케줄 맵 추출
  const { dateTimeSlots, dateMetadataMap, weekDatesMap } = extractScheduleMaps(scheduleResult);

  // dateAvailableTimeRanges 추출
  const dateAvailableTimeRanges = new Map<
    string,
    Array<{ start: string; end: string }>
  >();
  scheduleResult.daily_schedule.forEach((daily) => {
    if (
      (daily.day_type === "학습일" || daily.day_type === "복습일") &&
      daily.available_time_ranges.length > 0
    ) {
      dateAvailableTimeRanges.set(
        daily.date,
        daily.available_time_ranges.map((range) => ({
          start: range.start,
          end: range.end,
        }))
      );
    }
  });

  // 6. 콘텐츠 해석 (서비스 레이어 사용)
  // 슬롯 모드에서 콘텐츠가 없으면 빈 맵 사용 (가상 플랜 생성 시)
  let contentIdMap: Map<string, string> = new Map();
  let contentMetadataMap: ContentMetadataMap = new Map();
  let contentDurationMap: ContentDurationMap = new Map();
  let chapterMap: Map<string, string | null> = new Map();

  if (contents.length > 0) {
    const contentResolution = await adaptContentResolution(
      contents,
      context,
      { useServiceLayer: config.useContentResolutionService }
    );

    contentIdMap = contentResolution.contentIdMap;
    contentMetadataMap = contentResolution.contentMetadataMap;
    contentDurationMap = contentResolution.contentDurationMap;
    chapterMap = contentResolution.chapterMap;
  } else {
    logger.debug("preparePlanGenerationData", "슬롯 모드: 콘텐츠 없이 진행 (가상 플랜 생성 예정)");
  }

  // 7. 기존 플랜 조회 (시간 충돌 방지용)
  const existingPlans = await fetchExistingPlans(
    context.studentId,
    group.period_start,
    group.period_end,
    groupId
  );

  if (existingPlans.length > 0) {
    logger.debug("preparePlanGenerationData", `기존 플랜 ${existingPlans.length}개 발견, 스케줄러에 전달`);
  }

  // 8. 스케줄 생성 (어댑터 통해 기존 함수 호출)
  // 슬롯 모드에서 콘텐츠가 없으면 스케줄 생성 스킵 (가상 플랜 생성 시)
  let scheduledPlans: Awaited<ReturnType<typeof adaptScheduleGeneration>> = [];

  if (contents.length > 0) {
    scheduledPlans = await adaptScheduleGeneration({
      group,
      contents,
      exclusions,
      academySchedules,
      blocks: baseBlocks,
      contentIdMap,
      contentDurationMap,
      chapterMap,
      dateAvailableTimeRanges,
      dateTimeSlots,
      existingPlans, // 기존 플랜 정보 전달 (시간 충돌 방지)
      // 스케줄러 옵션 오버라이드 전달 (study_days/review_days가 스케줄러에도 적용됨)
      schedulerOptionsOverride: {
        study_days: schedulerOptions.study_days,
        review_days: schedulerOptions.review_days,
        weak_subject_focus: typeof schedulerOptions.weak_subject_focus === "string"
          ? schedulerOptions.weak_subject_focus as "low" | "medium" | "high"
          : undefined,
      },
    });

    if (scheduledPlans.length === 0) {
      return {
        success: false,
        error: "일정에 맞는 플랜을 생성할 수 없습니다.",
        errorCode: ServiceErrorCodes.SCHEDULE_GENERATION_FAILED,
      };
    }

    logger.debug("preparePlanGenerationData", "스케줄 생성 완료", {
      scheduledPlansCount: scheduledPlans.length,
    });
  } else {
    logger.debug("preparePlanGenerationData", "슬롯 모드: 스케줄 생성 스킵 (가상 플랜 생성 예정)");
  }

  // 8. 날짜별 시간 할당
  const plansByDate = new Map<string, typeof scheduledPlans>();
  scheduledPlans.forEach((plan) => {
    const date = plan.plan_date;
    if (!plansByDate.has(date)) {
      plansByDate.set(date, []);
    }
    plansByDate.get(date)!.push(plan);
  });

  const dateAllocations: DateAllocationResult[] = [];
  const sortedDates = Array.from(plansByDate.keys()).sort();

  // 기존 플랜을 날짜별로 그룹화 (시간 차감용)
  const existingPlansByDate = new Map<string, Array<{ start: string; end: string }>>();
  for (const plan of existingPlans) {
    const date = plan.date;
    if (!existingPlansByDate.has(date)) {
      existingPlansByDate.set(date, []);
    }
    existingPlansByDate.get(date)!.push({
      start: plan.start_time,
      end: plan.end_time,
    });
  }

  for (const date of sortedDates) {
    const datePlans = plansByDate.get(date)!;
    const timeSlotsForDate = dateTimeSlots.get(date) || [];
    let studyTimeSlots = timeSlotsForDate
      .filter((slot) => slot.type === "학습시간")
      .map((slot) => ({ start: slot.start, end: slot.end }))
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    // 기존 플랜 시간 차감 (시간 충돌 방지)
    const existingTimesForDate = existingPlansByDate.get(date);
    if (existingTimesForDate && existingTimesForDate.length > 0) {
      studyTimeSlots = subtractTimeRanges(studyTimeSlots, existingTimesForDate);
    }

    const dateMetadata = dateMetadataMap.get(date) || {
      day_type: null,
      week_number: null,
    };

    const dailySchedule = scheduleResult.daily_schedule.find((d) => d.date === date);
    const totalStudyHours = dailySchedule?.study_hours || 0;
    const dayType = dateMetadata.day_type || "학습일";

    // 시간 할당
    const segments = assignPlanTimes(
      datePlans.map((plan) => ({
        content_id: plan.content_id,
        content_type: plan.content_type,
        planned_start_page_or_time: plan.planned_start_page_or_time,
        planned_end_page_or_time: plan.planned_end_page_or_time,
        block_index: plan.block_index,
      })),
      studyTimeSlots,
      contentDurationMap,
      dayType,
      totalStudyHours
    );

    // subject_type을 content_id 기반으로 조회하기 위한 맵 생성
    const subjectTypeMap = new Map<string, "strategy" | "weakness" | null>();
    datePlans.forEach((plan) => {
      subjectTypeMap.set(plan.content_id, plan.subject_type ?? null);
    });

    dateAllocations.push({
      date,
      segments: segments.map((seg) => ({
        plan: {
          content_id: seg.plan.content_id,
          content_type: seg.plan.content_type,
          planned_start_page_or_time: seg.plan.planned_start_page_or_time,
          planned_end_page_or_time: seg.plan.planned_end_page_or_time,
          block_index: seg.plan.block_index ?? 0,
          subject_type: subjectTypeMap.get(seg.plan.content_id) ?? null,
        },
        start: seg.start,
        end: seg.end,
        isPartial: seg.isPartial,
        isContinued: seg.isContinued,
      })),
      dateMetadata,
      dayType,
    });
  }

  return {
    success: true,
    group,
    contents,
    scheduleResult,
    dateTimeSlots,
    dateMetadataMap,
    weekDatesMap,
    contentIdMap,
    contentMetadataMap,
    contentDurationMap,
    chapterMap,
    dateAllocations,
    useSlotMode,
    contentSlots: hasContentSlots ? (contentSlots as Array<unknown>) : null,
  };
}
