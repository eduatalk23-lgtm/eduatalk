/**
 * 피로도 모델링 서비스
 *
 * 학생의 연속 학습일과 학습 강도를 분석하여 피로도를 측정하고
 * 자동 휴식일을 제안합니다.
 *
 * @module lib/domains/plan/services/fatigueModelingService
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// 상수 정의
// ============================================

/** 기본 분석 기간 (일) */
const DEFAULT_ANALYSIS_DAYS = 14;

/** 일일 목표 학습 시간 (분) */
const TARGET_DAILY_MINUTES = 180; // 3시간

/** 피로도 가중치 */
const FATIGUE_WEIGHTS = {
  consecutiveDays: 0.4, // 연속 학습일 가중치
  intensity: 0.35, // 학습 강도 가중치
  trend: 0.25, // 학습량 변화 추이 가중치
};

/** 피로도 점수 임계값 */
const FATIGUE_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 50,
  HIGH: 70,
  OVERLOAD: 85,
};

/** 연속 학습일 기반 휴식 권장 */
const REST_RECOMMENDATION_RULES = {
  DAYS_FOR_IMMEDIATE_REST: 7, // 7일 연속 시 즉시 휴식
  DAYS_FOR_EXTENDED_REST: 14, // 14일 연속 시 2일 휴식
  FATIGUE_IMMEDIATE_REST: 80, // 피로도 80 이상 시 즉시 휴식
  FATIGUE_SOON_REST: 60, // 피로도 60 이상 시 3일 내 휴식
};

// ============================================
// 타입 정의
// ============================================

/**
 * 피로도 강도 레벨
 */
export type IntensityLevel = "low" | "medium" | "high" | "overload";

/**
 * 피로도 메트릭
 */
export type FatigueMetrics = {
  /** 연속 학습일 */
  consecutiveDays: number;
  /** 일평균 학습 시간 (분) */
  averageDailyMinutes: number;
  /** 피로도 점수 (0-100) */
  fatigueScore: number;
  /** 강도 레벨 */
  intensityLevel: IntensityLevel;
  /** 권장 휴식일 수 */
  recommendedRestDays: number;
  /** 학습 강도 조절 비율 (0.5-1.5) */
  suggestedIntensityAdjustment: number;
  /** 분석에 사용된 학습일 수 */
  analyzedDays: number;
  /** 이번 주 vs 지난 주 학습량 변화율 */
  weeklyTrendPercent: number;
};

/**
 * 피로도 분석 입력
 */
export type FatigueAnalysisInput = {
  studentId: string;
  /** 분석 기간 (일), 기본 14일 */
  daysToAnalyze?: number;
};

/**
 * 휴식일 제안
 */
export type RestDaySuggestion = {
  date: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

/**
 * 피로도 분석 결과
 */
export type FatigueAnalysisResult = {
  success: boolean;
  data?: FatigueMetrics;
  error?: string;
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 연속 학습일 팩터 계산 (0-100)
 * 10일 이상이면 최대 100
 */
function calculateConsecutiveDaysFactor(consecutiveDays: number): number {
  return Math.min(100, consecutiveDays * 10);
}

/**
 * 학습 강도 팩터 계산 (0-100)
 * 목표 대비 실제 학습 시간 비율
 */
function calculateIntensityFactor(
  avgDailyMinutes: number,
  targetMinutes: number = TARGET_DAILY_MINUTES
): number {
  const ratio = avgDailyMinutes / targetMinutes;
  // 1.0 = 50점, 2.0 = 100점, 0.5 = 25점
  return Math.min(100, ratio * 50);
}

/**
 * 주간 변화 추이 팩터 계산 (0-100)
 * 학습량 증가 시 피로도 가중
 */
function calculateTrendFactor(weeklyTrendPercent: number): number {
  // 20% 이상 증가 시 최대 50점 추가
  if (weeklyTrendPercent >= 20) {
    return 50;
  }
  // 증가율에 따라 선형 증가
  if (weeklyTrendPercent > 0) {
    return (weeklyTrendPercent / 20) * 50;
  }
  // 감소 시 피로도 감소 효과
  return Math.max(0, 25 + weeklyTrendPercent);
}

/**
 * 강도 레벨 결정
 */
function determineIntensityLevel(fatigueScore: number): IntensityLevel {
  if (fatigueScore >= FATIGUE_THRESHOLDS.OVERLOAD) return "overload";
  if (fatigueScore >= FATIGUE_THRESHOLDS.HIGH) return "high";
  if (fatigueScore >= FATIGUE_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

/**
 * 권장 휴식일 수 계산
 */
function calculateRecommendedRestDays(
  fatigueScore: number,
  consecutiveDays: number
): number {
  // 14일 이상 연속 학습 시 2일 휴식
  if (consecutiveDays >= REST_RECOMMENDATION_RULES.DAYS_FOR_EXTENDED_REST) {
    return 2;
  }

  // 7일 이상 연속 또는 피로도 80 이상 시 1일 휴식
  if (
    consecutiveDays >= REST_RECOMMENDATION_RULES.DAYS_FOR_IMMEDIATE_REST ||
    fatigueScore >= REST_RECOMMENDATION_RULES.FATIGUE_IMMEDIATE_REST
  ) {
    return 1;
  }

  // 피로도 60 이상 시 3일 내 1일 휴식 권장
  if (fatigueScore >= REST_RECOMMENDATION_RULES.FATIGUE_SOON_REST) {
    return 1;
  }

  return 0;
}

/**
 * 강도 조절 비율 계산 (0.5-1.5)
 */
function calculateIntensityAdjustment(fatigueScore: number): number {
  if (fatigueScore >= FATIGUE_THRESHOLDS.OVERLOAD) {
    return 0.5; // 50% 감소
  }
  if (fatigueScore >= FATIGUE_THRESHOLDS.HIGH) {
    return 0.7; // 30% 감소
  }
  if (fatigueScore >= FATIGUE_THRESHOLDS.MEDIUM) {
    return 0.85; // 15% 감소
  }
  if (fatigueScore <= FATIGUE_THRESHOLDS.LOW) {
    return 1.15; // 15% 증가 가능
  }
  return 1.0; // 현행 유지
}

/**
 * 날짜 문자열 생성 (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ============================================
// 메인 함수
// ============================================

/**
 * 피로도 점수 계산
 *
 * 학생의 최근 학습 패턴을 분석하여 피로도 메트릭을 반환합니다.
 *
 * @param input - 분석 입력 (studentId, daysToAnalyze)
 * @returns 피로도 분석 결과
 */
export async function calculateFatigueScore(
  input: FatigueAnalysisInput
): Promise<FatigueAnalysisResult> {
  const { studentId, daysToAnalyze = DEFAULT_ANALYSIS_DAYS } = input;

  try {
    const supabase = await createSupabaseServerClient();

    // 분석 기간 설정
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysToAnalyze);

    // 학습 세션 조회
    const { data: sessions, error: sessionsError } = await supabase
      .from("student_study_sessions")
      .select("started_at, duration_seconds, paused_duration_seconds")
      .eq("student_id", studentId)
      .gte("started_at", formatDate(startDate))
      .lte("started_at", formatDate(endDate))
      .order("started_at", { ascending: true });

    if (sessionsError) {
      throw new Error(`세션 조회 실패: ${sessionsError.message}`);
    }

    // 날짜별 학습 시간 집계
    const dailyMinutes: Map<string, number> = new Map();
    for (const session of sessions || []) {
      const date = session.started_at.split("T")[0];
      const effectiveSeconds =
        (session.duration_seconds || 0) -
        (session.paused_duration_seconds || 0);
      const minutes = effectiveSeconds / 60;

      dailyMinutes.set(date, (dailyMinutes.get(date) || 0) + minutes);
    }

    // 연속 학습일 계산 (오늘부터 거슬러 올라가며)
    let consecutiveDays = 0;
    const today = new Date();
    for (let i = 0; i < daysToAnalyze; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = formatDate(checkDate);

      if (dailyMinutes.has(dateStr) && (dailyMinutes.get(dateStr) || 0) > 0) {
        consecutiveDays++;
      } else {
        break; // 학습하지 않은 날을 만나면 중단
      }
    }

    // 일평균 학습 시간 계산
    const totalMinutes = Array.from(dailyMinutes.values()).reduce(
      (sum, mins) => sum + mins,
      0
    );
    const studyDays = dailyMinutes.size || 1;
    const averageDailyMinutes = totalMinutes / studyDays;

    // 주간 학습량 변화율 계산
    const thisWeekStart = new Date();
    thisWeekStart.setDate(today.getDate() - 7);
    const lastWeekStart = new Date();
    lastWeekStart.setDate(today.getDate() - 14);

    let thisWeekMinutes = 0;
    let lastWeekMinutes = 0;

    for (const [dateStr, minutes] of dailyMinutes) {
      const date = new Date(dateStr);
      if (date >= thisWeekStart) {
        thisWeekMinutes += minutes;
      } else if (date >= lastWeekStart) {
        lastWeekMinutes += minutes;
      }
    }

    const weeklyTrendPercent =
      lastWeekMinutes > 0
        ? ((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100
        : 0;

    // 피로도 점수 계산
    const consecutiveDaysFactor =
      calculateConsecutiveDaysFactor(consecutiveDays);
    const intensityFactor = calculateIntensityFactor(averageDailyMinutes);
    const trendFactor = calculateTrendFactor(weeklyTrendPercent);

    const fatigueScore = Math.min(
      100,
      Math.round(
        consecutiveDaysFactor * FATIGUE_WEIGHTS.consecutiveDays +
          intensityFactor * FATIGUE_WEIGHTS.intensity +
          trendFactor * FATIGUE_WEIGHTS.trend
      )
    );

    // 결과 구성
    const metrics: FatigueMetrics = {
      consecutiveDays,
      averageDailyMinutes: Math.round(averageDailyMinutes),
      fatigueScore,
      intensityLevel: determineIntensityLevel(fatigueScore),
      recommendedRestDays: calculateRecommendedRestDays(
        fatigueScore,
        consecutiveDays
      ),
      suggestedIntensityAdjustment:
        calculateIntensityAdjustment(fatigueScore),
      analyzedDays: studyDays,
      weeklyTrendPercent: Math.round(weeklyTrendPercent),
    };

    return {
      success: true,
      data: metrics,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "plan", action: "calculateFatigueScore" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 휴식일 자동 제안
 *
 * 피로도 메트릭과 계획된 날짜를 기반으로 휴식일을 제안합니다.
 *
 * @param fatigueMetrics - 피로도 메트릭
 * @param plannedDates - 계획된 학습 날짜 배열 (YYYY-MM-DD)
 * @returns 제안된 휴식일 배열
 */
export function suggestRestDays(
  fatigueMetrics: FatigueMetrics,
  plannedDates: string[]
): RestDaySuggestion[] {
  const suggestions: RestDaySuggestion[] = [];

  if (plannedDates.length === 0) {
    return suggestions;
  }

  const { fatigueScore, consecutiveDays, recommendedRestDays } = fatigueMetrics;

  // 휴식이 필요 없는 경우
  if (recommendedRestDays === 0) {
    return suggestions;
  }

  // 날짜 정렬
  const sortedDates = [...plannedDates].sort();

  // 휴식일 제안 위치 결정
  if (fatigueScore >= REST_RECOMMENDATION_RULES.FATIGUE_IMMEDIATE_REST) {
    // 즉시 휴식 필요: 첫 번째 날
    if (sortedDates[0]) {
      suggestions.push({
        date: sortedDates[0],
        reason: `피로도 ${fatigueScore}점으로 즉시 휴식이 필요합니다.`,
        priority: "high",
      });
    }
  } else if (fatigueScore >= REST_RECOMMENDATION_RULES.FATIGUE_SOON_REST) {
    // 3일 내 휴식 필요: 3일차 또는 마지막 날 중 빠른 쪽
    const restIndex = Math.min(2, sortedDates.length - 1);
    if (sortedDates[restIndex]) {
      suggestions.push({
        date: sortedDates[restIndex],
        reason: `피로도 ${fatigueScore}점으로 3일 내 휴식을 권장합니다.`,
        priority: "medium",
      });
    }
  }

  // 연속 학습일 기반 추가 제안
  if (consecutiveDays >= REST_RECOMMENDATION_RULES.DAYS_FOR_EXTENDED_REST) {
    // 14일 이상 연속: 추가 휴식일 제안
    const restIndex = Math.min(6, sortedDates.length - 1);
    if (
      sortedDates[restIndex] &&
      !suggestions.some((s) => s.date === sortedDates[restIndex])
    ) {
      suggestions.push({
        date: sortedDates[restIndex],
        reason: `${consecutiveDays}일 연속 학습으로 추가 휴식이 필요합니다.`,
        priority: "medium",
      });
    }
  } else if (
    consecutiveDays >= REST_RECOMMENDATION_RULES.DAYS_FOR_IMMEDIATE_REST
  ) {
    // 7일 이상 연속: 주 1회 휴식 제안
    const weeklyRestIndices = [6, 13].filter((i) => i < sortedDates.length);
    for (const idx of weeklyRestIndices) {
      if (!suggestions.some((s) => s.date === sortedDates[idx])) {
        suggestions.push({
          date: sortedDates[idx],
          reason: "주 1회 휴식으로 학습 효율을 유지하세요.",
          priority: "low",
        });
      }
    }
  }

  return suggestions;
}

/**
 * 학습 강도 조정
 *
 * 피로도를 기반으로 학습량을 조정합니다.
 *
 * @param baseMinutes - 기본 학습 시간 (분)
 * @param fatigueMetrics - 피로도 메트릭
 * @returns 조정된 학습 시간 (분)
 */
export function adjustLearningIntensity(
  baseMinutes: number,
  fatigueMetrics: FatigueMetrics
): number {
  return Math.round(baseMinutes * fatigueMetrics.suggestedIntensityAdjustment);
}

/**
 * 피로도 경고 메시지 생성
 *
 * 코칭 엔진에서 사용할 피로도 관련 경고 메시지를 생성합니다.
 *
 * @param fatigueMetrics - 피로도 메트릭
 * @returns 경고 메시지 배열
 */
export function generateFatigueWarnings(
  fatigueMetrics: FatigueMetrics
): string[] {
  const warnings: string[] = [];
  const { fatigueScore, consecutiveDays, intensityLevel, averageDailyMinutes } =
    fatigueMetrics;

  if (intensityLevel === "overload") {
    warnings.push(
      `피로도가 매우 높습니다 (${fatigueScore}점). 즉시 휴식을 취하세요.`
    );
  } else if (intensityLevel === "high") {
    warnings.push(
      `피로도가 높은 편입니다 (${fatigueScore}점). 학습량을 조절해보세요.`
    );
  }

  if (consecutiveDays >= 14) {
    warnings.push(
      `${consecutiveDays}일 연속 학습 중입니다. 충분한 휴식이 필요합니다.`
    );
  } else if (consecutiveDays >= 7) {
    warnings.push(
      `${consecutiveDays}일 연속 학습 중입니다. 휴식일을 계획해보세요.`
    );
  }

  if (averageDailyMinutes > TARGET_DAILY_MINUTES * 1.5) {
    warnings.push(
      `일평균 ${Math.round(averageDailyMinutes)}분으로 학습량이 많습니다. 과도한 학습은 효율을 떨어뜨릴 수 있습니다.`
    );
  }

  return warnings;
}
