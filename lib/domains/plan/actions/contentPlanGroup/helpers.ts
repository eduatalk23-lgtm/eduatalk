/**
 * Content-based PlanGroup Helper Functions
 *
 * 스케줄링 및 날짜 관련 헬퍼 함수들
 */

import type { StudyType } from "@/lib/types/plan";
import type { DefaultRecommendation, ReviewDate } from "./types";

// ============================================
// Date Utility Functions
// ============================================

/**
 * ISO 주차 키 생성 (예: "2024-W01")
 */
export function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

/**
 * ISO 주차 번호 계산
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ============================================
// Schedule Helper Functions
// ============================================

/**
 * 전략 과목용 날짜 선택 (주당 N일)
 * preferredDays가 지정되면 해당 요일 우선 선택
 */
export function selectStrategyDates(
  allDates: Date[],
  daysPerWeek: number,
  preferredDays?: number[]
): Date[] {
  const weeklyDates = new Map<string, Date[]>();

  // 주별로 그룹화
  for (const date of allDates) {
    const weekKey = getWeekKey(date);
    if (!weeklyDates.has(weekKey)) {
      weeklyDates.set(weekKey, []);
    }
    weeklyDates.get(weekKey)!.push(date);
  }

  // 각 주에서 N일 선택
  const selectedDates: Date[] = [];
  for (const [, dates] of weeklyDates) {
    const count = Math.min(daysPerWeek, dates.length);

    if (preferredDays && preferredDays.length > 0) {
      // preferredDays가 지정된 경우: 해당 요일 우선 선택
      const preferredSet = new Set(preferredDays);
      const preferredMatches = dates.filter((d) =>
        preferredSet.has(d.getDay())
      );
      const otherDates = dates.filter((d) => !preferredSet.has(d.getDay()));

      // preferred에서 최대한 선택, 부족하면 다른 날짜에서 보충
      const selected = preferredMatches.slice(0, count);
      if (selected.length < count) {
        selected.push(...otherDates.slice(0, count - selected.length));
      }
      selectedDates.push(...selected.slice(0, count));
    } else {
      // preferredDays가 없으면 균등 분산
      const step = Math.floor(dates.length / count);
      for (let i = 0; i < count; i++) {
        selectedDates.push(dates[Math.min(i * step, dates.length - 1)]);
      }
    }
  }

  return selectedDates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * 학습 가능한 날짜 계산
 */
export function getAvailableStudyDates(
  startDate: Date,
  endDate: Date,
  weekdays: number[],
  exclusions: Array<{ date: string }>,
  studyType: StudyType,
  strategyDaysPerWeek?: number,
  preferredDays?: number[]
): Date[] {
  const dates: Date[] = [];
  const exclusionSet = new Set(exclusions.map((e) => e.date));
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];

    // 해당 요일이 학습일이고 제외일이 아닌 경우
    if (weekdays.includes(dayOfWeek) && !exclusionSet.has(dateStr)) {
      dates.push(new Date(current));
    }

    current.setDate(current.getDate() + 1);
  }

  // 전략 과목인 경우: 주당 N일만 선택
  if (studyType === "strategy" && strategyDaysPerWeek) {
    return selectStrategyDates(dates, strategyDaysPerWeek, preferredDays);
  }

  return dates;
}

/**
 * 일일 학습량 배분
 */
export function distributeDailyAmounts(
  totalAmount: number,
  studyDays: number
): number[] {
  const baseAmount = Math.floor(totalAmount / studyDays);
  const remainder = totalAmount % studyDays;
  const amounts: number[] = [];

  for (let i = 0; i < studyDays; i++) {
    // 나머지는 앞쪽 날짜에 분배
    amounts.push(baseAmount + (i < remainder ? 1 : 0));
  }

  return amounts;
}

/**
 * 복습일 계산 (주말 토요일 기준)
 */
export function getReviewDates(studyDates: Date[], endDate: Date): ReviewDate[] {
  if (studyDates.length === 0) return [];

  const reviewDates: ReviewDate[] = [];
  const weeklyPlans = new Map<number, Date[]>();

  // 주차별로 학습일 그룹화
  for (const date of studyDates) {
    const weekNum = getWeekNumber(date);
    if (!weeklyPlans.has(weekNum)) {
      weeklyPlans.set(weekNum, []);
    }
    weeklyPlans.get(weekNum)!.push(date);
  }

  // 각 주의 토요일 (또는 마지막 학습일 다음 토요일)
  for (const [weekNum, plans] of weeklyPlans) {
    if (plans.length === 0) continue;

    // 해당 주의 마지막 학습일을 기준으로 토요일 찾기
    const lastPlan = plans[plans.length - 1];
    const dayOfWeek = lastPlan.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7; // 토요일이면 다음주 토요일

    const reviewDate = new Date(lastPlan);
    reviewDate.setDate(reviewDate.getDate() + daysUntilSaturday);

    // 종료일 이전이어야 함
    if (reviewDate <= endDate) {
      reviewDates.push({
        date: reviewDate,
        weekNumber: weekNum,
        plansToReview: plans,
      });
    }
  }

  return reviewDates.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * 기본 학습 추천 생성
 */
export function getDefaultRecommendation(
  totalUnits: number,
  unitType: "page" | "episode" | "chapter"
): DefaultRecommendation {
  // 단위 타입별 기본 일일 학습량
  const defaultAmounts: Record<typeof unitType, number> = {
    page: 20,
    episode: 2,
    chapter: 1,
  };

  const dailyAmount = defaultAmounts[unitType];
  const totalStudyDays = Math.ceil(totalUnits / dailyAmount);
  const totalWeeks = Math.ceil(totalStudyDays / 5); // 주 5일 기준
  const recommendedDuration = totalWeeks * 7;

  const today = new Date();
  const estimatedEnd = new Date(today);
  estimatedEnd.setDate(estimatedEnd.getDate() + recommendedDuration);

  return {
    recommendedDuration,
    recommendedDailyAmount: dailyAmount,
    recommendedWeekdays: [1, 2, 3, 4, 5], // 월-금
    studyType: totalUnits > 100 ? "strategy" : "weakness",
    estimatedEndDate: estimatedEnd.toISOString().split("T")[0],
    confidence: "low",
    reasoning: `기본 추천: ${unitType === "page" ? "페이지" : unitType === "episode" ? "회차" : "챕터"}당 일일 ${dailyAmount}${unitType === "page" ? "페이지" : "단위"}`,
  };
}
