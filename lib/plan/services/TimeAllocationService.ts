/**
 * 시간 할당 서비스
 *
 * 스케줄된 플랜에 구체적인 시간 슬롯을 할당합니다.
 * 기존 assignPlanTimes.ts의 함수들을 서비스 레이어로 래핑합니다.
 *
 * NOTE: Phase 2에서는 기존 assignPlanTimes 함수와의 타입 호환성을 위해
 * 단순화된 구현을 제공합니다.
 * Phase 3에서 완전한 통합이 이루어집니다.
 *
 * Phase 4: 통합 에러/로깅 시스템 적용
 *
 * @module lib/plan/services/TimeAllocationService
 */

import type {
  ContentDurationMap,
  DateAvailableTimeRangesMap,
  PlanPayloadBase,
  DayType,
} from "@/lib/types/plan-generation";
import type {
  ServiceResult,
  TimeAllocationInput,
  TimeAllocationOutput,
  ITimeAllocationService,
  ScheduledPlan,
} from "@/lib/plan/shared";
import {
  ServiceErrorCodes,
  toServiceError,
} from "./errors";
import {
  createServiceLogger,
  globalPerformanceTracker,
} from "./logging";

/**
 * 시간 할당 서비스 구현
 */
export class TimeAllocationService implements ITimeAllocationService {
  /**
   * 스케줄된 플랜에 시간 슬롯 할당
   */
  async allocateTime(
    input: TimeAllocationInput
  ): Promise<ServiceResult<TimeAllocationOutput>> {
    const { scheduledPlans, dateTimeRanges, contentDurationMap } = input;

    // 로거 및 성능 추적 설정
    const logger = createServiceLogger("TimeAllocationService");
    const trackingId = globalPerformanceTracker.start(
      "TimeAllocationService",
      "allocateTime",
      undefined,
      { scheduledPlansCount: scheduledPlans.length }
    );

    try {
      logger.info("allocateTime", "시간 할당 시작", {
        scheduledPlansCount: scheduledPlans.length,
      });

      // 입력 검증
      if (scheduledPlans.length === 0) {
        logger.info("allocateTime", "스케줄된 플랜이 없어 빈 결과 반환");
        globalPerformanceTracker.end(trackingId, true);
        return {
          success: true,
          data: {
            allocatedPlans: [],
            unallocatedPlans: [],
          },
        };
      }

      const allocatedPlans: Array<PlanPayloadBase & { content_id: string; date: string }> = [];
      const unallocatedPlans: ScheduledPlan[] = [];

      // 날짜별로 플랜 그룹화
      const plansByDate = this.groupPlansByDate(scheduledPlans);

      // 각 날짜별로 시간 할당
      for (const [date, plans] of plansByDate) {
        const timeRanges = dateTimeRanges.get(date) || [];

        if (timeRanges.length === 0) {
          // 시간 슬롯이 없으면 기본 시간으로 할당
          logger.debug("allocateTime", `날짜 ${date}에 시간 슬롯 없음, 기본 시간 사용`);
          plans.forEach((plan, index) => {
            allocatedPlans.push(this.createAllocatedPlan(plan, date, index, "09:00", "10:00"));
          });
          continue;
        }

        // Best-Fit Decreasing 알고리즘으로 시간 할당
        const { allocated, unallocated } = this.allocateWithBestFit(
          plans,
          timeRanges,
          date
        );
        allocatedPlans.push(...allocated);
        unallocatedPlans.push(...unallocated);
      }

      logger.info("allocateTime", "시간 할당 완료", {
        allocatedPlansCount: allocatedPlans.length,
        unallocatedPlansCount: unallocatedPlans.length,
      });
      globalPerformanceTracker.end(trackingId, true);

      return {
        success: true,
        data: {
          allocatedPlans,
          unallocatedPlans,
        },
      };
    } catch (error) {
      const serviceError = toServiceError(error, "TimeAllocationService", {
        code: ServiceErrorCodes.TIME_ALLOCATION_FAILED,
        method: "allocateTime",
        metadata: { scheduledPlansCount: scheduledPlans.length },
      });
      logger.error("allocateTime", "시간 할당 실패", serviceError);
      globalPerformanceTracker.end(trackingId, false);

      return {
        success: false,
        error: serviceError.message,
        errorCode: serviceError.code,
      };
    }
  }

  /**
   * 할당된 플랜 객체 생성 (내부 헬퍼)
   */
  private createAllocatedPlan(
    plan: ScheduledPlan,
    date: string,
    blockIndex: number,
    startTime: string,
    endTime: string
  ): PlanPayloadBase & { content_id: string; date: string } {
    return {
      plan_date: plan.plan_date || date,
      block_index: plan.block_index ?? blockIndex,
      content_type: plan.content_type,
      content_id: plan.content_id,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      chapter: plan.chapter ?? null,
      start_time: startTime,
      end_time: endTime,
      day_type: (plan.day_type ?? "학습일") as DayType,
      week: plan.week_number ?? null,
      day: null,
      is_partial: false,
      is_continued: false,
      plan_number: null,
      subject_type: plan.subject_type ?? null,
      date,
    };
  }

  /**
   * 날짜별로 플랜 그룹화 (내부 헬퍼)
   */
  private groupPlansByDate(
    plans: ScheduledPlan[]
  ): Map<string, ScheduledPlan[]> {
    const grouped = new Map<string, ScheduledPlan[]>();

    plans.forEach((plan) => {
      const date = plan.date || plan.plan_date;
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(plan);
    });

    return grouped;
  }

  /**
   * Best-Fit Decreasing 알고리즘으로 시간 할당
   *
   * 1. 플랜을 duration 내림차순 정렬 (큰 것부터)
   * 2. 각 플랜에 대해 남은 공간이 가장 작으면서 수용 가능한 슬롯 선택
   * 3. 슬롯이 없으면 unallocated로 분류
   */
  private allocateWithBestFit(
    plans: ScheduledPlan[],
    timeRanges: Array<{ start: string; end: string }>,
    date: string
  ): {
    allocated: Array<PlanPayloadBase & { content_id: string; date: string }>;
    unallocated: ScheduledPlan[];
  } {
    // Bin 타입 정의
    interface Bin {
      slot: { start: string; end: string };
      usedMinutes: number;
      remainingMinutes: number;
      plans: ScheduledPlan[];
    }

    // 1. 플랜을 duration 내림차순 정렬 (Best-Fit Decreasing)
    const sortedPlans = [...plans].sort(
      (a, b) => (b.estimated_duration ?? 60) - (a.estimated_duration ?? 60)
    );

    // 2. 각 시간 슬롯을 Bin으로 관리
    const bins: Bin[] = timeRanges.map((slot) => {
      const slotMinutes =
        this.timeToMinutes(slot.end) - this.timeToMinutes(slot.start);
      return {
        slot,
        usedMinutes: 0,
        remainingMinutes: slotMinutes,
        plans: [],
      };
    });

    const allocated: Array<PlanPayloadBase & { content_id: string; date: string }> = [];
    const unallocated: ScheduledPlan[] = [];

    // 3. Best-Fit 배정
    for (const plan of sortedPlans) {
      const duration = plan.estimated_duration ?? 60;

      // 가장 적합한 Bin 찾기 (남은 공간이 가장 작으면서 플랜을 수용할 수 있는 Bin)
      let bestBin: Bin | null = null;
      let minRemaining = Infinity;

      for (const bin of bins) {
        if (
          bin.remainingMinutes >= duration &&
          bin.remainingMinutes - duration < minRemaining
        ) {
          bestBin = bin;
          minRemaining = bin.remainingMinutes - duration;
        }
      }

      if (bestBin) {
        bestBin.plans.push(plan);
        bestBin.usedMinutes += duration;
        bestBin.remainingMinutes -= duration;
      } else {
        // 슬롯이 부족한 경우 미할당으로 분류
        unallocated.push(plan);
      }
    }

    // 4. Bin별로 시간 배정 (원래 순서 유지를 위해 각 bin 내에서 다시 정렬)
    let globalBlockIndex = 0;
    for (const bin of bins) {
      // 원래 플랜 순서 복원 (배정 순서 유지를 위해)
      const binPlans = bin.plans.sort((a, b) => {
        const aIndex = plans.findIndex((p) => p === a);
        const bIndex = plans.findIndex((p) => p === b);
        return aIndex - bIndex;
      });

      let currentTime = this.timeToMinutes(bin.slot.start);

      for (const plan of binPlans) {
        const duration = plan.estimated_duration ?? 60;
        const endTime = currentTime + duration;

        allocated.push(
          this.createAllocatedPlan(
            plan,
            date,
            globalBlockIndex++,
            this.minutesToTime(currentTime),
            this.minutesToTime(endTime)
          )
        );

        currentTime = endTime;
      }
    }

    return { allocated, unallocated };
  }

  /**
   * 시간 문자열을 분으로 변환
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 분을 시간 문자열로 변환
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  }
}

// 싱글톤 인스턴스
let instance: TimeAllocationService | null = null;

/**
 * TimeAllocationService 싱글톤 인스턴스 반환
 */
export function getTimeAllocationService(): TimeAllocationService {
  if (!instance) {
    instance = new TimeAllocationService();
  }
  return instance;
}
