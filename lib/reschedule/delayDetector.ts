/**
 * 학습 지연 감지기
 * 
 * 플랜 그룹의 학습 지연을 감지하고 분석합니다.
 * - 계획 대비 실제 진행률 계산
 * - 지연 정도 측정
 * - 지연 원인 분석
 * 
 * @module lib/reschedule/delayDetector
 */

import { format, parseISO, differenceInDays, isBefore, isAfter } from "date-fns";
import type { Plan } from "@/lib/data/studentPlans";

// ============================================
// 타입 정의
// ============================================

/**
 * 지연 심각도
 */
export type DelaySeverity = "none" | "low" | "medium" | "high" | "critical";

/**
 * 지연 원인
 */
export type DelayCause =
  | "low_completion_rate" // 낮은 완료율
  | "missed_plans" // 미완료 플랜 누적
  | "slow_progress" // 진행 속도 저하
  | "overload" // 과부하
  | "schedule_conflict"; // 일정 충돌

/**
 * 지연 분석 결과
 */
export interface DelayAnalysis {
  /** 지연 심각도 */
  severity: DelaySeverity;
  /** 지연 정도 (일 단위) */
  delayDays: number;
  /** 지연 원인 목록 */
  causes: DelayCause[];
  /** 지연 설명 */
  description: string;
  /** 계획 대비 실제 진행률 (%) */
  progressRate: number;
  /** 예상 완료일 */
  expectedCompletionDate: string | null;
  /** 실제 예상 완료일 (지연 반영) */
  actualCompletionDate: string | null;
  /** 영향받는 날짜 목록 */
  affectedDates: string[];
  /** 상세 분석 데이터 */
  details: {
    totalPlans: number;
    completedPlans: number;
    missedPlans: number;
    averageCompletionRate: number;
    dailyRequiredPlans: number;
    dailyActualPlans: number;
  };
}

/**
 * 플랜 그룹 분석 입력
 */
export interface PlanGroupAnalysisInput {
  /** 플랜 목록 */
  plans: Plan[];
  /** 플랜 그룹 시작일 */
  startDate: string; // YYYY-MM-DD
  /** 플랜 그룹 종료일 */
  endDate: string; // YYYY-MM-DD
  /** 현재 날짜 (기본값: 오늘) */
  currentDate?: string; // YYYY-MM-DD
}

// ============================================
// 진행률 계산
// ============================================

/**
 * 플랜 완료 여부 확인
 */
function isPlanCompleted(plan: Plan): boolean {
  return plan.status === "completed" || plan.actual_end_time !== null;
}

/**
 * 플랜 진행률 계산
 */
function calculatePlanProgress(plan: Plan): number {
  if (isPlanCompleted(plan)) {
    return 100;
  }

  if (!plan.planned_start_page_or_time || !plan.planned_end_page_or_time) {
    return 0;
  }

  const totalRange =
    plan.planned_end_page_or_time - plan.planned_start_page_or_time;
  if (totalRange <= 0) {
    return 0;
  }

  const completedRange = plan.completed_amount || 0;
  return Math.min(100, Math.round((completedRange / totalRange) * 100));
}

/**
 * 날짜별 플랜 통계 계산
 */
function calculateDailyStats(plans: Plan[]): Map<
  string,
  {
    total: number;
    completed: number;
    inProgress: number;
    missed: number;
  }
> {
  const statsMap = new Map<
    string,
    {
      total: number;
      completed: number;
      inProgress: number;
      missed: number;
    }
  >();

  const today = format(new Date(), "yyyy-MM-dd");

  plans.forEach((plan) => {
    if (!plan.plan_date) {
      return;
    }

    const date = plan.plan_date;
    if (!statsMap.has(date)) {
      statsMap.set(date, {
        total: 0,
        completed: 0,
        inProgress: 0,
        missed: 0,
      });
    }

    const stats = statsMap.get(date)!;
    stats.total++;

    if (isPlanCompleted(plan)) {
      stats.completed++;
    } else if (plan.actual_start_time) {
      stats.inProgress++;
    } else if (isBefore(parseISO(date), parseISO(today))) {
      // 과거 날짜의 미완료 플랜은 누락으로 간주
      stats.missed++;
    }
  });

  return statsMap;
}

// ============================================
// 지연 감지
// ============================================

/**
 * 지연 심각도 계산
 */
function calculateSeverity(
  delayDays: number,
  progressRate: number,
  missedPlans: number,
  totalPlans: number
): DelaySeverity {
  if (delayDays <= 0 && progressRate >= 90) {
    return "none";
  }

  if (delayDays <= 1 && progressRate >= 80) {
    return "low";
  }

  if (delayDays <= 3 && progressRate >= 70) {
    return "medium";
  }

  if (delayDays <= 7 && progressRate >= 50) {
    return "high";
  }

  return "critical";
}

/**
 * 지연 원인 분석
 */
function analyzeCauses(
  plans: Plan[],
  progressRate: number,
  dailyStats: Map<string, { total: number; completed: number; inProgress: number; missed: number }>,
  currentDate: string
): DelayCause[] {
  const causes: DelayCause[] = [];

  // 낮은 완료율
  if (progressRate < 70) {
    causes.push("low_completion_rate");
  }

  // 미완료 플랜 누적
  let totalMissed = 0;
  dailyStats.forEach((stats) => {
    totalMissed += stats.missed;
  });
  if (totalMissed > plans.length * 0.1) {
    // 전체 플랜의 10% 이상 누락
    causes.push("missed_plans");
  }

  // 진행 속도 저하 (최근 3일 평균 완료율이 전체 평균보다 낮음)
  const recentDates = Array.from(dailyStats.keys())
    .filter((date) => isBefore(parseISO(date), parseISO(currentDate)))
    .sort()
    .slice(-3);

  if (recentDates.length > 0) {
    let recentCompleted = 0;
    let recentTotal = 0;
    recentDates.forEach((date) => {
      const stats = dailyStats.get(date);
      if (stats) {
        recentCompleted += stats.completed;
        recentTotal += stats.total;
      }
    });

    const recentRate =
      recentTotal > 0 ? (recentCompleted / recentTotal) * 100 : 0;
    if (recentRate < progressRate - 10) {
      // 최근 3일 완료율이 전체 평균보다 10%p 이상 낮음
      causes.push("slow_progress");
    }
  }

  return causes;
}

/**
 * 예상 완료일 계산
 */
function calculateCompletionDate(
  plans: Plan[],
  startDate: string,
  endDate: string,
  progressRate: number
): string | null {
  if (progressRate >= 100) {
    return format(new Date(), "yyyy-MM-dd");
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalDays = differenceInDays(end, start);
  const remainingProgress = 100 - progressRate;

  if (remainingProgress <= 0) {
    return format(new Date(), "yyyy-MM-dd");
  }

  // 선형 보간으로 예상 완료일 계산
  const progressPerDay = progressRate / Math.max(1, totalDays);
  const remainingDays = Math.ceil(remainingProgress / progressPerDay);
  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + remainingDays);

  return format(expectedDate, "yyyy-MM-dd");
}

/**
 * 학습 지연 분석
 * 
 * @param input 플랜 그룹 분석 입력
 * @returns 지연 분석 결과
 */
export function analyzeDelay(
  input: PlanGroupAnalysisInput
): DelayAnalysis {
  const { plans, startDate, endDate, currentDate } = input;
  const today = currentDate || format(new Date(), "yyyy-MM-dd");

  // 기본 통계 계산
  const totalPlans = plans.length;
  const completedPlans = plans.filter(isPlanCompleted).length;
  const missedPlans = plans.filter(
    (p) =>
      p.plan_date &&
      isBefore(parseISO(p.plan_date), parseISO(today)) &&
      !isPlanCompleted(p)
  ).length;

  // 진행률 계산
  const totalProgress = plans.reduce(
    (sum, plan) => sum + calculatePlanProgress(plan),
    0
  );
  const averageProgress = totalPlans > 0 ? totalProgress / totalPlans : 0;
  const progressRate = Math.round(averageProgress);

  // 날짜별 통계
  const dailyStats = calculateDailyStats(plans);

  // 일일 평균 계산
  const uniqueDates = Array.from(dailyStats.keys());
  const dailyRequiredPlans =
    uniqueDates.length > 0
      ? totalPlans / uniqueDates.length
      : 0;
  const dailyActualPlans =
    uniqueDates.length > 0
      ? completedPlans / uniqueDates.length
      : 0;

  // 지연 일수 계산 (계획 대비 실제 진행률 기반)
  const expectedProgress =
    (differenceInDays(parseISO(today), parseISO(startDate)) /
      Math.max(1, differenceInDays(parseISO(endDate), parseISO(startDate)))) *
    100;
  const delayProgress = expectedProgress - progressRate;
  const delayDays = Math.max(0, Math.ceil((delayProgress / 100) * differenceInDays(parseISO(endDate), parseISO(startDate))));

  // 지연 심각도 계산
  const severity = calculateSeverity(
    delayDays,
    progressRate,
    missedPlans,
    totalPlans
  );

  // 지연 원인 분석
  const causes = analyzeCauses(plans, progressRate, dailyStats, today);

  // 예상 완료일 계산
  const expectedCompletionDate = calculateCompletionDate(
    plans,
    startDate,
    endDate,
    progressRate
  );
  const actualCompletionDate = expectedCompletionDate
    ? format(
        new Date(
          parseISO(expectedCompletionDate).getTime() +
            delayDays * 24 * 60 * 60 * 1000
        ),
        "yyyy-MM-dd"
      )
    : null;

  // 영향받는 날짜 목록 (미완료 플랜이 있는 과거 날짜)
  const affectedDates = Array.from(dailyStats.keys())
    .filter((date) => {
      const stats = dailyStats.get(date);
      return (
        stats &&
        stats.missed > 0 &&
        isBefore(parseISO(date), parseISO(today))
      );
    })
    .sort();

  // 설명 생성
  const description = generateDescription(severity, delayDays, causes, progressRate);

  return {
    severity,
    delayDays,
    causes,
    description,
    progressRate,
    expectedCompletionDate,
    actualCompletionDate,
    affectedDates,
    details: {
      totalPlans,
      completedPlans,
      missedPlans,
      averageCompletionRate: progressRate,
      dailyRequiredPlans: Math.round(dailyRequiredPlans * 10) / 10,
      dailyActualPlans: Math.round(dailyActualPlans * 10) / 10,
    },
  };
}

/**
 * 설명 생성
 */
function generateDescription(
  severity: DelaySeverity,
  delayDays: number,
  causes: DelayCause[],
  progressRate: number
): string {
  if (severity === "none") {
    return "학습이 계획대로 진행되고 있습니다.";
  }

  const causeMessages: Record<DelayCause, string> = {
    low_completion_rate: "완료율이 낮습니다",
    missed_plans: "미완료 플랜이 누적되었습니다",
    slow_progress: "진행 속도가 저하되었습니다",
    overload: "학습량이 과부하 상태입니다",
    schedule_conflict: "일정 충돌이 발생했습니다",
  };

  const causeText = causes.map((c) => causeMessages[c]).join(", ");
  const severityText =
    severity === "critical"
      ? "심각"
      : severity === "high"
      ? "높음"
      : severity === "medium"
      ? "보통"
      : "낮음";

  return `학습 지연이 감지되었습니다 (${severityText} 수준, 약 ${delayDays}일 지연). 진행률 ${progressRate}%, 원인: ${causeText}.`;
}

