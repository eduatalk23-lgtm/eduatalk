/**
 * 날짜 범위 분석기
 * 
 * 재조정 대상 콘텐츠의 영향받는 날짜를 자동으로 감지하고 추천 날짜 범위를 생성합니다.
 * 
 * @module lib/reschedule/dateRangeAnalyzer
 */

import { parseISO, format, isAfter, isBefore, isSameDay, eachDayOfInterval, startOfDay } from "date-fns";
import { isReschedulable, isCompletedPlan } from "@/lib/utils/planStatusUtils";
import type { PlanContent, PlanStatus } from "@/lib/types/plan";

// ============================================
// 타입 정의
// ============================================

/**
 * 날짜 범위
 */
export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

/**
 * 추천 날짜 범위
 */
export interface SuggestedDateRange {
  range: DateRange;
  reason: string;
  priority: number; // 높을수록 우선순위 높음
  affectedPlansCount: number;
  affectedDates: string[];
}

/**
 * 플랜 정보 (날짜 포함)
 */
export interface PlanWithDate {
  id: string;
  plan_date: string; // YYYY-MM-DD
  status: string | null;
  is_active: boolean | null;
  content_id: string;
}

// ============================================
// 영향받는 날짜 감지
// ============================================

/**
 * 재조정 대상 콘텐츠의 영향받는 날짜 목록 추출
 * 
 * @param selectedContentIds 선택된 콘텐츠 ID 목록
 * @param contents 전체 콘텐츠 목록
 * @param existingPlans 기존 플랜 목록
 * @returns 영향받는 날짜 목록 (YYYY-MM-DD 형식)
 */
export function getAffectedDates(
  selectedContentIds: Set<string>,
  contents: PlanContent[],
  existingPlans: PlanWithDate[]
): string[] {
  const affectedDates = new Set<string>();

  // 선택된 콘텐츠의 ID 목록 생성
  const selectedContentIdSet = new Set<string>();
  contents.forEach((content) => {
    const contentId = content.id || content.content_id;
    if (selectedContentIds.has(contentId)) {
      selectedContentIdSet.add(content.content_id);
    }
  });

  // 선택된 콘텐츠의 재조정 가능한 플랜 날짜 수집
  existingPlans.forEach((plan) => {
    if (
      selectedContentIdSet.has(plan.content_id) &&
      isReschedulable({
        status: (plan.status as PlanStatus) || "pending",
        is_active: plan.is_active ?? true,
      })
    ) {
      affectedDates.add(plan.plan_date);
    }
  });

  return Array.from(affectedDates).sort();
}

/**
 * 완료된 플랜이 있는 날짜 목록 추출
 * 
 * @param existingPlans 기존 플랜 목록
 * @returns 완료된 플랜이 있는 날짜 목록 (YYYY-MM-DD 형식)
 */
export function getCompletedPlanDates(
  existingPlans: PlanWithDate[]
): Set<string> {
  const completedDates = new Set<string>();

  existingPlans.forEach((plan) => {
    if (
      isCompletedPlan({
        status: (plan.status as PlanStatus) || "pending",
      })
    ) {
      completedDates.add(plan.plan_date);
    }
  });

  return completedDates;
}

// ============================================
// 날짜 범위 그룹화
// ============================================

/**
 * 날짜 목록을 연속된 범위로 그룹화
 * 
 * @param dates 날짜 목록 (YYYY-MM-DD 형식, 정렬됨)
 * @returns 연속된 날짜 범위 목록
 */
export function groupConsecutiveDates(dates: string[]): DateRange[] {
  if (dates.length === 0) {
    return [];
  }

  const ranges: DateRange[] = [];
  let currentStart = dates[0];
  let currentEnd = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const currentDate = parseISO(dates[i]);
    const previousDate = parseISO(dates[i - 1]);
    const daysDiff = Math.floor(
      (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      // 연속된 날짜
      currentEnd = dates[i];
    } else {
      // 불연속 날짜 - 현재 범위 저장하고 새 범위 시작
      ranges.push({
        from: currentStart,
        to: currentEnd,
      });
      currentStart = dates[i];
      currentEnd = dates[i];
    }
  }

  // 마지막 범위 저장
  ranges.push({
    from: currentStart,
    to: currentEnd,
  });

  return ranges;
}

// ============================================
// 추천 날짜 범위 생성
// ============================================

/**
 * 스마트 날짜 범위 추천 생성
 * 
 * @param selectedContentIds 선택된 콘텐츠 ID 목록
 * @param contents 전체 콘텐츠 목록
 * @param existingPlans 기존 플랜 목록
 * @param groupPeriodStart 플랜 그룹 시작일
 * @param groupPeriodEnd 플랜 그룹 종료일
 * @returns 추천 날짜 범위 목록 (우선순위 순)
 */
export function generateDateRangeSuggestions(
  selectedContentIds: Set<string>,
  contents: PlanContent[],
  existingPlans: PlanWithDate[],
  groupPeriodStart: string,
  groupPeriodEnd: string
): SuggestedDateRange[] {
  const suggestions: SuggestedDateRange[] = [];

  // 1. 영향받는 날짜 추출
  const affectedDates = getAffectedDates(
    selectedContentIds,
    contents,
    existingPlans
  );

  if (affectedDates.length === 0) {
    return suggestions;
  }

  // 2. 완료된 플랜 날짜 추출
  const completedDates = getCompletedPlanDates(existingPlans);

  // 3. 완료된 플랜 날짜 제외한 영향받는 날짜
  const reschedulableDates = affectedDates.filter(
    (date) => !completedDates.has(date)
  );

  if (reschedulableDates.length === 0) {
    return suggestions;
  }

  // 4. 연속된 날짜 범위로 그룹화
  const dateRanges = groupConsecutiveDates(reschedulableDates);

  // 5. 각 범위에 대한 추천 생성
  dateRanges.forEach((range, index) => {
    const rangeDates = eachDayOfInterval({
      start: parseISO(range.from),
      end: parseISO(range.to),
    }).map((date) => format(date, "yyyy-MM-dd"));

    // 영향받는 플랜 수 계산
    const affectedPlansCount = existingPlans.filter((plan) =>
      rangeDates.includes(plan.plan_date) &&
      isReschedulable({
        status: (plan.status as PlanStatus) || "pending",
        is_active: plan.is_active ?? true,
      })
    ).length;

    // 추천 이유 생성
    const daysCount = rangeDates.length;
    let reason = "";
    let priority = 0;

    if (daysCount === 1) {
      reason = "단일 날짜 재조정";
      priority = 5;
    } else if (daysCount <= 7) {
      reason = `${daysCount}일 연속 재조정 (${range.from} ~ ${range.to})`;
      priority = 8;
    } else if (daysCount <= 14) {
      reason = `${daysCount}일 연속 재조정 (약 ${Math.ceil(daysCount / 7)}주)`;
      priority = 7;
    } else {
      reason = `${daysCount}일 연속 재조정 (약 ${Math.ceil(daysCount / 7)}주)`;
      priority = 6;
    }

    suggestions.push({
      range,
      reason,
      priority,
      affectedPlansCount,
      affectedDates: rangeDates,
    });
  });

  // 6. 전체 범위 추천 추가
  if (reschedulableDates.length > 0) {
    const allRangeStart = reschedulableDates[0];
    const allRangeEnd = reschedulableDates[reschedulableDates.length - 1];

    const allRangeDates = eachDayOfInterval({
      start: parseISO(allRangeStart),
      end: parseISO(allRangeEnd),
    }).map((date) => format(date, "yyyy-MM-dd"));

    const allAffectedPlansCount = existingPlans.filter((plan) =>
      reschedulableDates.includes(plan.plan_date) &&
      isReschedulable({
        status: (plan.status as PlanStatus) || "pending",
        is_active: plan.is_active ?? true,
      })
    ).length;

    suggestions.push({
      range: {
        from: allRangeStart,
        to: allRangeEnd,
      },
      reason: `모든 영향받는 날짜 (${reschedulableDates.length}일)`,
      priority: 4,
      affectedPlansCount: allAffectedPlansCount,
      affectedDates: reschedulableDates,
    });
  }

  // 7. 우선순위 순으로 정렬 (높은 우선순위가 먼저)
  suggestions.sort((a, b) => b.priority - a.priority);

  return suggestions;
}

/**
 * 미완료 플랜만 포함하는 날짜 범위 추천
 * 
 * @param selectedContentIds 선택된 콘텐츠 ID 목록
 * @param contents 전체 콘텐츠 목록
 * @param existingPlans 기존 플랜 목록
 * @param groupPeriodStart 플랜 그룹 시작일
 * @param groupPeriodEnd 플랜 그룹 종료일
 * @returns 추천 날짜 범위 (미완료 플랜만)
 */
export function suggestIncompletePlansRange(
  selectedContentIds: Set<string>,
  contents: PlanContent[],
  existingPlans: PlanWithDate[],
  groupPeriodStart: string,
  groupPeriodEnd: string
): SuggestedDateRange | null {
  const suggestions = generateDateRangeSuggestions(
    selectedContentIds,
    contents,
    existingPlans,
    groupPeriodStart,
    groupPeriodEnd
  );

  // 가장 우선순위가 높은 추천 반환
  return suggestions.length > 0 ? suggestions[0] : null;
}

