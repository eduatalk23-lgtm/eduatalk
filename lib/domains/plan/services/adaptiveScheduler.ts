/**
 * 적응형 스케줄러 서비스
 *
 * 학습 패턴을 분석하여 지능적인 스케줄 조정을 제안합니다.
 *
 * @module lib/domains/plan/services/adaptiveScheduler
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/lib/data/studentPlans";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// 상수 정의
// ============================================

/** 분석에 사용할 최소 플랜 수 */
const MIN_PLANS_FOR_ANALYSIS = 10;

/** 완료율 임계값 */
const COMPLETION_RATE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  POOR: 50,
};

/** 시간대 정의 (시작 시간 기준) */
const TIME_PERIODS = {
  MORNING: { start: 6, end: 12, label: "오전" },
  AFTERNOON: { start: 12, end: 17, label: "오후" },
  EVENING: { start: 17, end: 21, label: "저녁" },
  NIGHT: { start: 21, end: 24, label: "밤" },
  EARLY: { start: 0, end: 6, label: "새벽" },
} as const;

/** 요일 레이블 */
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// ============================================
// 타입 정의
// ============================================

/**
 * 시간대별 학습 성과
 */
export type TimePeriodPerformance = {
  period: keyof typeof TIME_PERIODS;
  label: string;
  totalPlans: number;
  completedPlans: number;
  completionRate: number;
  averageProgress: number;
  /** 예상 대비 실제 소요 시간 비율 (1.0 = 예상과 동일) */
  timeEfficiency: number;
};

/**
 * 요일별 학습 성과
 */
export type DayOfWeekPerformance = {
  dayOfWeek: number;
  label: string;
  totalPlans: number;
  completedPlans: number;
  completionRate: number;
  averageProgress: number;
};

/**
 * 과목별 학습 성과
 */
export type SubjectPerformance = {
  subject: string;
  subjectCategory?: string;
  totalPlans: number;
  completedPlans: number;
  completionRate: number;
  averageProgress: number;
  averageDurationMinutes: number;
  /** 취약 과목 여부 */
  isWeak: boolean;
};

/**
 * 학습 패턴 분석 결과
 */
export type LearningPatternAnalysis = {
  /** 분석에 사용된 플랜 수 */
  analyzedPlansCount: number;
  /** 분석 기간 */
  dateRange: {
    start: string;
    end: string;
  };
  /** 시간대별 성과 */
  timePeriodPerformance: TimePeriodPerformance[];
  /** 요일별 성과 */
  dayOfWeekPerformance: DayOfWeekPerformance[];
  /** 과목별 성과 */
  subjectPerformance: SubjectPerformance[];
  /** 최적 학습 시간대 */
  optimalTimePeriod: {
    period: keyof typeof TIME_PERIODS;
    label: string;
    reason: string;
  } | null;
  /** 최적 학습 요일 */
  optimalDayOfWeek: {
    dayOfWeek: number;
    label: string;
    reason: string;
  } | null;
  /** 취약 과목 목록 */
  weakSubjects: SubjectPerformance[];
  /** 전체 완료율 */
  overallCompletionRate: number;
  /** 전체 평균 진행률 */
  overallAverageProgress: number;
};

/**
 * 스케줄 조정 권장사항
 */
export type ScheduleRecommendation = {
  /** 권장 유형 */
  type: "time_shift" | "day_change" | "subject_focus" | "workload_adjust";
  /** 우선순위 (1-5, 5가 가장 높음) */
  priority: number;
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 예상 개선 효과 */
  expectedImprovement: string;
  /** 구체적인 조치 사항 */
  actions: string[];
};

/**
 * 적응형 스케줄 분석 결과
 */
export type AdaptiveScheduleAnalysis = {
  /** 학습 패턴 분석 */
  patterns: LearningPatternAnalysis;
  /** 스케줄 조정 권장사항 */
  recommendations: ScheduleRecommendation[];
  /** 분석 날짜 */
  analyzedAt: string;
};

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 시간 문자열 (HH:mm)에서 시간대를 결정합니다.
 */
function getTimePeriod(timeStr: string | null): keyof typeof TIME_PERIODS | null {
  if (!timeStr) return null;

  const [hours] = timeStr.split(":").map(Number);
  if (isNaN(hours)) return null;

  for (const [period, range] of Object.entries(TIME_PERIODS)) {
    if (hours >= range.start && hours < range.end) {
      return period as keyof typeof TIME_PERIODS;
    }
  }

  // 새벽 시간대 처리 (0-6시)
  if (hours >= 0 && hours < 6) {
    return "EARLY";
  }

  return null;
}

/**
 * 날짜 문자열에서 요일을 반환합니다.
 */
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

/**
 * 플랜이 완료되었는지 확인합니다.
 */
function isPlanCompleted(plan: Plan): boolean {
  return (
    plan.progress !== null &&
    plan.progress >= 100 &&
    plan.actual_end_time !== null
  );
}

// ============================================
// 분석 함수
// ============================================

/**
 * 시간대별 학습 성과를 분석합니다.
 */
function analyzeTimePeriodPerformance(
  plans: Plan[]
): TimePeriodPerformance[] {
  const periodStats = new Map<
    keyof typeof TIME_PERIODS,
    {
      total: number;
      completed: number;
      progressSum: number;
      durationRatioSum: number;
    }
  >();

  // 초기화
  for (const period of Object.keys(TIME_PERIODS) as (keyof typeof TIME_PERIODS)[]) {
    periodStats.set(period, {
      total: 0,
      completed: 0,
      progressSum: 0,
      durationRatioSum: 0,
    });
  }

  // 데이터 수집
  plans.forEach((plan) => {
    const period = getTimePeriod(plan.start_time);
    if (!period) return;

    const stats = periodStats.get(period)!;
    stats.total++;
    stats.progressSum += plan.progress ?? 0;

    if (isPlanCompleted(plan)) {
      stats.completed++;
    }

    // 시간 효율성 계산 (실제 소요 시간 / 예상 소요 시간)
    if (plan.total_duration_seconds && plan.start_time && plan.end_time) {
      const [startH, startM] = plan.start_time.split(":").map(Number);
      const [endH, endM] = plan.end_time.split(":").map(Number);
      const plannedMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const actualMinutes = plan.total_duration_seconds / 60;
      if (plannedMinutes > 0) {
        stats.durationRatioSum += actualMinutes / plannedMinutes;
      }
    }
  });

  // 결과 생성
  return Array.from(periodStats.entries())
    .map(([period, stats]) => ({
      period,
      label: TIME_PERIODS[period].label,
      totalPlans: stats.total,
      completedPlans: stats.completed,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      averageProgress: stats.total > 0 ? Math.round(stats.progressSum / stats.total) : 0,
      timeEfficiency: stats.completed > 0
        ? Math.round((stats.durationRatioSum / stats.completed) * 100) / 100
        : 1,
    }))
    .filter((p) => p.totalPlans > 0)
    .sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * 요일별 학습 성과를 분석합니다.
 */
function analyzeDayOfWeekPerformance(
  plans: Plan[]
): DayOfWeekPerformance[] {
  const dayStats = Array.from({ length: 7 }, () => ({
    total: 0,
    completed: 0,
    progressSum: 0,
  }));

  plans.forEach((plan) => {
    if (!plan.plan_date) return;
    const dayOfWeek = getDayOfWeek(plan.plan_date);
    dayStats[dayOfWeek].total++;
    dayStats[dayOfWeek].progressSum += plan.progress ?? 0;

    if (isPlanCompleted(plan)) {
      dayStats[dayOfWeek].completed++;
    }
  });

  return dayStats
    .map((stats, dayOfWeek) => ({
      dayOfWeek,
      label: DAY_LABELS[dayOfWeek],
      totalPlans: stats.total,
      completedPlans: stats.completed,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      averageProgress: stats.total > 0 ? Math.round(stats.progressSum / stats.total) : 0,
    }))
    .filter((d) => d.totalPlans > 0)
    .sort((a, b) => b.completionRate - a.completionRate);
}

/**
 * 과목별 학습 성과를 분석합니다.
 */
function analyzeSubjectPerformance(plans: Plan[]): SubjectPerformance[] {
  const subjectStats = new Map<
    string,
    {
      category?: string;
      total: number;
      completed: number;
      progressSum: number;
      durationSum: number;
    }
  >();

  plans.forEach((plan) => {
    const subject = plan.content_subject || "기타";
    if (!subjectStats.has(subject)) {
      subjectStats.set(subject, {
        category: plan.content_subject_category ?? undefined,
        total: 0,
        completed: 0,
        progressSum: 0,
        durationSum: 0,
      });
    }

    const stats = subjectStats.get(subject)!;
    stats.total++;
    stats.progressSum += plan.progress ?? 0;
    stats.durationSum += (plan.total_duration_seconds ?? 0) / 60;

    if (isPlanCompleted(plan)) {
      stats.completed++;
    }
  });

  // 전체 평균 완료율 계산
  const totalCompleted = Array.from(subjectStats.values()).reduce(
    (sum, s) => sum + s.completed,
    0
  );
  const totalPlans = Array.from(subjectStats.values()).reduce(
    (sum, s) => sum + s.total,
    0
  );
  const overallCompletionRate = totalPlans > 0 ? (totalCompleted / totalPlans) * 100 : 0;

  return Array.from(subjectStats.entries())
    .map(([subject, stats]) => {
      const completionRate = stats.total > 0
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;

      return {
        subject,
        subjectCategory: stats.category,
        totalPlans: stats.total,
        completedPlans: stats.completed,
        completionRate,
        averageProgress: stats.total > 0 ? Math.round(stats.progressSum / stats.total) : 0,
        averageDurationMinutes: stats.total > 0
          ? Math.round(stats.durationSum / stats.total)
          : 0,
        // 전체 평균보다 15% 이상 낮으면 취약 과목으로 간주
        isWeak: completionRate < overallCompletionRate - 15,
      };
    })
    .sort((a, b) => a.completionRate - b.completionRate);
}

/**
 * 권장사항을 생성합니다.
 */
function generateRecommendations(
  patterns: LearningPatternAnalysis
): ScheduleRecommendation[] {
  const recommendations: ScheduleRecommendation[] = [];

  // 1. 최적 시간대로 이동 권장
  if (patterns.optimalTimePeriod && patterns.timePeriodPerformance.length >= 2) {
    const best = patterns.timePeriodPerformance[0];
    const worst = patterns.timePeriodPerformance[patterns.timePeriodPerformance.length - 1];

    if (worst.completionRate < COMPLETION_RATE_THRESHOLDS.POOR && best.completionRate > worst.completionRate + 20) {
      recommendations.push({
        type: "time_shift",
        priority: 5,
        title: `${worst.label} 학습을 ${best.label}으로 이동`,
        description: `${worst.label} 시간대의 완료율(${worst.completionRate}%)이 낮습니다. ${best.label} 시간대(${best.completionRate}%)가 더 효과적입니다.`,
        expectedImprovement: `완료율 ${best.completionRate - worst.completionRate}% 향상 예상`,
        actions: [
          `${worst.label} 시간대의 플랜을 ${best.label}으로 재배치하세요.`,
          `시간표 설정에서 ${best.label} 학습 시간을 늘려보세요.`,
        ],
      });
    }
  }

  // 2. 요일별 조정 권장
  if (patterns.dayOfWeekPerformance.length >= 2) {
    const best = patterns.dayOfWeekPerformance[0];
    const worst = patterns.dayOfWeekPerformance[patterns.dayOfWeekPerformance.length - 1];

    if (worst.completionRate < COMPLETION_RATE_THRESHOLDS.POOR) {
      recommendations.push({
        type: "day_change",
        priority: 4,
        title: `${worst.label}요일 학습량 조정`,
        description: `${worst.label}요일의 완료율(${worst.completionRate}%)이 낮습니다.`,
        expectedImprovement: `학습 부담 분산으로 전체 완료율 향상 예상`,
        actions: [
          `${worst.label}요일의 학습량을 줄이세요.`,
          `${best.label}요일(${best.completionRate}%)에 더 많은 학습을 배치하세요.`,
          `${worst.label}요일에는 가벼운 복습 위주로 계획하세요.`,
        ],
      });
    }
  }

  // 3. 취약 과목 집중 권장
  if (patterns.weakSubjects.length > 0) {
    const weakest = patterns.weakSubjects[0];
    recommendations.push({
      type: "subject_focus",
      priority: 5,
      title: `${weakest.subject} 과목 집중 학습 필요`,
      description: `${weakest.subject} 과목의 완료율(${weakest.completionRate}%)이 전체 평균보다 낮습니다.`,
      expectedImprovement: `취약 과목 보완으로 전체 학습 효과 향상`,
      actions: [
        `${weakest.subject} 과목의 학습 시간을 최적 시간대로 배치하세요.`,
        `학습 범위를 더 작게 나눠서 진행하세요.`,
        `해당 과목 학습 전 충분한 휴식을 취하세요.`,
      ],
    });
  }

  // 4. 전체 학습량 조정 권장
  if (patterns.overallCompletionRate < COMPLETION_RATE_THRESHOLDS.POOR) {
    recommendations.push({
      type: "workload_adjust",
      priority: 5,
      title: "전체 학습량 조정 필요",
      description: `전체 완료율(${patterns.overallCompletionRate}%)이 낮습니다. 학습량이 과다할 수 있습니다.`,
      expectedImprovement: "적정 학습량으로 조정 시 완료율 50% 이상 향상 가능",
      actions: [
        "일일 학습량을 줄여보세요.",
        "플랜 기간을 늘려 여유롭게 계획하세요.",
        "주말에 보충 학습을 배치하세요.",
      ],
    });
  } else if (patterns.overallCompletionRate < COMPLETION_RATE_THRESHOLDS.GOOD) {
    recommendations.push({
      type: "workload_adjust",
      priority: 3,
      title: "학습 계획 미세 조정",
      description: `완료율(${patterns.overallCompletionRate}%)을 개선할 여지가 있습니다.`,
      expectedImprovement: "미세 조정으로 완료율 80% 이상 달성 가능",
      actions: [
        "완료하지 못한 플랜의 패턴을 분석해보세요.",
        "버퍼 시간을 추가하세요.",
      ],
    });
  }

  return recommendations.sort((a, b) => b.priority - a.priority);
}

// ============================================
// 메인 함수
// ============================================

/**
 * 학습 패턴을 분석합니다.
 *
 * @param plans 분석할 플랜 목록
 * @returns 학습 패턴 분석 결과
 */
export function analyzeLearningPatterns(plans: Plan[]): LearningPatternAnalysis {
  // 날짜 범위 계산
  const dates = plans
    .filter((p) => p.plan_date)
    .map((p) => p.plan_date!)
    .sort();

  const dateRange = {
    start: dates[0] || "",
    end: dates[dates.length - 1] || "",
  };

  // 시간대별 성과
  const timePeriodPerformance = analyzeTimePeriodPerformance(plans);

  // 요일별 성과
  const dayOfWeekPerformance = analyzeDayOfWeekPerformance(plans);

  // 과목별 성과
  const subjectPerformance = analyzeSubjectPerformance(plans);

  // 취약 과목
  const weakSubjects = subjectPerformance.filter((s) => s.isWeak);

  // 전체 통계
  const completedPlans = plans.filter(isPlanCompleted).length;
  const totalProgressSum = plans.reduce((sum, p) => sum + (p.progress ?? 0), 0);

  const overallCompletionRate =
    plans.length > 0 ? Math.round((completedPlans / plans.length) * 100) : 0;
  const overallAverageProgress =
    plans.length > 0 ? Math.round(totalProgressSum / plans.length) : 0;

  // 최적 시간대 결정
  const optimalTimePeriod =
    timePeriodPerformance.length > 0
      ? {
          period: timePeriodPerformance[0].period,
          label: timePeriodPerformance[0].label,
          reason: `완료율 ${timePeriodPerformance[0].completionRate}%로 가장 높음`,
        }
      : null;

  // 최적 요일 결정
  const optimalDayOfWeek =
    dayOfWeekPerformance.length > 0
      ? {
          dayOfWeek: dayOfWeekPerformance[0].dayOfWeek,
          label: dayOfWeekPerformance[0].label,
          reason: `완료율 ${dayOfWeekPerformance[0].completionRate}%로 가장 높음`,
        }
      : null;

  return {
    analyzedPlansCount: plans.length,
    dateRange,
    timePeriodPerformance,
    dayOfWeekPerformance,
    subjectPerformance,
    optimalTimePeriod,
    optimalDayOfWeek,
    weakSubjects,
    overallCompletionRate,
    overallAverageProgress,
  };
}

/**
 * 학생의 학습 패턴을 분석하고 스케줄 조정 권장사항을 생성합니다.
 *
 * @param supabase Supabase 클라이언트
 * @param studentId 학생 ID
 * @param daysBack 분석할 과거 일수 (기본값: 30일)
 * @returns 적응형 스케줄 분석 결과
 */
export async function analyzeAdaptiveSchedule(
  supabase: SupabaseClient,
  studentId: string,
  daysBack: number = 30
): Promise<AdaptiveScheduleAnalysis> {
  // 분석 기간 설정
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // 플랜 조회
  const { data: plans, error } = await supabase
    .from("student_plan")
    .select("*")
    .eq("student_id", studentId)
    .gte("plan_date", startDateStr)
    .lte("plan_date", endDateStr)
    .order("plan_date", { ascending: true });

  if (error) {
    logActionError(
      { domain: "plan", action: "analyzeAdaptiveSchedule" },
      error,
      { studentId, daysBack }
    );
    throw error;
  }

  const planList = (plans || []) as unknown as Plan[];

  // 데이터가 부족하면 기본 결과 반환
  if (planList.length < MIN_PLANS_FOR_ANALYSIS) {
    return {
      patterns: {
        analyzedPlansCount: planList.length,
        dateRange: { start: startDateStr, end: endDateStr },
        timePeriodPerformance: [],
        dayOfWeekPerformance: [],
        subjectPerformance: [],
        optimalTimePeriod: null,
        optimalDayOfWeek: null,
        weakSubjects: [],
        overallCompletionRate: 0,
        overallAverageProgress: 0,
      },
      recommendations: [
        {
          type: "workload_adjust",
          priority: 1,
          title: "분석을 위한 데이터 부족",
          description: `최소 ${MIN_PLANS_FOR_ANALYSIS}개의 플랜이 필요합니다. 현재 ${planList.length}개의 플랜이 있습니다.`,
          expectedImprovement: "더 많은 학습을 진행한 후 다시 분석해주세요.",
          actions: ["학습 플랜을 계속 진행해주세요."],
        },
      ],
      analyzedAt: new Date().toISOString(),
    };
  }

  // 패턴 분석
  const patterns = analyzeLearningPatterns(planList);

  // 권장사항 생성
  const recommendations = generateRecommendations(patterns);

  return {
    patterns,
    recommendations,
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================
// 취약 과목 강화 스케줄 생성
// ============================================

/**
 * 취약 과목 강화 스케줄 제안
 */
export type WeakSubjectReinforcement = {
  /** 과목명 */
  subject: string;
  /** 과목 카테고리 */
  subjectCategory?: string;
  /** 현재 완료율 */
  currentCompletionRate: number;
  /** 목표 완료율 */
  targetCompletionRate: number;
  /** 추가 필요 학습 시간 (분) */
  additionalMinutesNeeded: number;
  /** 권장 학습 시간대 */
  suggestedTimePeriod: {
    period: keyof typeof TIME_PERIODS;
    label: string;
    reason: string;
  };
  /** 권장 학습 요일 */
  suggestedDays: {
    dayOfWeek: number;
    label: string;
  }[];
  /** 세부 권장사항 */
  tips: string[];
};

/**
 * 취약 과목 강화 스케줄 분석 결과
 */
export type WeakSubjectReinforcementPlan = {
  /** 취약 과목 수 */
  weakSubjectsCount: number;
  /** 총 추가 학습 시간 (분) */
  totalAdditionalMinutes: number;
  /** 강화 스케줄 목록 */
  reinforcements: WeakSubjectReinforcement[];
  /** 전체 요약 */
  summary: string;
  /** 생성 일시 */
  generatedAt: string;
};

/**
 * 취약 과목에 대한 강화 스케줄을 생성합니다.
 *
 * @param patterns 학습 패턴 분석 결과
 * @param targetCompletionRate 목표 완료율 (기본값: 80%)
 * @returns 취약 과목 강화 스케줄 계획
 */
export function generateWeakSubjectReinforcement(
  patterns: LearningPatternAnalysis,
  targetCompletionRate: number = 80
): WeakSubjectReinforcementPlan {
  const reinforcements: WeakSubjectReinforcement[] = [];

  // 취약 과목에 대해 강화 스케줄 생성
  patterns.weakSubjects.forEach((subject) => {
    // 목표 완료율 달성을 위한 추가 학습 시간 계산
    const completionGap = targetCompletionRate - subject.completionRate;
    const additionalPlansNeeded = Math.ceil(
      (completionGap / 100) * subject.totalPlans * 1.5
    );
    const additionalMinutesNeeded = additionalPlansNeeded * subject.averageDurationMinutes;

    // 최적 시간대 결정 (전체 최적 시간대 활용)
    const suggestedTimePeriod = patterns.optimalTimePeriod || {
      period: "AFTERNOON" as keyof typeof TIME_PERIODS,
      label: TIME_PERIODS.AFTERNOON.label,
      reason: "기본 권장 시간대",
    };

    // 최적 요일 결정 (상위 2-3개 요일)
    const suggestedDays = patterns.dayOfWeekPerformance
      .slice(0, 3)
      .map((d) => ({
        dayOfWeek: d.dayOfWeek,
        label: d.label,
      }));

    // 팁 생성
    const tips: string[] = [];

    if (subject.averageDurationMinutes > 60) {
      tips.push("학습 시간이 길어서 집중력이 떨어질 수 있습니다. 30-40분 단위로 나눠서 학습하세요.");
    }

    if (subject.completionRate < 30) {
      tips.push("완료율이 매우 낮습니다. 더 작은 단위로 목표를 설정하세요.");
    }

    tips.push(`${suggestedTimePeriod.label} 시간대에 학습하면 효과가 좋습니다.`);
    tips.push(`${suggestedDays.map(d => d.label).join(", ")}요일에 집중적으로 학습하세요.`);

    if (completionGap > 30) {
      tips.push("기초부터 차근차근 복습하는 것을 권장합니다.");
    }

    reinforcements.push({
      subject: subject.subject,
      subjectCategory: subject.subjectCategory,
      currentCompletionRate: subject.completionRate,
      targetCompletionRate,
      additionalMinutesNeeded,
      suggestedTimePeriod,
      suggestedDays,
      tips,
    });
  });

  // 총 추가 학습 시간 계산
  const totalAdditionalMinutes = reinforcements.reduce(
    (sum, r) => sum + r.additionalMinutesNeeded,
    0
  );

  // 요약 생성
  let summary: string;
  if (reinforcements.length === 0) {
    summary = "취약 과목이 없습니다. 현재 학습 패턴을 유지하세요!";
  } else if (reinforcements.length === 1) {
    summary = `${reinforcements[0].subject} 과목에 집중이 필요합니다. 주당 약 ${Math.ceil(totalAdditionalMinutes / 7)}분의 추가 학습을 권장합니다.`;
  } else {
    summary = `${reinforcements.length}개 과목의 보완이 필요합니다. 주당 약 ${Math.ceil(totalAdditionalMinutes / 7)}분의 추가 학습을 권장합니다.`;
  }

  return {
    weakSubjectsCount: reinforcements.length,
    totalAdditionalMinutes,
    reinforcements,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 학생의 취약 과목 강화 스케줄을 생성합니다.
 *
 * @param supabase Supabase 클라이언트
 * @param studentId 학생 ID
 * @param daysBack 분석할 과거 일수 (기본값: 30일)
 * @param targetCompletionRate 목표 완료율 (기본값: 80%)
 * @returns 취약 과목 강화 스케줄 계획
 */
export async function generateStudentReinforcement(
  supabase: SupabaseClient,
  studentId: string,
  daysBack: number = 30,
  targetCompletionRate: number = 80
): Promise<WeakSubjectReinforcementPlan> {
  // 먼저 적응형 스케줄 분석 수행
  const analysis = await analyzeAdaptiveSchedule(supabase, studentId, daysBack);

  // 취약 과목 강화 스케줄 생성
  return generateWeakSubjectReinforcement(analysis.patterns, targetCompletionRate);
}

/**
 * 특정 플랜 그룹의 학습 패턴을 분석합니다.
 *
 * @param supabase Supabase 클라이언트
 * @param planGroupId 플랜 그룹 ID
 * @returns 적응형 스케줄 분석 결과
 */
export async function analyzeGroupSchedule(
  supabase: SupabaseClient,
  planGroupId: string
): Promise<AdaptiveScheduleAnalysis> {
  // 플랜 그룹의 플랜 조회
  const { data: plans, error } = await supabase
    .from("student_plan")
    .select("*")
    .eq("plan_group_id", planGroupId)
    .order("plan_date", { ascending: true });

  if (error) {
    logActionError(
      { domain: "plan", action: "analyzeGroupSchedule" },
      error,
      { planGroupId }
    );
    throw error;
  }

  const planList = (plans || []) as unknown as Plan[];

  // 패턴 분석
  const patterns = analyzeLearningPatterns(planList);

  // 권장사항 생성
  const recommendations = generateRecommendations(patterns);

  return {
    patterns,
    recommendations,
    analyzedAt: new Date().toISOString(),
  };
}
