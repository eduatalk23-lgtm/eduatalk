/**
 * Availability-Aware Placement Service
 *
 * 기존 플랜을 고려한 3단계 폴백 배치 서비스
 * - Step 1: 학습 시간(studyHours)에 배치 시도
 * - Step 2: 자율학습 시간(selfStudyHours)에 배치 시도
 * - Step 3: 배치 불가 시 dock(container_type: 'unfinished')으로 이동
 *
 * @module lib/domains/plan/services/AvailabilityAwarePlacementService
 */

import type { TimeRange, DailySchedule } from "@/lib/scheduler/utils/scheduleCalculator";
import {
  AvailabilityService,
  type ExistingPlan,
  type DailyAvailabilityInfo,
} from "./AvailabilityService";
import {
  AutoSlotPlacementService,
  type PlacementInput,
  type PlacementResult,
  type PlacementConflict,
} from "./AutoSlotPlacementService";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";

// ============================================
// 타입 정의
// ============================================

/**
 * 배치 대상 플랜 정보
 */
export interface PlanToPlace {
  id?: string;
  contentId: string;
  contentType: "book" | "lecture" | "custom";
  contentTitle: string;
  planDate: string;
  startTime: string | null;
  endTime: string | null;
  estimatedDuration: number; // 분 단위
  priority?: number;
  subjectType?: "strategy" | "weakness" | null;
}

/**
 * dock에 배치될 플랜 정보
 */
export interface DockedPlanInfo {
  contentId: string;
  contentType: "book" | "lecture" | "custom";
  contentTitle: string;
  planDate: string;
  estimatedDuration: number;
  reason: "insufficient_study_hours" | "insufficient_self_study_hours" | "no_available_slot";
  originalStartTime?: string;
  originalEndTime?: string;
}

/**
 * 배치된 플랜 정보
 */
export interface PlacedPlanInfo {
  contentId: string;
  contentType: "book" | "lecture" | "custom";
  contentTitle: string;
  planDate: string;
  startTime: string;
  endTime: string;
  estimatedDuration: number;
  placementType: "study_hours" | "self_study_hours";
  wasRelocated: boolean;
}

/**
 * 3단계 폴백 배치 결과
 */
export interface PlacementFallbackResult {
  /** 정상 배치된 플랜 (학습 시간) */
  studyHoursPlans: PlacedPlanInfo[];
  /** 자율학습 시간에 배치된 플랜 */
  selfStudyPlans: PlacedPlanInfo[];
  /** dock에 배치될 플랜 */
  dockedPlans: DockedPlanInfo[];
  /** 충돌 정보 */
  conflicts: PlacementConflict[];
  /** 요약 정보 */
  summary: {
    totalRequested: number;
    placedInStudyHours: number;
    placedInSelfStudyHours: number;
    dockedCount: number;
    totalMinutesPlaced: number;
    totalMinutesDocked: number;
  };
}

/**
 * 배치 서비스 입력 파라미터
 */
export interface AvailabilityAwarePlacementInput {
  /** 배치할 플랜 목록 */
  plansToPlace: PlanToPlace[];
  /** 기존 플랜 목록 (다른 플랜 그룹의 플랜) */
  existingPlans: ExistingPlan[];
  /** 일별 스케줄 정보 */
  dailySchedule: DailySchedule[];
  /** 학습 시간 */
  studyHours: TimeRange | null;
  /** 자율학습 시간 */
  selfStudyHours: TimeRange | null;
  /** 배치 전략 */
  strategy?: "first-fit" | "best-fit" | "spread";
  /** 기간 */
  periodStart: string;
  periodEnd: string;
}

// ============================================
// AvailabilityAwarePlacementService
// ============================================

export class AvailabilityAwarePlacementService {
  private availabilityService: AvailabilityService;
  private autoPlacementService: AutoSlotPlacementService;

  constructor() {
    this.availabilityService = new AvailabilityService();
    this.autoPlacementService = new AutoSlotPlacementService();
  }

  /**
   * 3단계 폴백 배치 실행
   */
  placeWithFallback(input: AvailabilityAwarePlacementInput): PlacementFallbackResult {
    const {
      plansToPlace,
      existingPlans,
      dailySchedule,
      studyHours,
      selfStudyHours,
      strategy = "best-fit",
      periodStart,
      periodEnd,
    } = input;

    // 결과 초기화
    const studyHoursPlans: PlacedPlanInfo[] = [];
    const selfStudyPlans: PlacedPlanInfo[] = [];
    const dockedPlans: DockedPlanInfo[] = [];
    const conflicts: PlacementConflict[] = [];

    // 기존 플랜 고려한 가용시간 계산
    const availability = this.availabilityService.calculateAvailabilityWithExistingPlans({
      dailySchedule,
      existingPlans,
      dateRange: { start: periodStart, end: periodEnd },
    });

    // 날짜별 가용시간을 Map으로 변환
    const dailyAvailabilityMap = new Map<string, DailyAvailabilityInfo>();
    for (const day of availability.dailyAvailability) {
      dailyAvailabilityMap.set(day.date, day);
    }

    // 날짜별로 플랜 그룹화
    const plansByDate = this.groupPlansByDate(plansToPlace);

    // 각 날짜별로 처리
    for (const [date, plans] of plansByDate.entries()) {
      const dayAvailability = dailyAvailabilityMap.get(date);

      if (!dayAvailability) {
        // 해당 날짜에 스케줄이 없음 - 모두 dock으로
        for (const plan of plans) {
          dockedPlans.push({
            contentId: plan.contentId,
            contentType: plan.contentType,
            contentTitle: plan.contentTitle,
            planDate: plan.planDate,
            estimatedDuration: plan.estimatedDuration,
            reason: "no_available_slot",
            originalStartTime: plan.startTime ?? undefined,
            originalEndTime: plan.endTime ?? undefined,
          });
        }
        continue;
      }

      // 각 플랜별 배치 시도
      for (const plan of plans) {
        const placementResult = this.placeSinglePlan(
          plan,
          dayAvailability,
          studyHours,
          selfStudyHours
        );

        if (placementResult.placed) {
          if (placementResult.placementType === "study_hours") {
            studyHoursPlans.push(placementResult.placedPlan!);
          } else {
            selfStudyPlans.push(placementResult.placedPlan!);
          }

          // 가용시간 업데이트 (다음 플랜 배치 시 반영)
          this.updateDayAvailability(
            dayAvailability,
            placementResult.placedPlan!.startTime,
            placementResult.placedPlan!.endTime
          );
        } else {
          dockedPlans.push({
            contentId: plan.contentId,
            contentType: plan.contentType,
            contentTitle: plan.contentTitle,
            planDate: plan.planDate,
            estimatedDuration: plan.estimatedDuration,
            reason: placementResult.reason || "no_available_slot",
            originalStartTime: plan.startTime ?? undefined,
            originalEndTime: plan.endTime ?? undefined,
          });

          if (placementResult.conflict) {
            conflicts.push(placementResult.conflict);
          }
        }
      }
    }

    // 요약 계산
    const totalMinutesPlaced =
      studyHoursPlans.reduce((sum, p) => sum + p.estimatedDuration, 0) +
      selfStudyPlans.reduce((sum, p) => sum + p.estimatedDuration, 0);
    const totalMinutesDocked = dockedPlans.reduce((sum, p) => sum + p.estimatedDuration, 0);

    return {
      studyHoursPlans,
      selfStudyPlans,
      dockedPlans,
      conflicts,
      summary: {
        totalRequested: plansToPlace.length,
        placedInStudyHours: studyHoursPlans.length,
        placedInSelfStudyHours: selfStudyPlans.length,
        dockedCount: dockedPlans.length,
        totalMinutesPlaced,
        totalMinutesDocked,
      },
    };
  }

  /**
   * 단일 플랜 배치 시도 (3단계 폴백)
   */
  private placeSinglePlan(
    plan: PlanToPlace,
    dayAvailability: DailyAvailabilityInfo,
    studyHours: TimeRange | null,
    selfStudyHours: TimeRange | null
  ): {
    placed: boolean;
    placedPlan?: PlacedPlanInfo;
    placementType?: "study_hours" | "self_study_hours";
    reason?: DockedPlanInfo["reason"];
    conflict?: PlacementConflict;
  } {
    const duration = plan.estimatedDuration;

    // Step 1: 기존 시간 슬롯이 유효한지 확인
    if (plan.startTime && plan.endTime) {
      const existingSlot = { start: plan.startTime, end: plan.endTime };
      const isSlotAvailable = this.isSlotAvailable(existingSlot, dayAvailability.remainingRanges);

      if (isSlotAvailable) {
        return {
          placed: true,
          placedPlan: {
            contentId: plan.contentId,
            contentType: plan.contentType,
            contentTitle: plan.contentTitle,
            planDate: plan.planDate,
            startTime: plan.startTime,
            endTime: plan.endTime,
            estimatedDuration: duration,
            placementType: "study_hours",
            wasRelocated: false,
          },
          placementType: "study_hours",
        };
      }
    }

    // Step 2: 학습 시간 내에서 새 슬롯 찾기
    const studySlot = this.findAvailableSlot(
      duration,
      dayAvailability.remainingRanges,
      studyHours
    );

    if (studySlot) {
      return {
        placed: true,
        placedPlan: {
          contentId: plan.contentId,
          contentType: plan.contentType,
          contentTitle: plan.contentTitle,
          planDate: plan.planDate,
          startTime: studySlot.start,
          endTime: studySlot.end,
          estimatedDuration: duration,
          placementType: "study_hours",
          wasRelocated: true,
        },
        placementType: "study_hours",
      };
    }

    // Step 3: 자율학습 시간에서 슬롯 찾기
    if (selfStudyHours) {
      const selfStudySlot = this.findAvailableSlot(
        duration,
        dayAvailability.remainingRanges,
        selfStudyHours
      );

      if (selfStudySlot) {
        return {
          placed: true,
          placedPlan: {
            contentId: plan.contentId,
            contentType: plan.contentType,
            contentTitle: plan.contentTitle,
            planDate: plan.planDate,
            startTime: selfStudySlot.start,
            endTime: selfStudySlot.end,
            estimatedDuration: duration,
            placementType: "self_study_hours",
            wasRelocated: true,
          },
          placementType: "self_study_hours",
        };
      }
    }

    // Step 4: 배치 실패 - dock으로
    return {
      placed: false,
      reason: selfStudyHours ? "insufficient_self_study_hours" : "insufficient_study_hours",
      conflict: {
        contentId: plan.contentId,
        contentTitle: plan.contentTitle,
        reason: `${duration}분 슬롯을 찾을 수 없습니다. (남은 시간: ${dayAvailability.totalRemainingMinutes}분)`,
      },
    };
  }

  /**
   * 슬롯이 가용 시간 범위 내에 있는지 확인
   */
  private isSlotAvailable(slot: TimeRange, availableRanges: TimeRange[]): boolean {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);

    for (const range of availableRanges) {
      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);

      // 슬롯이 range 내에 완전히 포함되는 경우
      if (slotStart >= rangeStart && slotEnd <= rangeEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * 지정된 시간 범위 내에서 가용 슬롯 찾기
   */
  private findAvailableSlot(
    durationMinutes: number,
    availableRanges: TimeRange[],
    preferredTimeRange: TimeRange | null
  ): TimeRange | null {
    for (const range of availableRanges) {
      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);
      const rangeDuration = rangeEnd - rangeStart;

      if (rangeDuration < durationMinutes) continue;

      // preferredTimeRange가 있으면 해당 범위 내에서만 찾기
      if (preferredTimeRange) {
        const prefStart = timeToMinutes(preferredTimeRange.start);
        const prefEnd = timeToMinutes(preferredTimeRange.end);

        // 겹치는 구간 계산
        const overlapStart = Math.max(rangeStart, prefStart);
        const overlapEnd = Math.min(rangeEnd, prefEnd);
        const overlapDuration = overlapEnd - overlapStart;

        if (overlapDuration >= durationMinutes) {
          return {
            start: minutesToTime(overlapStart),
            end: minutesToTime(overlapStart + durationMinutes),
          };
        }
      } else {
        // preferredTimeRange가 없으면 첫 번째 가용 슬롯 반환
        return {
          start: range.start,
          end: minutesToTime(rangeStart + durationMinutes),
        };
      }
    }

    return null;
  }

  /**
   * 날짜별 가용시간 업데이트 (배치 후)
   */
  private updateDayAvailability(
    dayAvailability: DailyAvailabilityInfo,
    usedStart: string,
    usedEnd: string
  ): void {
    const usedSlot: TimeRange = { start: usedStart, end: usedEnd };
    const usedMinutes = timeToMinutes(usedEnd) - timeToMinutes(usedStart);

    // remainingRanges에서 사용된 슬롯 제거
    dayAvailability.remainingRanges = dayAvailability.remainingRanges.flatMap((range) => {
      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);
      const slotStart = timeToMinutes(usedSlot.start);
      const slotEnd = timeToMinutes(usedSlot.end);

      // 겹치지 않으면 원본 유지
      if (slotEnd <= rangeStart || slotStart >= rangeEnd) {
        return [range];
      }

      const result: TimeRange[] = [];

      // 앞부분
      if (rangeStart < slotStart) {
        result.push({
          start: minutesToTime(rangeStart),
          end: minutesToTime(slotStart),
        });
      }

      // 뒷부분
      if (slotEnd < rangeEnd) {
        result.push({
          start: minutesToTime(slotEnd),
          end: minutesToTime(rangeEnd),
        });
      }

      return result;
    });

    // 남은 시간 업데이트
    dayAvailability.totalRemainingMinutes -= usedMinutes;
    dayAvailability.totalOccupiedMinutes += usedMinutes;
  }

  /**
   * 날짜별 플랜 그룹화
   */
  private groupPlansByDate(plans: PlanToPlace[]): Map<string, PlanToPlace[]> {
    const grouped = new Map<string, PlanToPlace[]>();

    for (const plan of plans) {
      const date = plan.planDate;
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(plan);
    }

    // 각 날짜 내에서 우선순위로 정렬 (낮을수록 우선)
    for (const [, datePlans] of grouped) {
      datePlans.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
    }

    return grouped;
  }

  /**
   * 기존 플랜 조회 헬퍼 (Supabase 쿼리용)
   */
  static buildExistingPlansQuery(
    studentId: string,
    periodStart: string,
    periodEnd: string,
    excludePlanGroupId?: string
  ): {
    studentId: string;
    periodStart: string;
    periodEnd: string;
    excludePlanGroupId?: string;
  } {
    return {
      studentId,
      periodStart,
      periodEnd,
      excludePlanGroupId,
    };
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let instance: AvailabilityAwarePlacementService | null = null;

/**
 * AvailabilityAwarePlacementService 싱글톤 인스턴스 반환
 */
export function getAvailabilityAwarePlacementService(): AvailabilityAwarePlacementService {
  if (!instance) {
    instance = new AvailabilityAwarePlacementService();
  }
  return instance;
}
