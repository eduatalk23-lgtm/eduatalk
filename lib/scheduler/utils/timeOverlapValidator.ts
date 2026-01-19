/**
 * Time Overlap Validator
 *
 * 새로 생성된 플랜과 기존 플랜 간의 시간 충돌을 검증합니다.
 * Phase 4: 기존 플랜 충돌 검증 기능
 *
 * @module lib/scheduler/utils/timeOverlapValidator
 */

import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type { ExistingPlanInfo } from "@/lib/scheduler/SchedulerEngine";
import type { TimeOverlap, OverlapValidationResult } from "@/lib/scheduler/types";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";

/**
 * 시간 자동 조정 결과
 */
export interface TimeAdjustmentResult {
  /** 조정된 플랜 목록 */
  adjustedPlans: ScheduledPlan[];
  /** 조정된 플랜 개수 */
  adjustedCount: number;
  /** 조정 불가능한 플랜 (시간대 부족) */
  unadjustablePlans: Array<{
    plan: ScheduledPlan;
    reason: string;
  }>;
}

/**
 * 새로 생성된 플랜과 기존 플랜 간의 시간 충돌을 검증합니다.
 *
 * @param newPlans - 새로 생성된 플랜 목록
 * @param existingPlans - 기존 플랜 목록
 * @returns 충돌 검증 결과
 */
export function validateNoTimeOverlaps(
  newPlans: ScheduledPlan[],
  existingPlans: ExistingPlanInfo[]
): OverlapValidationResult {
  const overlaps: TimeOverlap[] = [];

  // 기존 플랜을 날짜별로 그룹화
  const existingPlansByDate = new Map<string, ExistingPlanInfo[]>();
  for (const plan of existingPlans) {
    const date = plan.date;
    if (!existingPlansByDate.has(date)) {
      existingPlansByDate.set(date, []);
    }
    existingPlansByDate.get(date)!.push(plan);
  }

  // 각 새 플랜에 대해 충돌 검사
  for (const newPlan of newPlans) {
    // 시간 정보가 없는 플랜은 스킵
    if (!newPlan.start_time || !newPlan.end_time) {
      continue;
    }

    const date = newPlan.plan_date;
    const existingPlansForDate = existingPlansByDate.get(date);

    if (!existingPlansForDate || existingPlansForDate.length === 0) {
      continue;
    }

    const newStart = timeToMinutes(newPlan.start_time);
    const newEnd = timeToMinutes(newPlan.end_time);

    for (const existingPlan of existingPlansForDate) {
      const existingStart = timeToMinutes(existingPlan.start_time);
      const existingEnd = timeToMinutes(existingPlan.end_time);

      // 겹침 계산
      const overlapStart = Math.max(newStart, existingStart);
      const overlapEnd = Math.min(newEnd, existingEnd);

      if (overlapEnd > overlapStart) {
        const overlapMinutes = overlapEnd - overlapStart;
        overlaps.push({
          date,
          newPlan: {
            content_id: newPlan.content_id,
            start_time: newPlan.start_time,
            end_time: newPlan.end_time,
          },
          existingPlan: {
            start_time: existingPlan.start_time,
            end_time: existingPlan.end_time,
          },
          overlapMinutes,
        });
      }
    }
  }

  const totalOverlapMinutes = overlaps.reduce(
    (sum, overlap) => sum + overlap.overlapMinutes,
    0
  );

  return {
    hasOverlaps: overlaps.length > 0,
    overlaps,
    totalOverlapMinutes,
  };
}

/**
 * 새 플랜들 간의 시간 충돌을 검증합니다.
 * 같은 날짜에 배정된 새 플랜들 간에도 충돌이 없는지 확인합니다.
 *
 * @param plans - 검증할 플랜 목록
 * @returns 충돌 검증 결과
 */
export function validateNoInternalOverlaps(
  plans: ScheduledPlan[]
): OverlapValidationResult {
  const overlaps: TimeOverlap[] = [];

  // 플랜을 날짜별로 그룹화
  const plansByDate = new Map<string, ScheduledPlan[]>();
  for (const plan of plans) {
    if (!plan.start_time || !plan.end_time) {
      continue;
    }
    const date = plan.plan_date;
    if (!plansByDate.has(date)) {
      plansByDate.set(date, []);
    }
    plansByDate.get(date)!.push(plan);
  }

  // 각 날짜별로 플랜 간 충돌 검사
  for (const [date, datePlans] of plansByDate) {
    for (let i = 0; i < datePlans.length; i++) {
      for (let j = i + 1; j < datePlans.length; j++) {
        const planA = datePlans[i];
        const planB = datePlans[j];

        const aStart = timeToMinutes(planA.start_time!);
        const aEnd = timeToMinutes(planA.end_time!);
        const bStart = timeToMinutes(planB.start_time!);
        const bEnd = timeToMinutes(planB.end_time!);

        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);

        if (overlapEnd > overlapStart) {
          const overlapMinutes = overlapEnd - overlapStart;
          overlaps.push({
            date,
            newPlan: {
              content_id: planA.content_id,
              start_time: planA.start_time!,
              end_time: planA.end_time!,
            },
            existingPlan: {
              start_time: planB.start_time!,
              end_time: planB.end_time!,
            },
            overlapMinutes,
          });
        }
      }
    }
  }

  const totalOverlapMinutes = overlaps.reduce(
    (sum, overlap) => sum + overlap.overlapMinutes,
    0
  );

  return {
    hasOverlaps: overlaps.length > 0,
    overlaps,
    totalOverlapMinutes,
  };
}

/**
 * 충돌하는 플랜의 시간을 자동으로 조정합니다.
 *
 * 기존 플랜과 충돌하는 새 플랜을 기존 플랜 종료 시간 이후로 이동시킵니다.
 * 하루의 최대 시간(23:59)을 초과하는 경우 조정 불가로 표시합니다.
 *
 * @param newPlans - 새로 생성된 플랜 목록
 * @param existingPlans - 기존 플랜 목록
 * @param maxEndTime - 하루 최대 종료 시간 (기본값: "23:59")
 * @returns 조정 결과
 */
export function adjustOverlappingTimes(
  newPlans: ScheduledPlan[],
  existingPlans: ExistingPlanInfo[],
  maxEndTime: string = "23:59"
): TimeAdjustmentResult {
  const adjustedPlans: ScheduledPlan[] = [];
  const unadjustablePlans: TimeAdjustmentResult["unadjustablePlans"] = [];
  let adjustedCount = 0;

  const maxEndMinutes = timeToMinutes(maxEndTime);

  // 기존 플랜을 날짜별로 그룹화하고 종료 시간순 정렬
  const existingPlansByDate = new Map<string, ExistingPlanInfo[]>();
  for (const plan of existingPlans) {
    const date = plan.date;
    if (!existingPlansByDate.has(date)) {
      existingPlansByDate.set(date, []);
    }
    existingPlansByDate.get(date)!.push(plan);
  }

  // 각 날짜의 기존 플랜을 시작 시간순으로 정렬
  for (const [, plans] of existingPlansByDate) {
    plans.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  }

  for (const newPlan of newPlans) {
    // 시간 정보가 없는 플랜은 그대로 유지
    if (!newPlan.start_time || !newPlan.end_time) {
      adjustedPlans.push(newPlan);
      continue;
    }

    const date = newPlan.plan_date;
    const existingPlansForDate = existingPlansByDate.get(date);

    // 해당 날짜에 기존 플랜이 없으면 그대로 유지
    if (!existingPlansForDate || existingPlansForDate.length === 0) {
      adjustedPlans.push(newPlan);
      continue;
    }

    let planStart = timeToMinutes(newPlan.start_time);
    let planEnd = timeToMinutes(newPlan.end_time);
    const duration = planEnd - planStart;
    let wasAdjusted = false;

    // 각 기존 플랜과 충돌 확인 및 조정
    for (const existingPlan of existingPlansForDate) {
      const existingStart = timeToMinutes(existingPlan.start_time);
      const existingEnd = timeToMinutes(existingPlan.end_time);

      // 충돌 여부 확인
      const overlapStart = Math.max(planStart, existingStart);
      const overlapEnd = Math.min(planEnd, existingEnd);

      if (overlapEnd > overlapStart) {
        // 충돌 발생 - 기존 플랜 종료 시간 이후로 이동
        planStart = existingEnd;
        planEnd = planStart + duration;
        wasAdjusted = true;
      }
    }

    // 최대 종료 시간 초과 확인
    if (planEnd > maxEndMinutes) {
      unadjustablePlans.push({
        plan: newPlan,
        reason: `조정 후 종료 시간(${minutesToTime(planEnd)})이 최대 허용 시간(${maxEndTime})을 초과합니다.`,
      });
      // 조정 불가능한 플랜도 원본 상태로 포함 (caller가 처리 방법 결정)
      adjustedPlans.push(newPlan);
    } else if (wasAdjusted) {
      // 조정 성공
      adjustedPlans.push({
        ...newPlan,
        start_time: minutesToTime(planStart),
        end_time: minutesToTime(planEnd),
      });
      adjustedCount++;
    } else {
      // 조정 불필요
      adjustedPlans.push(newPlan);
    }
  }

  return {
    adjustedPlans,
    adjustedCount,
    unadjustablePlans,
  };
}
