/**
 * 서비스 레이어 기반 플랜 생성 함수
 *
 * 기존 generatePlansRefactored.ts의 로직을 서비스 레이어로 점진적으로 이전합니다.
 * Phase 3에서 기존 코드와 병행하여 사용되며, 점진적으로 기존 코드를 대체합니다.
 *
 * 현재 상태:
 * - ContentResolutionService: 완전 통합
 * - ScheduleGenerationService: 어댑터 통해 기존 함수 호출
 * - TimeAllocationService: 어댑터 통해 기존 함수 호출
 * - PlanPersistenceService: 완전 통합
 *
 * @module lib/plan/services/generatePlansWithServices
 */

import { getPlanGroupWithDetailsByRole } from "@/lib/auth/planGroupAuth";
import { getBlockSetForPlanGroup } from "@/lib/plan/blocks";
import { getMergedSchedulerSettings } from "@/lib/data/schedulerSettings";
import { calculateAvailableDates } from "@/lib/scheduler/calculateAvailableDates";
import { extractScheduleMaps } from "@/lib/plan/planDataLoader";
import { getSchedulerOptionsWithTimeSettings } from "@/lib/utils/schedulerOptions";
import {
  adaptContentResolution,
  adaptScheduleGeneration,
  getAdapterConfig,
} from "./ServiceAdapter";
import { getPlanPersistenceService } from "./PlanPersistenceService";
import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import type { ServiceContext } from "./types";
import type { PlanPayloadBase } from "@/lib/types/plan-generation";

/**
 * 서비스 기반 플랜 생성 입력
 */
export type GeneratePlansWithServicesInput = {
  groupId: string;
  context: ServiceContext;
  accessInfo: {
    userId: string;
    role: "student" | "admin" | "consultant";
  };
};

/**
 * 서비스 기반 플랜 생성 결과
 */
export type GeneratePlansWithServicesResult = {
  success: boolean;
  count?: number;
  error?: string;
  errorCode?: string;
};

/**
 * 서비스 레이어를 사용한 플랜 생성
 *
 * 기존 generatePlansRefactored와 동일한 결과를 생성하되,
 * 내부적으로 서비스 레이어를 사용합니다.
 */
export async function generatePlansWithServices(
  input: GeneratePlansWithServicesInput
): Promise<GeneratePlansWithServicesResult> {
  const { groupId, context, accessInfo } = input;
  const config = getAdapterConfig();

  try {
    // 1. 플랜 그룹 및 관련 데이터 조회
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
        errorCode: "PLAN_GROUP_NOT_FOUND",
      };
    }

    if (contents.length === 0) {
      return {
        success: false,
        error: "플랜 콘텐츠가 없습니다.",
        errorCode: "NO_CONTENTS",
      };
    }

    // 2. 블록 세트 조회
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
        errorCode: "NO_BLOCKS",
      };
    }

    // 3. 병합된 스케줄러 설정
    const mergedSettings = await getMergedSchedulerSettings(
      group.tenant_id,
      group.camp_template_id,
      group.scheduler_options as Record<string, unknown>
    );

    const schedulerOptions = {
      study_days: mergedSettings.study_review_ratio.study_days,
      review_days: mergedSettings.study_review_ratio.review_days,
      weak_subject_focus: mergedSettings.weak_subject_focus,
      review_scope: mergedSettings.review_scope,
      lunch_time: mergedSettings.lunch_time,
      camp_study_hours: mergedSettings.study_hours,
      self_study_hours: mergedSettings.self_study_hours,
    };

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
    const { dateTimeSlots, dateMetadataMap } = extractScheduleMaps(scheduleResult);

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
    const contentResolution = await adaptContentResolution(
      contents,
      context,
      { useServiceLayer: config.useContentResolutionService }
    );

    const { contentIdMap, contentMetadataMap, contentDurationMap, chapterMap } =
      contentResolution;

    // 7. 스케줄 생성 (어댑터 통해 기존 함수 호출)
    const scheduledPlans = await adaptScheduleGeneration({
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
    });

    if (scheduledPlans.length === 0) {
      return {
        success: false,
        error: "일정에 맞는 플랜을 생성할 수 없습니다.",
        errorCode: "NO_PLANS_GENERATED",
      };
    }

    // 8. 시간 할당 및 플랜 페이로드 생성
    const planPayloads: Array<
      PlanPayloadBase & {
        content_id: string;
        content_title?: string | null;
        content_subject?: string | null;
      }
    > = [];

    // 날짜별로 그룹화
    const plansByDate = new Map<string, typeof scheduledPlans>();
    scheduledPlans.forEach((plan) => {
      const date = plan.plan_date;
      if (!plansByDate.has(date)) {
        plansByDate.set(date, []);
      }
      plansByDate.get(date)!.push(plan);
    });

    // 각 날짜별로 시간 할당
    const sortedDates = Array.from(plansByDate.keys()).sort();
    for (const date of sortedDates) {
      const datePlans = plansByDate.get(date)!;
      const timeSlotsForDate = dateTimeSlots.get(date) || [];
      const studyTimeSlots = timeSlotsForDate
        .filter((slot) => slot.type === "학습시간")
        .map((slot) => ({ start: slot.start, end: slot.end }))
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

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

      // 페이로드 생성
      segments.forEach((segment, index) => {
        const metadata = contentMetadataMap.get(segment.plan.content_id);

        planPayloads.push({
          plan_date: date,
          block_index: segment.plan.block_index ?? index,
          content_type: segment.plan.content_type,
          content_id: segment.plan.content_id,
          planned_start_page_or_time: segment.plan.planned_start_page_or_time,
          planned_end_page_or_time: segment.plan.planned_end_page_or_time,
          chapter: null, // chapterMap에서 조회 가능
          start_time: segment.start,
          end_time: segment.end,
          day_type: dayType,
          week: dateMetadata.week_number,
          day: null,
          is_partial: segment.isPartial,
          is_continued: segment.isContinued,
          plan_number: null,
          content_title: metadata?.title ?? null,
          content_subject: metadata?.subject ?? null,
        });
      });
    }

    // 9. 플랜 저장 (서비스 레이어 사용)
    const persistenceService = getPlanPersistenceService();
    const persistResult = await persistenceService.savePlans({
      plans: planPayloads,
      planGroupId: groupId,
      context,
      options: { deleteExisting: true },
    });

    if (!persistResult.success) {
      return {
        success: false,
        error: persistResult.error ?? "플랜 저장에 실패했습니다.",
        errorCode: "PERSISTENCE_FAILED",
      };
    }

    return {
      success: true,
      count: persistResult.data?.savedCount ?? 0,
    };
  } catch (error) {
    console.error("[generatePlansWithServices] 플랜 생성 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
      errorCode: "GENERATION_FAILED",
    };
  }
}

/**
 * 시간 문자열을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 서비스 레이어 기반 플랜 생성 가능 여부 확인
 *
 * 환경 변수나 설정에 따라 새 서비스 레이어 사용 가능 여부 반환
 */
export function canUseServiceBasedGeneration(): boolean {
  return process.env.ENABLE_NEW_PLAN_SERVICES === "true";
}
