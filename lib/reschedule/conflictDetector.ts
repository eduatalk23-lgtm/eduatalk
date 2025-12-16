/**
 * 충돌 감지기
 * 
 * 재조정 시 발생할 수 있는 충돌을 감지합니다.
 * - 시간 겹침 감지
 * - 과부하 날짜 감지
 * 
 * @module lib/reschedule/conflictDetector
 */

import { parseISO, format } from "date-fns";
import { timeToMinutes } from "@/lib/utils/time";

// ============================================
// 타입 정의
// ============================================

/**
 * 충돌 타입
 */
export type ConflictType = "time_overlap" | "overload" | "insufficient_time";

/**
 * 충돌 정보
 */
export interface Conflict {
  type: ConflictType;
  date: string; // YYYY-MM-DD
  severity: "low" | "medium" | "high";
  message: string;
  details?: {
    affectedPlans?: number;
    totalHours?: number;
    maxHours?: number;
    overlappingPlans?: Array<{
      plan_id: string;
      start_time: string;
      end_time: string;
    }>;
  };
}

/**
 * 플랜 정보 (시간 포함)
 */
export interface PlanWithTime {
  id: string;
  plan_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  content_id: string;
  content_type: string;
}

// ============================================
// 시간 겹침 감지
// ============================================

/**
 * 두 시간 범위가 겹치는지 확인
 */
function isTimeOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);

  return !(end1Min <= start2Min || end2Min <= start1Min);
}

/**
 * 시간 겹침 충돌 감지
 * 
 * @param plans 플랜 목록 (시간 포함)
 * @returns 시간 겹침 충돌 목록
 */
export function detectTimeOverlaps(plans: PlanWithTime[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const dateMap = new Map<string, PlanWithTime[]>();

  // 날짜별로 그룹화
  plans.forEach((plan) => {
    if (!plan.start_time || !plan.end_time) {
      return; // 시간 정보가 없으면 스킵
    }

    if (!dateMap.has(plan.plan_date)) {
      dateMap.set(plan.plan_date, []);
    }
    dateMap.get(plan.plan_date)!.push(plan);
  });

  // 각 날짜별로 시간 겹침 확인
  dateMap.forEach((datePlans, date) => {
    for (let i = 0; i < datePlans.length; i++) {
      for (let j = i + 1; j < datePlans.length; j++) {
        const plan1 = datePlans[i];
        const plan2 = datePlans[j];

        if (
          plan1.start_time &&
          plan1.end_time &&
          plan2.start_time &&
          plan2.end_time &&
          isTimeOverlapping(
            plan1.start_time,
            plan1.end_time,
            plan2.start_time,
            plan2.end_time
          )
        ) {
          conflicts.push({
            type: "time_overlap",
            date,
            severity: "high",
            message: `${format(new Date(date), "M월 d일")}에 시간 겹침이 발생합니다.`,
            details: {
              overlappingPlans: [
                {
                  plan_id: plan1.id,
                  start_time: plan1.start_time,
                  end_time: plan1.end_time,
                },
                {
                  plan_id: plan2.id,
                  start_time: plan2.start_time,
                  end_time: plan2.end_time,
                },
              ],
            },
          });
        }
      }
    }
  });

  return conflicts;
}

// ============================================
// 과부하 감지
// ============================================

/**
 * 과부하 충돌 감지
 * 
 * @param datePlansMap 날짜별 플랜 목록 맵
 * @param maxHoursPerDay 일일 최대 학습 시간 (기본값: 12시간)
 * @returns 과부하 충돌 목록
 */
export function detectOverloads(
  datePlansMap: Map<string, { totalHours: number; planCount: number }>,
  maxHoursPerDay: number = 12
): Conflict[] {
  const conflicts: Conflict[] = [];

  datePlansMap.forEach((data, date) => {
    if (data.totalHours > maxHoursPerDay) {
      const overloadRatio = data.totalHours / maxHoursPerDay;
      const severity: "low" | "medium" | "high" =
        overloadRatio >= 1.5 ? "high" : overloadRatio >= 1.2 ? "medium" : "low";

      conflicts.push({
        type: "overload",
        date,
        severity,
        message: `${format(new Date(date), "M월 d일")}에 일일 학습 시간이 과부하입니다 (${data.totalHours.toFixed(1)}시간 / 최대 ${maxHoursPerDay}시간).`,
        details: {
          affectedPlans: data.planCount,
          totalHours: data.totalHours,
          maxHours: maxHoursPerDay,
        },
      });
    }
  });

  return conflicts;
}

// ============================================
// 통합 충돌 감지
// ============================================

/**
 * 모든 충돌 감지
 * 
 * @param plans 플랜 목록 (시간 포함)
 * @param datePlansMap 날짜별 플랜 통계 맵
 * @param maxHoursPerDay 일일 최대 학습 시간
 * @returns 모든 충돌 목록
 */
export function detectAllConflicts(
  plans: PlanWithTime[],
  datePlansMap?: Map<string, { totalHours: number; planCount: number }>,
  maxHoursPerDay: number = 12
): Conflict[] {
  const conflicts: Conflict[] = [];

  // 시간 겹침 감지
  const timeOverlaps = detectTimeOverlaps(plans);
  conflicts.push(...timeOverlaps);

  // 과부하 감지
  if (datePlansMap) {
    const overloads = detectOverloads(datePlansMap, maxHoursPerDay);
    conflicts.push(...overloads);
  }

  // 심각도 순으로 정렬 (high -> medium -> low)
  conflicts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  return conflicts;
}

