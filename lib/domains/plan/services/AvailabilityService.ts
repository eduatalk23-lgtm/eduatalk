/**
 * Availability Service
 *
 * 기존 플랜을 고려한 가용시간 계산 서비스
 * - 일별 스케줄에서 기존 플랜 시간을 차감하여 남은 가용시간 계산
 * - 플랜 배치 상태 시각화를 위한 데이터 제공
 *
 * @module lib/domains/plan/services/AvailabilityService
 */

import type { TimeRange, DailySchedule } from "@/lib/scheduler/calculateAvailableDates";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";

// ============================================
// 타입 정의
// ============================================

/**
 * 기존 플랜 정보 (시간 배치용)
 */
export interface ExistingPlan {
  id: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  content_title?: string;
  plan_group_id?: string | null;
  plan_group_name?: string;
  status?: string;
  block_index?: number | null;
}

/**
 * 점유 슬롯 정보
 */
export interface OccupiedSlot {
  start: string;
  end: string;
  planId: string;
  contentTitle?: string;
  planGroupName?: string;
  contentType: "book" | "lecture" | "custom";
  status?: string;
}

/**
 * 날짜별 가용시간 정보
 */
export interface DailyAvailabilityInfo {
  date: string;
  dayType: string;
  totalAvailableRanges: TimeRange[];
  occupiedSlots: OccupiedSlot[];
  remainingRanges: TimeRange[];
  totalAvailableMinutes: number;
  totalOccupiedMinutes: number;
  totalRemainingMinutes: number;
  existingPlanCount: number;
}

/**
 * 가용시간 계산 결과
 */
export interface AvailabilityWithExistingPlans {
  dailyAvailability: DailyAvailabilityInfo[];
  existingPlans: ExistingPlan[];
  summary: {
    totalAvailableMinutes: number;
    totalOccupiedMinutes: number;
    totalRemainingMinutes: number;
    totalPlanCount: number;
    dateRange: { start: string; end: string };
  };
}

/**
 * 가용시간 계산 입력 파라미터
 */
export interface AvailabilityCalculationInput {
  /** 일별 스케줄 (calculateAvailableDates 결과) */
  dailySchedule: DailySchedule[];
  /** 기존 플랜 목록 */
  existingPlans: ExistingPlan[];
  /** 조회 기간 (선택적, 없으면 dailySchedule 전체) */
  dateRange?: { start: string; end: string };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 두 시간 범위가 겹치는지 확인
 */
function timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  const start1 = timeToMinutes(range1.start);
  const end1 = timeToMinutes(range1.end);
  const start2 = timeToMinutes(range2.start);
  const end2 = timeToMinutes(range2.end);

  return start1 < end2 && start2 < end1;
}

/**
 * 시간 범위에서 다른 시간 범위를 제외
 */
function subtractTimeRange(base: TimeRange, exclude: TimeRange): TimeRange[] {
  const baseStart = timeToMinutes(base.start);
  const baseEnd = timeToMinutes(base.end);
  const excludeStart = timeToMinutes(exclude.start);
  const excludeEnd = timeToMinutes(exclude.end);

  // 겹치지 않으면 원본 반환
  if (excludeEnd <= baseStart || excludeStart >= baseEnd) {
    return [base];
  }

  const result: TimeRange[] = [];

  // 앞부분
  if (baseStart < excludeStart) {
    result.push({
      start: minutesToTime(baseStart),
      end: minutesToTime(excludeStart),
    });
  }

  // 뒷부분
  if (excludeEnd < baseEnd) {
    result.push({
      start: minutesToTime(excludeEnd),
      end: minutesToTime(baseEnd),
    });
  }

  return result;
}

/**
 * 여러 시간 범위를 병합 (겹치는 부분 제거)
 */
function mergeTimeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  // 시작 시간 기준 정렬
  const sorted = [...ranges].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  const merged: TimeRange[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const currentEnd = timeToMinutes(current.end);
    const nextStart = timeToMinutes(next.start);

    // 겹치거나 연속된 경우 병합
    if (nextStart <= currentEnd) {
      current = {
        start: current.start,
        end: minutesToTime(Math.max(currentEnd, timeToMinutes(next.end))),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * 시간 범위의 총 분 계산
 */
function calculateMinutes(ranges: TimeRange[]): number {
  return ranges.reduce((total, range) => {
    const start = timeToMinutes(range.start);
    const end = timeToMinutes(range.end);
    return total + (end - start);
  }, 0);
}

// ============================================
// AvailabilityService
// ============================================

export class AvailabilityService {
  /**
   * 기존 플랜을 고려한 가용시간 계산
   */
  calculateAvailabilityWithExistingPlans(
    input: AvailabilityCalculationInput
  ): AvailabilityWithExistingPlans {
    const { dailySchedule, existingPlans, dateRange } = input;

    // 날짜별 플랜 그룹화
    const plansByDate = this.groupPlansByDate(existingPlans);

    // 날짜별 가용시간 계산
    const dailyAvailability: DailyAvailabilityInfo[] = [];
    let totalAvailableMinutes = 0;
    let totalOccupiedMinutes = 0;
    let totalRemainingMinutes = 0;
    let totalPlanCount = 0;

    // 필터링된 스케줄
    const filteredSchedule = dateRange
      ? dailySchedule.filter(
          (d) => d.date >= dateRange.start && d.date <= dateRange.end
        )
      : dailySchedule;

    for (const schedule of filteredSchedule) {
      const datePlans = plansByDate.get(schedule.date) || [];
      const dayInfo = this.calculateDailyAvailability(schedule, datePlans);

      dailyAvailability.push(dayInfo);

      totalAvailableMinutes += dayInfo.totalAvailableMinutes;
      totalOccupiedMinutes += dayInfo.totalOccupiedMinutes;
      totalRemainingMinutes += dayInfo.totalRemainingMinutes;
      totalPlanCount += dayInfo.existingPlanCount;
    }

    // 기간 계산
    const dates = filteredSchedule.map((s) => s.date).sort();
    const startDate = dates[0] || "";
    const endDate = dates[dates.length - 1] || "";

    return {
      dailyAvailability,
      existingPlans,
      summary: {
        totalAvailableMinutes,
        totalOccupiedMinutes,
        totalRemainingMinutes,
        totalPlanCount,
        dateRange: { start: startDate, end: endDate },
      },
    };
  }

  /**
   * 특정 날짜의 가용시간 계산
   */
  private calculateDailyAvailability(
    schedule: DailySchedule,
    plans: ExistingPlan[]
  ): DailyAvailabilityInfo {
    const totalAvailableRanges = schedule.available_time_ranges || [];
    const totalAvailableMinutes = calculateMinutes(totalAvailableRanges);

    // 플랜의 점유 슬롯 추출
    const occupiedSlots: OccupiedSlot[] = [];
    for (const plan of plans) {
      if (plan.start_time && plan.end_time) {
        occupiedSlots.push({
          start: plan.start_time,
          end: plan.end_time,
          planId: plan.id,
          contentTitle: plan.content_title,
          planGroupName: plan.plan_group_name,
          contentType: plan.content_type,
          status: plan.status,
        });
      }
    }

    // 점유 슬롯 시간 순 정렬
    occupiedSlots.sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    // 남은 가용시간 계산 (전체 가용시간 - 점유 시간)
    let remainingRanges = [...totalAvailableRanges];
    for (const slot of occupiedSlots) {
      const slotRange: TimeRange = { start: slot.start, end: slot.end };
      remainingRanges = remainingRanges.flatMap((range) =>
        subtractTimeRange(range, slotRange)
      );
    }
    remainingRanges = mergeTimeRanges(remainingRanges);

    const totalOccupiedMinutes = occupiedSlots.reduce((sum, slot) => {
      return sum + (timeToMinutes(slot.end) - timeToMinutes(slot.start));
    }, 0);
    const totalRemainingMinutes = calculateMinutes(remainingRanges);

    return {
      date: schedule.date,
      dayType: schedule.day_type,
      totalAvailableRanges,
      occupiedSlots,
      remainingRanges,
      totalAvailableMinutes,
      totalOccupiedMinutes,
      totalRemainingMinutes,
      existingPlanCount: plans.length,
    };
  }

  /**
   * 날짜별 플랜 그룹화
   */
  private groupPlansByDate(plans: ExistingPlan[]): Map<string, ExistingPlan[]> {
    const grouped = new Map<string, ExistingPlan[]>();

    for (const plan of plans) {
      const date = plan.plan_date;
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(plan);
    }

    return grouped;
  }

  /**
   * 특정 기간의 가용시간 요약 조회
   */
  getAvailabilitySummaryForPeriod(
    dailyAvailability: DailyAvailabilityInfo[],
    periodStart: string,
    periodEnd: string
  ): {
    totalAvailableMinutes: number;
    totalOccupiedMinutes: number;
    totalRemainingMinutes: number;
    averageDailyAvailableMinutes: number;
    averageDailyOccupiedMinutes: number;
    daysWithAvailability: number;
    daysFullyOccupied: number;
  } {
    const filteredDays = dailyAvailability.filter(
      (d) => d.date >= periodStart && d.date <= periodEnd
    );

    let totalAvailable = 0;
    let totalOccupied = 0;
    let totalRemaining = 0;
    let daysWithAvailability = 0;
    let daysFullyOccupied = 0;

    for (const day of filteredDays) {
      totalAvailable += day.totalAvailableMinutes;
      totalOccupied += day.totalOccupiedMinutes;
      totalRemaining += day.totalRemainingMinutes;

      if (day.totalAvailableMinutes > 0) {
        daysWithAvailability++;
        if (day.totalRemainingMinutes <= 0) {
          daysFullyOccupied++;
        }
      }
    }

    const dayCount = filteredDays.length || 1;

    return {
      totalAvailableMinutes: totalAvailable,
      totalOccupiedMinutes: totalOccupied,
      totalRemainingMinutes: totalRemaining,
      averageDailyAvailableMinutes: totalAvailable / dayCount,
      averageDailyOccupiedMinutes: totalOccupied / dayCount,
      daysWithAvailability,
      daysFullyOccupied,
    };
  }

  /**
   * 새 플랜 배치 가능 여부 확인
   */
  canPlacePlan(
    dailyInfo: DailyAvailabilityInfo,
    durationMinutes: number
  ): {
    canPlace: boolean;
    suggestedSlots: TimeRange[];
    conflicts: string[];
  } {
    const suggestedSlots: TimeRange[] = [];
    const conflicts: string[] = [];

    // 남은 가용 시간에서 배치 가능한 슬롯 찾기
    for (const range of dailyInfo.remainingRanges) {
      const rangeMinutes = timeToMinutes(range.end) - timeToMinutes(range.start);
      if (rangeMinutes >= durationMinutes) {
        suggestedSlots.push(range);
      }
    }

    // 총 남은 시간이 부족한 경우
    if (dailyInfo.totalRemainingMinutes < durationMinutes) {
      conflicts.push(
        `가용 시간 부족: 필요 ${durationMinutes}분, 남은 시간 ${dailyInfo.totalRemainingMinutes}분`
      );
    }

    // 연속된 슬롯이 없는 경우
    if (suggestedSlots.length === 0 && dailyInfo.totalRemainingMinutes > 0) {
      conflicts.push(
        `연속 ${durationMinutes}분 슬롯 없음 (분산된 ${dailyInfo.totalRemainingMinutes}분 존재)`
      );
    }

    return {
      canPlace: suggestedSlots.length > 0,
      suggestedSlots,
      conflicts,
    };
  }

  /**
   * 여러 날짜에 걸쳐 플랜 배치 가능한 슬롯 찾기
   */
  findAvailableSlotsForDuration(
    dailyAvailability: DailyAvailabilityInfo[],
    durationMinutes: number,
    preferredDates?: string[]
  ): Array<{
    date: string;
    slot: TimeRange;
    remainingAfterPlacement: number;
  }> {
    const availableSlots: Array<{
      date: string;
      slot: TimeRange;
      remainingAfterPlacement: number;
    }> = [];

    // 우선 선호 날짜 순서, 그 다음 일반 날짜 순서
    const sortedDays = [...dailyAvailability].sort((a, b) => {
      const aPreferred = preferredDates?.includes(a.date) ? 0 : 1;
      const bPreferred = preferredDates?.includes(b.date) ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return a.date.localeCompare(b.date);
    });

    for (const day of sortedDays) {
      for (const range of day.remainingRanges) {
        const rangeMinutes = timeToMinutes(range.end) - timeToMinutes(range.start);
        if (rangeMinutes >= durationMinutes) {
          availableSlots.push({
            date: day.date,
            slot: {
              start: range.start,
              end: minutesToTime(timeToMinutes(range.start) + durationMinutes),
            },
            remainingAfterPlacement: rangeMinutes - durationMinutes,
          });
        }
      }
    }

    return availableSlots;
  }
}

// 싱글톤 인스턴스
let instance: AvailabilityService | null = null;

/**
 * AvailabilityService 싱글톤 인스턴스 반환
 */
export function getAvailabilityService(): AvailabilityService {
  if (!instance) {
    instance = new AvailabilityService();
  }
  return instance;
}
