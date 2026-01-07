/**
 * Auto Slot Placement Service
 *
 * 새 플랜을 기존 가용시간에 자동으로 배치하는 서비스
 * - First-Fit: 첫 번째로 수용 가능한 슬롯에 배치
 * - Best-Fit: 남는 공간이 가장 작은 슬롯에 배치 (공간 효율 최적화)
 * - Spread: 날짜별로 균등하게 분산 배치
 *
 * @module lib/domains/plan/services/AutoSlotPlacementService
 */

import type { TimeRange } from "@/lib/scheduler/calculateAvailableDates";
import type { DailyAvailabilityInfo, ExistingPlan } from "./AvailabilityService";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";

// ============================================
// 타입 정의
// ============================================

/**
 * 배치 전략
 */
export type PlacementStrategy = "first-fit" | "best-fit" | "spread";

/**
 * 배치 입력 데이터
 */
export interface PlacementInput {
  /** 콘텐츠 ID */
  contentId: string;
  /** 콘텐츠 타입 */
  contentType: "book" | "lecture" | "custom";
  /** 콘텐츠 제목 */
  contentTitle: string;
  /** 소요 시간 (분) */
  durationMinutes: number;
  /** 우선순위 (낮을수록 높음, 기본 1) */
  priority?: number;
  /** 선호 날짜 목록 (선택적) */
  preferredDates?: string[];
}

/**
 * 자동 배치 입력 파라미터
 */
export interface AutoPlacementInput {
  /** 배치할 콘텐츠 목록 */
  contents: PlacementInput[];
  /** 기간 시작일 */
  periodStart: string;
  /** 기간 종료일 */
  periodEnd: string;
  /** 기존 플랜 목록 */
  existingPlans: ExistingPlan[];
  /** 일별 가용시간 정보 */
  dailyAvailability: DailyAvailabilityInfo[];
  /** 배치 전략 */
  strategy: PlacementStrategy;
  /** 최대 일일 플랜 수 (선택적) */
  maxDailyPlans?: number;
  /** 최소 플랜 간격 (분, 선택적) */
  minPlanGapMinutes?: number;
}

/**
 * 배치 결과 (개별 플랜)
 */
export interface PlacementResult {
  contentId: string;
  contentType: "book" | "lecture" | "custom";
  contentTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priority: number;
}

/**
 * 충돌 정보
 */
export interface PlacementConflict {
  contentId: string;
  contentTitle: string;
  reason: string;
  suggestedDates?: string[];
  overlappingPlan?: {
    planId: string;
    contentTitle?: string;
    date: string;
    startTime: string;
    endTime: string;
  };
}

/**
 * 자동 배치 출력
 */
export interface AutoPlacementOutput {
  success: boolean;
  placements: PlacementResult[];
  conflicts: PlacementConflict[];
  alternatives?: AutoPlacementOutput;
  summary: {
    totalContents: number;
    placedContents: number;
    conflictedContents: number;
    totalMinutesPlaced: number;
  };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 시간 범위에서 다른 시간 범위를 제외
 */
function subtractTimeRange(base: TimeRange, exclude: TimeRange): TimeRange[] {
  const baseStart = timeToMinutes(base.start);
  const baseEnd = timeToMinutes(base.end);
  const excludeStart = timeToMinutes(exclude.start);
  const excludeEnd = timeToMinutes(exclude.end);

  if (excludeEnd <= baseStart || excludeStart >= baseEnd) {
    return [base];
  }

  const result: TimeRange[] = [];

  if (baseStart < excludeStart) {
    result.push({
      start: minutesToTime(baseStart),
      end: minutesToTime(excludeStart),
    });
  }

  if (excludeEnd < baseEnd) {
    result.push({
      start: minutesToTime(excludeEnd),
      end: minutesToTime(baseEnd),
    });
  }

  return result;
}

// ============================================
// AutoSlotPlacementService
// ============================================

export class AutoSlotPlacementService {
  /**
   * 자동 슬롯 배치 실행
   */
  autoPlace(input: AutoPlacementInput): AutoPlacementOutput {
    const {
      contents,
      periodStart,
      periodEnd,
      dailyAvailability,
      strategy,
      maxDailyPlans = 10,
      minPlanGapMinutes = 0,
    } = input;

    // 기간 내 날짜만 필터링
    const availableDays = dailyAvailability.filter(
      (d) => d.date >= periodStart && d.date <= periodEnd
    );

    // 날짜별 가용시간 복사 (수정용)
    const mutableAvailability = new Map<string, TimeRange[]>();
    const dailyPlanCounts = new Map<string, number>();

    for (const day of availableDays) {
      mutableAvailability.set(day.date, [...day.remainingRanges]);
      dailyPlanCounts.set(day.date, day.existingPlanCount);
    }

    // 우선순위별 정렬 (낮을수록 우선)
    const sortedContents = [...contents].sort(
      (a, b) => (a.priority ?? 1) - (b.priority ?? 1)
    );

    const placements: PlacementResult[] = [];
    const conflicts: PlacementConflict[] = [];

    // 각 콘텐츠 배치
    for (const content of sortedContents) {
      const result = this.placeContent(
        content,
        mutableAvailability,
        dailyPlanCounts,
        strategy,
        maxDailyPlans,
        minPlanGapMinutes,
        availableDays
      );

      if (result.success && result.placement) {
        placements.push(result.placement);

        // 가용시간 업데이트
        const date = result.placement.date;
        const usedSlot: TimeRange = {
          start: result.placement.startTime,
          end: result.placement.endTime,
        };

        const currentRanges = mutableAvailability.get(date) || [];
        const updatedRanges = currentRanges.flatMap((range) =>
          subtractTimeRange(range, usedSlot)
        );
        mutableAvailability.set(date, updatedRanges);

        // 플랜 수 업데이트
        dailyPlanCounts.set(date, (dailyPlanCounts.get(date) || 0) + 1);
      } else if (result.conflict) {
        conflicts.push(result.conflict);
      }
    }

    const totalMinutesPlaced = placements.reduce(
      (sum, p) => sum + p.durationMinutes,
      0
    );

    return {
      success: conflicts.length === 0,
      placements,
      conflicts,
      summary: {
        totalContents: contents.length,
        placedContents: placements.length,
        conflictedContents: conflicts.length,
        totalMinutesPlaced,
      },
    };
  }

  /**
   * 개별 콘텐츠 배치
   */
  private placeContent(
    content: PlacementInput,
    availability: Map<string, TimeRange[]>,
    dailyPlanCounts: Map<string, number>,
    strategy: PlacementStrategy,
    maxDailyPlans: number,
    minGap: number,
    availableDays: DailyAvailabilityInfo[]
  ): {
    success: boolean;
    placement?: PlacementResult;
    conflict?: PlacementConflict;
  } {
    const { contentId, contentType, contentTitle, durationMinutes, priority = 1, preferredDates } = content;

    // 전략별 슬롯 찾기
    let slot: { date: string; range: TimeRange } | null = null;

    switch (strategy) {
      case "first-fit":
        slot = this.findFirstFitSlot(
          availability,
          dailyPlanCounts,
          durationMinutes,
          maxDailyPlans,
          minGap,
          preferredDates
        );
        break;

      case "best-fit":
        slot = this.findBestFitSlot(
          availability,
          dailyPlanCounts,
          durationMinutes,
          maxDailyPlans,
          minGap,
          preferredDates
        );
        break;

      case "spread":
        slot = this.findSpreadSlot(
          availability,
          dailyPlanCounts,
          durationMinutes,
          maxDailyPlans,
          minGap,
          availableDays
        );
        break;
    }

    if (slot) {
      const startMinutes = timeToMinutes(slot.range.start);
      const endMinutes = startMinutes + durationMinutes;

      return {
        success: true,
        placement: {
          contentId,
          contentType,
          contentTitle,
          date: slot.date,
          startTime: slot.range.start,
          endTime: minutesToTime(endMinutes),
          durationMinutes,
          priority,
        },
      };
    }

    // 배치 실패 - 충돌 정보 생성
    const suggestedDates = this.findAlternativeDates(
      availability,
      durationMinutes
    );

    return {
      success: false,
      conflict: {
        contentId,
        contentTitle,
        reason: `${durationMinutes}분 연속 슬롯을 찾을 수 없습니다.`,
        suggestedDates: suggestedDates.length > 0 ? suggestedDates : undefined,
      },
    };
  }

  /**
   * First-Fit: 첫 번째 수용 가능한 슬롯 찾기
   */
  private findFirstFitSlot(
    availability: Map<string, TimeRange[]>,
    dailyPlanCounts: Map<string, number>,
    duration: number,
    maxDaily: number,
    minGap: number,
    preferredDates?: string[]
  ): { date: string; range: TimeRange } | null {
    // 선호 날짜 우선 정렬
    const dates = Array.from(availability.keys()).sort((a, b) => {
      const aPreferred = preferredDates?.includes(a) ? 0 : 1;
      const bPreferred = preferredDates?.includes(b) ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return a.localeCompare(b);
    });

    for (const date of dates) {
      const planCount = dailyPlanCounts.get(date) || 0;
      if (planCount >= maxDaily) continue;

      const ranges = availability.get(date) || [];
      for (const range of ranges) {
        const rangeMinutes = timeToMinutes(range.end) - timeToMinutes(range.start);
        if (rangeMinutes >= duration + minGap) {
          return {
            date,
            range: {
              start: range.start,
              end: minutesToTime(timeToMinutes(range.start) + duration),
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * Best-Fit: 남는 공간이 가장 작은 슬롯 찾기
   */
  private findBestFitSlot(
    availability: Map<string, TimeRange[]>,
    dailyPlanCounts: Map<string, number>,
    duration: number,
    maxDaily: number,
    minGap: number,
    preferredDates?: string[]
  ): { date: string; range: TimeRange } | null {
    let bestSlot: { date: string; range: TimeRange; remaining: number } | null = null;

    // 선호 날짜 우선 정렬
    const dates = Array.from(availability.keys()).sort((a, b) => {
      const aPreferred = preferredDates?.includes(a) ? 0 : 1;
      const bPreferred = preferredDates?.includes(b) ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return a.localeCompare(b);
    });

    for (const date of dates) {
      const planCount = dailyPlanCounts.get(date) || 0;
      if (planCount >= maxDaily) continue;

      const ranges = availability.get(date) || [];
      for (const range of ranges) {
        const rangeMinutes = timeToMinutes(range.end) - timeToMinutes(range.start);
        const remaining = rangeMinutes - duration - minGap;

        if (remaining >= 0) {
          // 선호 날짜 가중치 적용
          const preferredBonus = preferredDates?.includes(date) ? -1000 : 0;
          const effectiveRemaining = remaining + preferredBonus;

          if (!bestSlot || effectiveRemaining < bestSlot.remaining) {
            bestSlot = {
              date,
              range: {
                start: range.start,
                end: minutesToTime(timeToMinutes(range.start) + duration),
              },
              remaining: effectiveRemaining,
            };
          }
        }
      }
    }

    return bestSlot
      ? { date: bestSlot.date, range: bestSlot.range }
      : null;
  }

  /**
   * Spread: 균등 분산 배치
   */
  private findSpreadSlot(
    availability: Map<string, TimeRange[]>,
    dailyPlanCounts: Map<string, number>,
    duration: number,
    maxDaily: number,
    minGap: number,
    availableDays: DailyAvailabilityInfo[]
  ): { date: string; range: TimeRange } | null {
    // 플랜 수가 적은 날짜 우선 정렬
    const sortedDates = Array.from(availability.keys()).sort((a, b) => {
      const countA = dailyPlanCounts.get(a) || 0;
      const countB = dailyPlanCounts.get(b) || 0;
      if (countA !== countB) return countA - countB;
      return a.localeCompare(b);
    });

    for (const date of sortedDates) {
      const planCount = dailyPlanCounts.get(date) || 0;
      if (planCount >= maxDaily) continue;

      const ranges = availability.get(date) || [];
      for (const range of ranges) {
        const rangeMinutes = timeToMinutes(range.end) - timeToMinutes(range.start);
        if (rangeMinutes >= duration + minGap) {
          return {
            date,
            range: {
              start: range.start,
              end: minutesToTime(timeToMinutes(range.start) + duration),
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * 대체 가능 날짜 찾기
   */
  private findAlternativeDates(
    availability: Map<string, TimeRange[]>,
    duration: number
  ): string[] {
    const alternatives: string[] = [];

    for (const [date, ranges] of availability.entries()) {
      const totalMinutes = ranges.reduce(
        (sum, r) => sum + (timeToMinutes(r.end) - timeToMinutes(r.start)),
        0
      );

      // 총 가용 시간이 충분한 날짜 (연속은 아니더라도)
      if (totalMinutes >= duration * 0.8) {
        alternatives.push(date);
      }
    }

    return alternatives.slice(0, 5);
  }

  /**
   * 배치 미리보기 생성
   */
  previewPlacement(
    input: AutoPlacementInput
  ): {
    placements: PlacementResult[];
    conflicts: PlacementConflict[];
    dailyBreakdown: Map<string, {
      date: string;
      beforePlacement: { totalMinutes: number; ranges: TimeRange[] };
      afterPlacement: { totalMinutes: number; ranges: TimeRange[] };
      newPlacements: PlacementResult[];
    }>;
  } {
    const result = this.autoPlace(input);

    // 날짜별 변경 내역 계산
    const dailyBreakdown = new Map<string, {
      date: string;
      beforePlacement: { totalMinutes: number; ranges: TimeRange[] };
      afterPlacement: { totalMinutes: number; ranges: TimeRange[] };
      newPlacements: PlacementResult[];
    }>();

    // 날짜별 배치 그룹화
    const placementsByDate = new Map<string, PlacementResult[]>();
    for (const placement of result.placements) {
      if (!placementsByDate.has(placement.date)) {
        placementsByDate.set(placement.date, []);
      }
      placementsByDate.get(placement.date)!.push(placement);
    }

    // 각 날짜별 변경 내역 계산
    for (const day of input.dailyAvailability) {
      const datePlacements = placementsByDate.get(day.date) || [];

      let afterRanges = [...day.remainingRanges];
      for (const placement of datePlacements) {
        const usedSlot: TimeRange = {
          start: placement.startTime,
          end: placement.endTime,
        };
        afterRanges = afterRanges.flatMap((range) =>
          subtractTimeRange(range, usedSlot)
        );
      }

      const beforeMinutes = day.remainingRanges.reduce(
        (sum, r) => sum + (timeToMinutes(r.end) - timeToMinutes(r.start)),
        0
      );
      const afterMinutes = afterRanges.reduce(
        (sum, r) => sum + (timeToMinutes(r.end) - timeToMinutes(r.start)),
        0
      );

      dailyBreakdown.set(day.date, {
        date: day.date,
        beforePlacement: {
          totalMinutes: beforeMinutes,
          ranges: day.remainingRanges,
        },
        afterPlacement: {
          totalMinutes: afterMinutes,
          ranges: afterRanges,
        },
        newPlacements: datePlacements,
      });
    }

    return {
      placements: result.placements,
      conflicts: result.conflicts,
      dailyBreakdown,
    };
  }
}

// 싱글톤 인스턴스
let instance: AutoSlotPlacementService | null = null;

/**
 * AutoSlotPlacementService 싱글톤 인스턴스 반환
 */
export function getAutoSlotPlacementService(): AutoSlotPlacementService {
  if (!instance) {
    instance = new AutoSlotPlacementService();
  }
  return instance;
}
