/**
 * 1730 Timetable 스케줄러
 *
 * 6일 학습 + 1일 복습 사이클 기반 스케줄링을 수행합니다.
 * SchedulerEngine을 래핑하여 IScheduler 인터페이스를 구현합니다.
 *
 * @module lib/scheduler/schedulers/Timetable1730Scheduler
 */

import type { IScheduler, SchedulerInput, SchedulerOutput } from "../types";
import { SCHEDULER_TYPES } from "../types";
import { SchedulerEngine, type SchedulerContext } from "../SchedulerEngine";

/**
 * 1730 Timetable 스케줄러 구현
 *
 * 특징:
 * - 6일 학습 + 1일 복습 사이클
 * - 전략/취약 과목 분리 배정
 * - 블록 기반 시간 할당
 * - Bin Packing 알고리즘 유사 시간 슬롯 배정
 */
export const Timetable1730Scheduler: IScheduler = {
  type: SCHEDULER_TYPES.TIMETABLE_1730,
  name: "1730 Timetable Scheduler",

  canHandle(schedulerType: string | null | undefined): boolean {
    return schedulerType === SCHEDULER_TYPES.TIMETABLE_1730;
  },

  generate(input: SchedulerInput): SchedulerOutput {
    const {
      availableDates,
      contentInfos,
      blocks,
      academySchedules,
      exclusions,
      options,
      riskIndexMap,
      subjectTypeMap,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap,
      contentSubjects,
      periodStart,
      existingPlans,
    } = input;

    // 기간 계산
    const actualPeriodStart = periodStart || availableDates[0];
    const periodEnd = availableDates[availableDates.length - 1];

    // 학습 가능한 날짜가 없는 경우
    if (!actualPeriodStart || !periodEnd) {
      return {
        plans: [],
        failureReasons: [
          {
            type: "no_study_days",
            period: "unknown",
            totalDays: 0,
            excludedDays: 0,
          },
        ],
      };
    }

    // SchedulerEngine 컨텍스트 구성
    const context: SchedulerContext = {
      periodStart: actualPeriodStart,
      periodEnd,
      exclusions,
      blocks,
      academySchedules,
      contents: contentInfos,
      options,
      riskIndexMap,
      subjectTypeMap,
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap,
      contentSubjects,
      existingPlans,
    };

    // SchedulerEngine을 사용하여 플랜 생성
    const engine = new SchedulerEngine(context);
    const plans = engine.generate();
    const failureReasons = engine.getFailureReasons();

    return { plans, failureReasons };
  },
};
