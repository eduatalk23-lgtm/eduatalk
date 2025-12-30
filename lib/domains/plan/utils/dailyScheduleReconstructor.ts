/**
 * Daily Schedule Reconstructor
 *
 * P1 최적화: 저장된 daily_schedule 데이터를 활용하여
 * calculateAvailableDates 재계산을 최소화합니다.
 *
 * @module lib/domains/plan/utils/dailyScheduleReconstructor
 */

import type {
  DailySchedule,
  ScheduleAvailabilityResult,
  ScheduleSummary,
} from "@/lib/scheduler/calculateAvailableDates";

/**
 * 저장된 daily_schedule의 유효성 검사 결과
 */
export type DailyScheduleValidationResult = {
  isValid: boolean;
  reason?: string;
  storedSchedule?: DailySchedule[];
};

/**
 * 저장된 daily_schedule이 플랜 생성에 사용 가능한지 검증합니다.
 *
 * 유효성 조건:
 * 1. daily_schedule이 존재하고 비어있지 않음
 * 2. 기간(period_start/end)이 저장된 스케줄의 날짜 범위와 일치
 * 3. 각 날짜 항목에 필수 필드(time_slots, available_time_ranges)가 있음
 *
 * @param storedDailySchedule - DB에 저장된 daily_schedule
 * @param periodStart - 현재 플랜 그룹의 시작일 (YYYY-MM-DD)
 * @param periodEnd - 현재 플랜 그룹의 종료일 (YYYY-MM-DD)
 */
export function validateStoredDailySchedule(
  storedDailySchedule: unknown,
  periodStart: string,
  periodEnd: string
): DailyScheduleValidationResult {
  // 1. daily_schedule 존재 및 배열 확인
  if (!storedDailySchedule || !Array.isArray(storedDailySchedule)) {
    return {
      isValid: false,
      reason: "daily_schedule이 존재하지 않거나 배열이 아닙니다.",
    };
  }

  if (storedDailySchedule.length === 0) {
    return {
      isValid: false,
      reason: "daily_schedule이 비어 있습니다.",
    };
  }

  // 2. 타입 체크 및 필수 필드 검증
  const typedSchedule = storedDailySchedule as DailySchedule[];
  for (const entry of typedSchedule) {
    if (!entry.date || !entry.day_type) {
      return {
        isValid: false,
        reason: `일부 항목에 date 또는 day_type이 누락되었습니다.`,
      };
    }

    // 학습일/복습일의 경우 time_slots 필수
    if (
      (entry.day_type === "학습일" || entry.day_type === "복습일") &&
      (!entry.time_slots || entry.time_slots.length === 0)
    ) {
      return {
        isValid: false,
        reason: `학습일/복습일(${entry.date})에 time_slots이 누락되었습니다.`,
      };
    }
  }

  // 3. 날짜 범위 검증 (시작일과 종료일이 저장된 스케줄에 포함되어 있는지)
  const scheduleDates = typedSchedule.map((d) => d.date).sort();
  const firstDate = scheduleDates[0];
  const lastDate = scheduleDates[scheduleDates.length - 1];

  if (firstDate !== periodStart || lastDate !== periodEnd) {
    return {
      isValid: false,
      reason: `기간 불일치: 저장된 스케줄(${firstDate}~${lastDate}) vs 현재 기간(${periodStart}~${periodEnd})`,
    };
  }

  // 모든 검증 통과
  return {
    isValid: true,
    storedSchedule: typedSchedule,
  };
}

/**
 * 저장된 daily_schedule에서 ScheduleSummary를 재구성합니다.
 *
 * Note: 이 함수는 최소한의 summary 정보만 생성합니다.
 * generatePlansRefactored에서는 summary를 직접 사용하지 않지만,
 * ScheduleAvailabilityResult 타입 호환성을 위해 필요합니다.
 */
function reconstructSummary(
  dailySchedule: DailySchedule[],
  periodStart: string,
  periodEnd: string
): ScheduleSummary {
  let totalStudyDays = 0;
  let totalReviewDays = 0;
  let totalStudyHours = 0;
  let totalStudyHours학습일 = 0;
  let totalStudyHours복습일 = 0;
  let totalSelfStudyHours = 0;
  const exclusionCounts = {
    휴가: 0,
    개인사정: 0,
    지정휴일: 0,
  };

  for (const day of dailySchedule) {
    if (day.day_type === "학습일") {
      totalStudyDays++;
      totalStudyHours += day.study_hours;
      totalStudyHours학습일 += day.study_hours;
    } else if (day.day_type === "복습일") {
      totalReviewDays++;
      totalStudyHours += day.study_hours;
      totalStudyHours복습일 += day.study_hours;
    } else if (day.day_type === "지정휴일") {
      exclusionCounts["지정휴일"]++;
      // 지정휴일의 자율학습 시간
      const selfStudySlots =
        day.time_slots?.filter((s) => s.type === "자율학습") || [];
      for (const slot of selfStudySlots) {
        const start = parseTimeToMinutes(slot.start);
        const end = parseTimeToMinutes(slot.end);
        totalSelfStudyHours += (end - start) / 60;
      }
    } else if (day.day_type === "휴가") {
      exclusionCounts["휴가"]++;
    } else if (day.day_type === "개인일정") {
      exclusionCounts["개인사정"]++;
    }
  }

  return {
    total_days: dailySchedule.length,
    total_study_days: totalStudyDays,
    total_review_days: totalReviewDays,
    total_study_hours: totalStudyHours,
    total_study_hours_학습일: totalStudyHours학습일,
    total_study_hours_복습일: totalStudyHours복습일,
    total_self_study_hours: totalSelfStudyHours,
    total_exclusion_days: exclusionCounts,
    academy_statistics: {
      total_academy_schedules: 0,
      unique_academies: 0,
      total_academy_hours: 0,
      total_travel_hours: 0,
      average_travel_time: 0,
      academy_groups: [],
    },
    camp_period: {
      start_date: periodStart,
      end_date: periodEnd,
    },
  };
}

/**
 * HH:mm 형식의 시간을 분 단위로 변환
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 저장된 daily_schedule에서 ScheduleAvailabilityResult를 재구성합니다.
 *
 * @param dailySchedule - 저장된 daily_schedule
 * @param periodStart - 플랜 그룹 시작일
 * @param periodEnd - 플랜 그룹 종료일
 */
export function reconstructScheduleResult(
  dailySchedule: DailySchedule[],
  periodStart: string,
  periodEnd: string
): ScheduleAvailabilityResult {
  const summary = reconstructSummary(dailySchedule, periodStart, periodEnd);

  return {
    summary,
    daily_schedule: dailySchedule,
    errors: [],
  };
}

/**
 * 저장된 daily_schedule을 사용할지 재계산할지 결정합니다.
 *
 * @returns shouldRecalculate가 false이고 storedSchedule이 있으면 저장된 스케줄 사용
 */
export function shouldUseCachedDailySchedule(
  storedDailySchedule: unknown,
  periodStart: string,
  periodEnd: string
): {
  shouldRecalculate: boolean;
  storedSchedule?: DailySchedule[];
  reason?: string;
} {
  const validation = validateStoredDailySchedule(
    storedDailySchedule,
    periodStart,
    periodEnd
  );

  if (validation.isValid && validation.storedSchedule) {
    console.log(
      "[dailyScheduleReconstructor] 저장된 daily_schedule 재사용:",
      {
        periodStart,
        periodEnd,
        entryCount: validation.storedSchedule.length,
      }
    );
    return {
      shouldRecalculate: false,
      storedSchedule: validation.storedSchedule,
    };
  }

  console.log(
    "[dailyScheduleReconstructor] daily_schedule 재계산 필요:",
    validation.reason
  );
  return {
    shouldRecalculate: true,
    reason: validation.reason,
  };
}
