/**
 * 스케줄 충돌 감지 및 해결 서비스
 *
 * 플랜 간의 충돌을 감지하고 해결 전략을 제안합니다.
 *
 * @module lib/domains/plan/services/conflictResolver
 */

import { parseISO, format, isSameDay, isAfter, isBefore, addDays, eachDayOfInterval } from "date-fns";
import type { PlanStatus, PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import { isCompletedPlan } from "@/lib/utils/planStatusUtils";

// ============================================
// 타입 정의
// ============================================

/**
 * 충돌 유형
 */
export type ConflictType =
  | "time_overlap" // 같은 시간대에 여러 플랜
  | "excluded_date" // 제외일에 플랜 존재
  | "academy_conflict" // 학원 일정과 충돌
  | "capacity_exceeded" // 하루 용량 초과
  | "deadline_exceeded"; // 마감일 초과

/**
 * 충돌 심각도
 */
export type ConflictSeverity = "error" | "warning" | "info";

/**
 * 해결 전략
 */
export type ResolutionStrategy =
  | "skip" // 해당 플랜 건너뛰기
  | "move_forward" // 앞으로 이동
  | "move_backward" // 뒤로 이동
  | "redistribute" // 재배분
  | "split" // 분할
  | "merge" // 병합
  | "delete"; // 삭제

/**
 * 충돌 정보
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  date: string; // YYYY-MM-DD
  affectedPlanIds: string[];
  description: string;
  suggestedStrategies: ResolutionStrategy[];
  metadata?: Record<string, unknown>;
}

/**
 * 해결 결과
 */
export interface ResolutionResult {
  strategy: ResolutionStrategy;
  conflictId: string;
  success: boolean;
  changes: {
    planId: string;
    action: "move" | "skip" | "delete" | "modify";
    fromDate?: string;
    toDate?: string;
    description: string;
  }[];
  error?: string;
}

/**
 * 플랜 데이터 (충돌 감지용)
 */
export interface PlanForConflict {
  id: string;
  plan_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: PlanStatus | string | null;
  content_type?: string | null;
  estimated_duration?: number | null;
  plan_group_id?: string | null;
}

/**
 * 충돌 감지 옵션
 */
export interface ConflictDetectionOptions {
  checkTimeOverlap?: boolean;
  checkExcludedDates?: boolean;
  checkAcademyConflicts?: boolean;
  checkCapacity?: boolean;
  maxDailyPlans?: number;
  checkDeadline?: boolean;
  deadline?: string; // YYYY-MM-DD
}

// ============================================
// 충돌 감지 함수
// ============================================

/**
 * 플랜 목록에서 충돌을 감지합니다.
 */
export function detectConflicts(
  plans: PlanForConflict[],
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[],
  options: ConflictDetectionOptions = {}
): Conflict[] {
  const conflicts: Conflict[] = [];
  const {
    checkTimeOverlap = true,
    checkExcludedDates = true,
    checkAcademyConflicts = true,
    checkCapacity = true,
    maxDailyPlans = 10,
    checkDeadline = false,
    deadline,
  } = options;

  // 완료되지 않은 플랜만 대상
  const activePlans = plans.filter(
    (p) => !isCompletedPlan({ status: p.status as PlanStatus })
  );

  // 날짜별로 그룹화
  const plansByDate = new Map<string, PlanForConflict[]>();
  activePlans.forEach((plan) => {
    const existing = plansByDate.get(plan.plan_date) || [];
    existing.push(plan);
    plansByDate.set(plan.plan_date, existing);
  });

  // 1. 시간 중복 검사
  if (checkTimeOverlap) {
    plansByDate.forEach((dayPlans, date) => {
      const overlaps = findTimeOverlaps(dayPlans);
      overlaps.forEach((overlap) => {
        conflicts.push({
          id: `time_overlap_${date}_${overlap.planIds.join("_")}`,
          type: "time_overlap",
          severity: "warning",
          date,
          affectedPlanIds: overlap.planIds,
          description: `${date}에 ${overlap.planIds.length}개 플랜의 시간이 겹칩니다 (${overlap.timeRange})`,
          suggestedStrategies: ["move_forward", "move_backward", "redistribute"],
          metadata: { timeRange: overlap.timeRange },
        });
      });
    });
  }

  // 2. 제외일 검사
  if (checkExcludedDates) {
    const exclusionDates = new Set<string>();
    exclusions.forEach((exc) => {
      if (exc.exclusion_date) {
        exclusionDates.add(exc.exclusion_date);
      }
    });

    plansByDate.forEach((dayPlans, date) => {
      if (exclusionDates.has(date)) {
        const exclusion = exclusions.find(
          (e) => e.exclusion_date === date
        );

        conflicts.push({
          id: `excluded_date_${date}`,
          type: "excluded_date",
          severity: "error",
          date,
          affectedPlanIds: dayPlans.map((p) => p.id),
          description: `${date}은(는) 제외일(${exclusion?.reason || "사유 없음"})입니다. ${dayPlans.length}개 플랜이 영향받습니다.`,
          suggestedStrategies: ["skip", "move_forward", "move_backward"],
          metadata: { reason: exclusion?.reason },
        });
      }
    });
  }

  // 3. 학원 일정 충돌 검사
  if (checkAcademyConflicts) {
    academySchedules.forEach((schedule) => {
      const dayOfWeek = schedule.day_of_week;
      if (dayOfWeek === undefined || dayOfWeek === null) return;

      plansByDate.forEach((dayPlans, date) => {
        const dateObj = parseISO(date);
        if (dateObj.getDay() !== dayOfWeek) return;

        // 시간 충돌 확인
        const conflictingPlans = dayPlans.filter((plan) => {
          if (!plan.start_time || !plan.end_time) return false;
          if (!schedule.start_time || !schedule.end_time) return false;

          return hasTimeOverlap(
            plan.start_time,
            plan.end_time,
            schedule.start_time,
            schedule.end_time
          );
        });

        if (conflictingPlans.length > 0) {
          const academyName = schedule.academy_name || schedule.subject || "학원";
          conflicts.push({
            id: `academy_conflict_${date}_${schedule.id}`,
            type: "academy_conflict",
            severity: "warning",
            date,
            affectedPlanIds: conflictingPlans.map((p) => p.id),
            description: `${date}에 학원 일정(${academyName}, ${schedule.start_time}-${schedule.end_time})과 ${conflictingPlans.length}개 플랜이 충돌합니다.`,
            suggestedStrategies: ["move_forward", "move_backward", "skip"],
            metadata: {
              academyScheduleId: schedule.id,
              academyName,
              academyTime: `${schedule.start_time}-${schedule.end_time}`,
            },
          });
        }
      });
    });
  }

  // 4. 일일 용량 초과 검사
  if (checkCapacity) {
    plansByDate.forEach((dayPlans, date) => {
      if (dayPlans.length > maxDailyPlans) {
        conflicts.push({
          id: `capacity_exceeded_${date}`,
          type: "capacity_exceeded",
          severity: "warning",
          date,
          affectedPlanIds: dayPlans.map((p) => p.id),
          description: `${date}에 ${dayPlans.length}개 플랜이 있습니다 (권장: ${maxDailyPlans}개 이하)`,
          suggestedStrategies: ["redistribute", "skip"],
          metadata: { count: dayPlans.length, limit: maxDailyPlans },
        });
      }
    });
  }

  // 5. 마감일 초과 검사
  if (checkDeadline && deadline) {
    const deadlineDate = parseISO(deadline);
    plansByDate.forEach((dayPlans, date) => {
      const dateObj = parseISO(date);
      if (isAfter(dateObj, deadlineDate)) {
        conflicts.push({
          id: `deadline_exceeded_${date}`,
          type: "deadline_exceeded",
          severity: "error",
          date,
          affectedPlanIds: dayPlans.map((p) => p.id),
          description: `${date}의 ${dayPlans.length}개 플랜이 마감일(${deadline})을 초과합니다.`,
          suggestedStrategies: ["move_backward", "skip", "redistribute"],
          metadata: { deadline },
        });
      }
    });
  }

  return conflicts;
}

/**
 * 시간 중복을 찾습니다.
 */
function findTimeOverlaps(
  plans: PlanForConflict[]
): { planIds: string[]; timeRange: string }[] {
  const overlaps: { planIds: string[]; timeRange: string }[] = [];
  const plansWithTime = plans.filter((p) => p.start_time && p.end_time);

  for (let i = 0; i < plansWithTime.length; i++) {
    for (let j = i + 1; j < plansWithTime.length; j++) {
      const planA = plansWithTime[i];
      const planB = plansWithTime[j];

      if (
        hasTimeOverlap(
          planA.start_time!,
          planA.end_time!,
          planB.start_time!,
          planB.end_time!
        )
      ) {
        overlaps.push({
          planIds: [planA.id, planB.id],
          timeRange: `${planA.start_time}-${planA.end_time} ↔ ${planB.start_time}-${planB.end_time}`,
        });
      }
    }
  }

  return overlaps;
}

/**
 * 두 시간 범위가 겹치는지 확인합니다.
 */
function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const [startAHour, startAMin] = startA.split(":").map(Number);
  const [endAHour, endAMin] = endA.split(":").map(Number);
  const [startBHour, startBMin] = startB.split(":").map(Number);
  const [endBHour, endBMin] = endB.split(":").map(Number);

  const startAMinutes = startAHour * 60 + startAMin;
  const endAMinutes = endAHour * 60 + endAMin;
  const startBMinutes = startBHour * 60 + startBMin;
  const endBMinutes = endBHour * 60 + endBMin;

  return startAMinutes < endBMinutes && endAMinutes > startBMinutes;
}

// ============================================
// 해결 전략 제안
// ============================================

/**
 * 충돌에 대한 해결 방안을 제안합니다.
 */
export function suggestResolutions(
  conflict: Conflict,
  plans: PlanForConflict[],
  availableDates: string[]
): {
  strategy: ResolutionStrategy;
  description: string;
  impact: string;
  targetDates?: string[];
}[] {
  const suggestions: {
    strategy: ResolutionStrategy;
    description: string;
    impact: string;
    targetDates?: string[];
  }[] = [];

  const affectedPlans = plans.filter((p) =>
    conflict.affectedPlanIds.includes(p.id)
  );

  switch (conflict.type) {
    case "excluded_date":
      // 건너뛰기 제안
      suggestions.push({
        strategy: "skip",
        description: "해당 날짜의 플랜을 건너뜁니다",
        impact: `${affectedPlans.length}개 플랜이 미완료 상태로 남습니다`,
      });

      // 앞으로 이동 제안
      const nextAvailable = findNextAvailableDate(
        conflict.date,
        availableDates,
        1
      );
      if (nextAvailable) {
        suggestions.push({
          strategy: "move_forward",
          description: `다음 사용 가능한 날짜(${nextAvailable})로 이동`,
          impact: "일정이 하루 뒤로 밀립니다",
          targetDates: [nextAvailable],
        });
      }

      // 뒤로 이동 제안
      const prevAvailable = findNextAvailableDate(
        conflict.date,
        availableDates,
        -1
      );
      if (prevAvailable) {
        suggestions.push({
          strategy: "move_backward",
          description: `이전 사용 가능한 날짜(${prevAvailable})로 이동`,
          impact: "일정이 하루 앞으로 당겨집니다",
          targetDates: [prevAvailable],
        });
      }
      break;

    case "time_overlap":
      // 재배분 제안
      suggestions.push({
        strategy: "redistribute",
        description: "시간이 겹치는 플랜들을 다른 시간대로 재배분",
        impact: "각 플랜의 시작 시간이 조정됩니다",
      });

      // 앞으로 이동 제안
      suggestions.push({
        strategy: "move_forward",
        description: "충돌하는 플랜 중 하나를 다음 날로 이동",
        impact: "하나의 플랜이 내일로 이동합니다",
      });
      break;

    case "capacity_exceeded":
      // 재배분 제안
      const nearbyDates = findNearbyAvailableDates(
        conflict.date,
        availableDates,
        3
      );
      suggestions.push({
        strategy: "redistribute",
        description: `${nearbyDates.length}개 근처 날짜로 플랜을 분산`,
        impact: "일부 플랜이 인근 날짜로 이동합니다",
        targetDates: nearbyDates,
      });

      // 건너뛰기 제안
      suggestions.push({
        strategy: "skip",
        description: "초과된 플랜을 건너뜁니다",
        impact: `${affectedPlans.length - (conflict.metadata?.limit as number || 10)}개 플랜이 미완료 상태로 남습니다`,
      });
      break;

    case "deadline_exceeded":
      // 뒤로 이동 제안 (마감일 이전으로)
      const beforeDeadline = findNextAvailableDate(
        conflict.metadata?.deadline as string,
        availableDates,
        -1
      );
      if (beforeDeadline) {
        suggestions.push({
          strategy: "move_backward",
          description: `마감일 이전(${beforeDeadline})으로 이동`,
          impact: "마감일 안에 완료 가능합니다",
          targetDates: [beforeDeadline],
        });
      }

      // 건너뛰기 제안
      suggestions.push({
        strategy: "skip",
        description: "마감 초과 플랜을 포기합니다",
        impact: `${affectedPlans.length}개 플랜이 미완료됩니다`,
      });
      break;

    case "academy_conflict":
      // 시간 조정 제안
      suggestions.push({
        strategy: "redistribute",
        description: "학원 일정 전후로 시간을 조정",
        impact: "플랜 시작 시간이 변경됩니다",
      });

      // 다른 날로 이동 제안
      suggestions.push({
        strategy: "move_forward",
        description: "다음 날로 이동",
        impact: "플랜이 내일로 이동합니다",
      });
      break;
  }

  return suggestions;
}

/**
 * 다음 사용 가능한 날짜를 찾습니다.
 */
function findNextAvailableDate(
  fromDate: string,
  availableDates: string[],
  direction: 1 | -1
): string | null {
  const sortedDates = [...availableDates].sort();
  const fromDateObj = parseISO(fromDate);

  if (direction === 1) {
    return (
      sortedDates.find((d) => isAfter(parseISO(d), fromDateObj)) || null
    );
  } else {
    return (
      sortedDates.reverse().find((d) => isBefore(parseISO(d), fromDateObj)) ||
      null
    );
  }
}

/**
 * 근처의 사용 가능한 날짜들을 찾습니다.
 */
function findNearbyAvailableDates(
  centerDate: string,
  availableDates: string[],
  count: number
): string[] {
  const centerDateObj = parseISO(centerDate);
  const availableSet = new Set(availableDates);

  const result: string[] = [];
  let offset = 1;

  while (result.length < count && offset < 30) {
    const forward = format(addDays(centerDateObj, offset), "yyyy-MM-dd");
    const backward = format(addDays(centerDateObj, -offset), "yyyy-MM-dd");

    if (availableSet.has(forward) && !result.includes(forward)) {
      result.push(forward);
    }
    if (
      result.length < count &&
      availableSet.has(backward) &&
      !result.includes(backward)
    ) {
      result.push(backward);
    }

    offset++;
  }

  return result.sort();
}

// ============================================
// 충돌 해결 실행
// ============================================

/**
 * 충돌 해결 전략을 적용합니다.
 * 실제 DB 변경은 하지 않고 변경 사항만 반환합니다.
 */
export function applyResolutionStrategy(
  conflict: Conflict,
  strategy: ResolutionStrategy,
  plans: PlanForConflict[],
  targetDates?: string[]
): ResolutionResult {
  const affectedPlans = plans.filter((p) =>
    conflict.affectedPlanIds.includes(p.id)
  );

  const changes: ResolutionResult["changes"] = [];

  switch (strategy) {
    case "skip":
      affectedPlans.forEach((plan) => {
        changes.push({
          planId: plan.id,
          action: "skip",
          description: `${plan.plan_date}의 플랜을 건너뜁니다`,
        });
      });
      break;

    case "move_forward":
      if (targetDates && targetDates.length > 0) {
        affectedPlans.forEach((plan, index) => {
          const targetDate = targetDates[index % targetDates.length];
          changes.push({
            planId: plan.id,
            action: "move",
            fromDate: plan.plan_date,
            toDate: targetDate,
            description: `${plan.plan_date} → ${targetDate}로 이동`,
          });
        });
      }
      break;

    case "move_backward":
      if (targetDates && targetDates.length > 0) {
        affectedPlans.forEach((plan, index) => {
          const targetDate = targetDates[index % targetDates.length];
          changes.push({
            planId: plan.id,
            action: "move",
            fromDate: plan.plan_date,
            toDate: targetDate,
            description: `${plan.plan_date} → ${targetDate}로 이동`,
          });
        });
      }
      break;

    case "redistribute":
      if (targetDates && targetDates.length > 0) {
        affectedPlans.forEach((plan, index) => {
          const targetDate = targetDates[index % targetDates.length];
          changes.push({
            planId: plan.id,
            action: "move",
            fromDate: plan.plan_date,
            toDate: targetDate,
            description: `${plan.plan_date} → ${targetDate}로 재배분`,
          });
        });
      }
      break;

    case "delete":
      affectedPlans.forEach((plan) => {
        changes.push({
          planId: plan.id,
          action: "delete",
          description: `${plan.plan_date}의 플랜을 삭제합니다`,
        });
      });
      break;
  }

  return {
    strategy,
    conflictId: conflict.id,
    success: changes.length > 0,
    changes,
  };
}

/**
 * 충돌 요약을 생성합니다.
 */
export function summarizeConflicts(conflicts: Conflict[]): {
  total: number;
  byType: Record<ConflictType, number>;
  bySeverity: Record<ConflictSeverity, number>;
  affectedDates: string[];
  affectedPlanCount: number;
} {
  const byType: Record<ConflictType, number> = {
    time_overlap: 0,
    excluded_date: 0,
    academy_conflict: 0,
    capacity_exceeded: 0,
    deadline_exceeded: 0,
  };

  const bySeverity: Record<ConflictSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0,
  };

  const affectedDatesSet = new Set<string>();
  const affectedPlanIdsSet = new Set<string>();

  conflicts.forEach((conflict) => {
    byType[conflict.type]++;
    bySeverity[conflict.severity]++;
    affectedDatesSet.add(conflict.date);
    conflict.affectedPlanIds.forEach((id) => affectedPlanIdsSet.add(id));
  });

  return {
    total: conflicts.length,
    byType,
    bySeverity,
    affectedDates: Array.from(affectedDatesSet).sort(),
    affectedPlanCount: affectedPlanIdsSet.size,
  };
}
