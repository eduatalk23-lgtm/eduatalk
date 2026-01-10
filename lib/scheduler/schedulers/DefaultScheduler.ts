/**
 * Default 스케줄러
 *
 * 기본 균등 배분 스케줄링을 수행합니다.
 * 스케줄러 타입이 지정되지 않거나 알 수 없는 경우 fallback으로 사용됩니다.
 *
 * @module lib/scheduler/schedulers/DefaultScheduler
 */

import type { IScheduler, SchedulerInput, SchedulerOutput } from "../types";
import { SCHEDULER_TYPES } from "../types";
import { generateDefaultPlansInternal } from "./defaultSchedulerLogic";

/**
 * Default 스케줄러 구현
 *
 * 특징:
 * - 콘텐츠를 가용 날짜에 순차 배분
 * - 위험도 기반 콘텐츠 우선순위
 * - 블록 기반 시간 할당
 * - null, undefined, "default", unknown 타입 모두 처리 (fallback)
 */
export const DefaultScheduler: IScheduler = {
  type: SCHEDULER_TYPES.DEFAULT,
  name: "Default Scheduler",

  canHandle(schedulerType: string | null | undefined): boolean {
    // Default 스케줄러는 다음 경우에 처리:
    // 1. null 또는 undefined
    // 2. "default"
    // 3. 빈 문자열
    // 4. 다른 스케줄러가 처리하지 않은 모든 타입 (catch-all)
    return (
      schedulerType === null ||
      schedulerType === undefined ||
      schedulerType === SCHEDULER_TYPES.DEFAULT ||
      schedulerType === "" ||
      // Catch-all: SCHEDULER_TYPES에 정의되지 않은 타입도 처리
      !Object.values(SCHEDULER_TYPES).includes(
        schedulerType as (typeof SCHEDULER_TYPES)[keyof typeof SCHEDULER_TYPES]
      )
    );
  },

  generate(input: SchedulerInput): SchedulerOutput {
    const {
      availableDates,
      contentInfos,
      blocks,
      academySchedules,
      exclusions,
      riskIndexMap,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap,
    } = input;

    // 기존 generateDefaultPlans 로직 호출
    const plans = generateDefaultPlansInternal(
      availableDates,
      contentInfos,
      blocks,
      academySchedules,
      exclusions,
      riskIndexMap,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap
    );

    return {
      plans,
      failureReasons: [], // Default 스케줄러는 실패 원인을 수집하지 않음
    };
  },
};
