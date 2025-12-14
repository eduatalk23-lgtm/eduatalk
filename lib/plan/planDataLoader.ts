/**
 * 플랜 데이터 로더
 *
 * 플랜 생성/미리보기에서 공통으로 사용하는 데이터 로딩 기능을 제공합니다.
 *
 * @module lib/plan/planDataLoader
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlanGroupWithDetailsByRole } from "@/lib/auth/planGroupAuth";
import { getBlockSetForPlanGroup } from "@/lib/plan/blocks";
import { getMergedSchedulerSettings } from "@/lib/data/schedulerSettings";
import { calculateAvailableDates } from "@/lib/scheduler/calculateAvailableDates";
import type {
  LoadedPlanGroupData,
  ScheduleCalculationResult,
  DateAvailableTimeRangesMap,
  DateTimeSlotsMap,
  DateMetadataMap,
  WeekDatesMap,
} from "@/lib/types/plan-generation";
import type { PlanGroup, NonStudyTimeBlock } from "@/lib/types/plan";
import { validateAllocations } from "@/lib/utils/subjectAllocation";

// ============================================
// 타입 정의
// ============================================

/**
 * 스케줄러 옵션 (병합된)
 */
export type MergedSchedulerOptions = {
  study_days: number;
  review_days: number;
  weak_subject_focus?: "low" | "medium" | "high" | boolean;
  review_scope?: string;
  lunch_time?: { start: string; end: string };
  camp_study_hours?: { start: string; end: string };
  self_study_hours?: { start: string; end: string };
};

/**
 * 기본 블록 정보
 */
export type BaseBlock = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

/**
 * 스케줄 계산 옵션
 */
export type ScheduleCalculationOptions = {
  scheduler_type: string;
  scheduler_options: Record<string, unknown> | null;
  use_self_study_with_blocks: boolean;
  enable_self_study_for_holidays: boolean;
  enable_self_study_for_study_days: boolean;
  lunch_time?: { start: string; end: string };
  camp_study_hours?: { start: string; end: string };
  camp_self_study_hours?: { start: string; end: string };
  designated_holiday_hours?: { start: string; end: string };
  non_study_time_blocks?: NonStudyTimeBlock[] | null;
};

// ============================================
// 데이터 로딩 함수
// ============================================

/**
 * 플랜 그룹과 관련 데이터를 로드합니다.
 *
 * @param groupId 플랜 그룹 ID
 * @param userId 현재 사용자 ID
 * @param role 사용자 역할
 * @param tenantId 테넌트 ID
 * @returns 로드된 플랜 그룹 데이터
 */
export async function loadPlanGroupData(
  groupId: string,
  userId: string,
  role: "student" | "admin" | "consultant",
  tenantId: string
): Promise<LoadedPlanGroupData | null> {
  const result = await getPlanGroupWithDetailsByRole(
    groupId,
    userId,
    role,
    tenantId
  );

  if (!result.group) {
    return null;
  }

  return {
    group: result.group,
    contents: result.contents,
    exclusions: result.exclusions,
    academySchedules: result.academySchedules,
  };
}

/**
 * 병합된 스케줄러 설정을 로드합니다.
 *
 * @param tenantId 테넌트 ID
 * @param campTemplateId 캠프 템플릿 ID (선택)
 * @param schedulerOptions 플랜 그룹의 스케줄러 옵션
 * @returns 병합된 스케줄러 옵션
 */
export async function loadSchedulerSettings(
  tenantId: string,
  campTemplateId?: string | null,
  schedulerOptions?: Record<string, unknown> | null
): Promise<MergedSchedulerOptions> {
  const mergedSettings = await getMergedSchedulerSettings(
    tenantId,
    campTemplateId || undefined,
    schedulerOptions || undefined
  );

  return {
    study_days: mergedSettings.study_review_ratio.study_days,
    review_days: mergedSettings.study_review_ratio.review_days,
    weak_subject_focus: mergedSettings.weak_subject_focus,
    review_scope: mergedSettings.review_scope,
    lunch_time: mergedSettings.lunch_time,
    camp_study_hours: mergedSettings.study_hours,
    self_study_hours: mergedSettings.self_study_hours,
  };
}

/**
 * 플랜 그룹의 블록 세트를 로드합니다.
 *
 * @param group 플랜 그룹
 * @param studentId 학생 ID
 * @param userId 현재 사용자 ID
 * @param role 사용자 역할
 * @param tenantId 테넌트 ID
 * @returns 기본 블록 배열
 */
export async function loadBaseBlocks(
  group: PlanGroup,
  studentId: string,
  userId: string,
  role: "student" | "admin" | "consultant",
  tenantId: string
): Promise<BaseBlock[]> {
  const blocks = await getBlockSetForPlanGroup(
    group,
    studentId,
    userId,
    role,
    tenantId
  );

  return blocks.map((b) => ({
    day_of_week: b.day_of_week,
    start_time: b.start_time,
    end_time: b.end_time,
  }));
}

// ============================================
// 스케줄 계산 함수
// ============================================

/**
 * 스케줄 결과를 계산합니다.
 *
 * @param group 플랜 그룹
 * @param baseBlocks 기본 블록 배열
 * @param exclusions 제외일 배열
 * @param academySchedules 학원 일정 배열
 * @param options 스케줄 계산 옵션
 * @returns 스케줄 계산 결과
 */
export function calculateSchedule(
  group: PlanGroup,
  baseBlocks: BaseBlock[],
  exclusions: Array<{
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  }>,
  academySchedules: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    academy_name?: string | null;
    subject?: string | null;
    travel_time?: number | null;
  }>,
  options: ScheduleCalculationOptions
): ScheduleCalculationResult {
  // calculateAvailableDates 호출
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
      exclusion_type: e.exclusion_type as
        | "휴가"
        | "개인사정"
        | "휴일지정"
        | "기타",
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
      scheduler_type: options.scheduler_type as "1730_timetable",
      scheduler_options: options.scheduler_options as { study_days?: number; review_days?: number } | undefined,
      use_self_study_with_blocks: options.use_self_study_with_blocks,
      enable_self_study_for_holidays: options.enable_self_study_for_holidays,
      enable_self_study_for_study_days: options.enable_self_study_for_study_days,
      lunch_time: options.lunch_time,
      camp_study_hours: options.camp_study_hours,
      camp_self_study_hours: options.camp_self_study_hours,
      designated_holiday_hours: options.designated_holiday_hours,
      non_study_time_blocks: options.non_study_time_blocks || undefined,
    }
  );

  // 결과에서 Map 추출
  return extractScheduleMaps(scheduleResult);
}

/**
 * 스케줄 결과에서 Map들을 추출합니다.
 *
 * @param scheduleResult calculateAvailableDates 결과
 * @returns 추출된 Map들
 */
export function extractScheduleMaps(
  scheduleResult: ReturnType<typeof calculateAvailableDates>
): ScheduleCalculationResult {
  const dateAvailableTimeRanges: DateAvailableTimeRangesMap = new Map();
  const dateTimeSlots: DateTimeSlotsMap = new Map();
  const dateMetadataMap: DateMetadataMap = new Map();
  const weekDatesMap: WeekDatesMap = new Map();

  scheduleResult.daily_schedule.forEach((daily) => {
    // 학습일과 복습일 모두 포함
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

    // time_slots 정보 저장
    if (daily.time_slots && daily.time_slots.length > 0) {
      dateTimeSlots.set(
        daily.date,
        daily.time_slots.map((slot) => ({
          type: slot.type as
            | "학습시간"
            | "점심시간"
            | "학원일정"
            | "이동시간"
            | "자율학습",
          start: slot.start,
          end: slot.end,
          label: slot.label,
        }))
      );
    }

    // 날짜별 메타데이터 저장
    dateMetadataMap.set(daily.date, {
      day_type: (daily.day_type as
        | "학습일"
        | "복습일"
        | "지정휴일"
        | "휴가"
        | "개인일정") || null,
      week_number: daily.week_number || null,
    });

    // 주차별 날짜 목록 구성
    if (daily.week_number) {
      if (!weekDatesMap.has(daily.week_number)) {
        weekDatesMap.set(daily.week_number, []);
      }
      // 제외일이 아닌 날짜만 주차에 포함
      if (
        daily.day_type &&
        daily.day_type !== "휴가" &&
        daily.day_type !== "개인일정" &&
        daily.day_type !== "지정휴일"
      ) {
        weekDatesMap.get(daily.week_number)!.push(daily.date);
      }
    }
  });

  // 주차별 날짜 목록 정렬
  weekDatesMap.forEach((dates) => {
    dates.sort();
  });

  return {
    dateAvailableTimeRanges,
    dateTimeSlots,
    dateMetadataMap,
    weekDatesMap,
  };
}

/**
 * 스케줄 계산 옵션을 생성합니다.
 *
 * @param group 플랜 그룹
 * @param schedulerOptions 스케줄러 옵션
 * @returns 스케줄 계산 옵션
 */
export function createScheduleCalculationOptions(
  group: PlanGroup,
  schedulerOptions: MergedSchedulerOptions
): ScheduleCalculationOptions {
  const groupOptions = group.scheduler_options as Record<string, unknown> | null;

  // subject_allocations와 content_allocations 추출 및 검증
  const subjectAllocations = groupOptions?.subject_allocations as
    | Array<{
        subject_id?: string;
        subject_name: string;
        subject_type: "strategy" | "weakness";
        weekly_days?: number;
      }>
    | undefined;
  const contentAllocations = groupOptions?.content_allocations as
    | Array<{
        content_type: "book" | "lecture" | "custom";
        content_id: string;
        subject_type: "strategy" | "weakness";
        weekly_days?: number;
      }>
    | undefined;

  // 데이터 검증
  if (subjectAllocations || contentAllocations) {
    const validation = validateAllocations(contentAllocations, subjectAllocations);
    if (!validation.valid) {
      console.warn("[createScheduleCalculationOptions] 전략과목/취약과목 설정 검증 실패:", {
        groupId: group.id,
        errors: validation.errors,
        subjectAllocations,
        contentAllocations,
      });
      // 검증 실패 시에도 계속 진행하되, 잘못된 설정은 무시
    }
  }

  return {
    scheduler_type: group.scheduler_type || "1730_timetable",
    scheduler_options: {
      study_days: schedulerOptions.study_days,
      review_days: schedulerOptions.review_days,
      weak_subject_focus: schedulerOptions.weak_subject_focus,
      review_scope: schedulerOptions.review_scope,
      lunch_time: schedulerOptions.lunch_time,
      camp_study_hours: schedulerOptions.camp_study_hours,
      self_study_hours: schedulerOptions.self_study_hours,
      // subject_allocations와 content_allocations를 scheduler_options에 포함
      subject_allocations: subjectAllocations,
      content_allocations: contentAllocations,
    },
    use_self_study_with_blocks: true,
    enable_self_study_for_holidays:
      (groupOptions?.enable_self_study_for_holidays as boolean) === true,
    enable_self_study_for_study_days:
      (groupOptions?.enable_self_study_for_study_days as boolean) === true,
    lunch_time: schedulerOptions.lunch_time,
    camp_study_hours: schedulerOptions.camp_study_hours,
    camp_self_study_hours: schedulerOptions.self_study_hours,
    designated_holiday_hours: groupOptions?.designated_holiday_hours as
      | { start: string; end: string }
      | undefined,
    non_study_time_blocks: group.non_study_time_blocks,
  };
}
