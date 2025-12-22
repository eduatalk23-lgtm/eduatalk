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
} from "./types";
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

        // 첫 번째 시간 슬롯 사용
        const firstSlot = timeRanges[0];
        let currentTime = this.timeToMinutes(firstSlot.start);
        const endTime = this.timeToMinutes(firstSlot.end);

        plans.forEach((plan, index) => {
          const duration = plan.estimated_duration ?? 60;
          const planEndTime = Math.min(currentTime + duration, endTime);

          allocatedPlans.push(
            this.createAllocatedPlan(
              plan,
              date,
              index,
              this.minutesToTime(currentTime),
              this.minutesToTime(planEndTime)
            )
          );

          currentTime = planEndTime;
        });
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
