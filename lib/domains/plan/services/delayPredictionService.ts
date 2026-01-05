/**
 * 지연 예측 서비스
 *
 * 학생의 학습 패턴을 분석하여 플랜 지연을 예측하고 선제적 조치를 제안합니다.
 *
 * @module lib/domains/plan/services/delayPredictionService
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// 상수 정의
// ============================================

/** 분석 기간 (일) */
const DEFAULT_ANALYSIS_DAYS = 14;

/** 예측 기간 (일) */
const DEFAULT_PREDICTION_DAYS = 7;

/** 리스크 임계값 */
const RISK_THRESHOLDS = {
  HIGH: 0.7,
  MEDIUM: 0.4,
  LOW: 0.2,
};

/** 연속 미완료 임계값 */
const CONSECUTIVE_INCOMPLETE_THRESHOLD = 3;

/** 요일 취약점 임계값 */
const WEAK_DAY_THRESHOLD = 50; // 완료율 50% 미만

// ============================================
// 타입 정의
// ============================================

/**
 * 리스크 레벨
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * 선제적 조치 타입
 */
export type ActionType = "reschedule" | "reduce_load" | "split" | "alert" | "rest_day";

/**
 * 선제적 조치
 */
export type SuggestedAction = {
  type: ActionType;
  description: string;
  priority: "high" | "medium" | "low";
};

/**
 * 지연 예측 결과
 */
export type DelayPrediction = {
  planId: string;
  planDate: string;
  subjectType: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  predictedDelayDays: number;
  confidence: number;
  riskFactors: string[];
  suggestedActions: SuggestedAction[];
};

/**
 * 학생 패턴 분석 결과
 */
export type StudentPatternAnalysis = {
  studentId: string;
  weeklyCompletionRate: number;
  weakDays: string[];
  weakSubjects: string[];
  consecutiveIncompleteStreak: number;
  recentTrend: "improving" | "stable" | "declining";
  averageDelayDays: number;
};

/**
 * 서비스 결과
 */
export type DelayPredictionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// 헬퍼 함수
// ============================================

/** 요일 이름 매핑 */
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 리스크 레벨 결정
 */
function determineRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= RISK_THRESHOLDS.HIGH) return "high";
  if (riskScore >= RISK_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

/**
 * 예상 지연일 계산
 */
function calculateDelayDays(riskScore: number): number {
  if (riskScore >= RISK_THRESHOLDS.HIGH) return 3;
  if (riskScore >= RISK_THRESHOLDS.MEDIUM) return 1;
  return 0;
}

/**
 * 신뢰도 계산 (데이터 포인트 기반)
 */
function calculateConfidence(dataPoints: number): number {
  if (dataPoints >= 30) return 0.9;
  if (dataPoints >= 20) return 0.8;
  if (dataPoints >= 10) return 0.7;
  if (dataPoints >= 5) return 0.6;
  return 0.5;
}

/**
 * 선제적 조치 생성
 */
function generateActions(
  riskLevel: RiskLevel,
  riskFactors: string[]
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  if (riskLevel === "high") {
    actions.push({
      type: "reschedule",
      description: "지연 위험이 높습니다. 다른 날짜로 재조정을 고려하세요.",
      priority: "high",
    });

    if (riskFactors.includes("consecutive_incomplete")) {
      actions.push({
        type: "rest_day",
        description: "연속 미완료가 감지되었습니다. 휴식일을 추가하세요.",
        priority: "high",
      });
    }
  }

  if (riskLevel === "medium" || riskLevel === "high") {
    if (riskFactors.includes("overload")) {
      actions.push({
        type: "reduce_load",
        description: "학습량이 많습니다. 일부 플랜을 다른 날로 분산하세요.",
        priority: "medium",
      });
    }

    if (riskFactors.includes("weak_subject")) {
      actions.push({
        type: "split",
        description: "취약 과목입니다. 학습 시간을 나누어 진행하세요.",
        priority: "medium",
      });
    }
  }

  if (actions.length === 0 && riskLevel !== "low") {
    actions.push({
      type: "alert",
      description: "플랜 진행 상황을 주의깊게 모니터링하세요.",
      priority: "low",
    });
  }

  return actions;
}

// ============================================
// 메인 함수
// ============================================

/**
 * 학생 패턴 분석
 *
 * 학생의 최근 학습 패턴을 분석합니다.
 *
 * @param studentId - 학생 ID
 * @param daysBack - 분석 기간
 * @returns 패턴 분석 결과
 */
export async function analyzeStudentPattern(
  studentId: string,
  daysBack: number = DEFAULT_ANALYSIS_DAYS
): Promise<DelayPredictionResult<StudentPatternAnalysis>> {
  try {
    const supabase = await createSupabaseServerClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        plan_date,
        subject_type,
        simple_completed,
        progress
      `
      )
      .eq("student_id", studentId)
      .gte("plan_date", startDate.toISOString().split("T")[0])
      .order("plan_date", { ascending: true });

    if (plansError) {
      throw new Error(`플랜 조회 실패: ${plansError.message}`);
    }

    const allPlans = plans || [];

    // 요일별 완료율 분석
    const dayOfWeekStats: Map<number, { total: number; completed: number }> =
      new Map();
    for (let i = 0; i < 7; i++) {
      dayOfWeekStats.set(i, { total: 0, completed: 0 });
    }

    // 과목별 완료율 분석
    const subjectStats: Map<string, { total: number; completed: number }> =
      new Map();

    // 연속 미완료 추적
    let currentStreak = 0;
    let maxStreak = 0;

    // 최근 트렌드 분석
    const recentPlans = allPlans.slice(-10);
    const olderPlans = allPlans.slice(0, -10);

    for (const plan of allPlans) {
      const date = new Date(plan.plan_date);
      const dayOfWeek = date.getDay();
      const subject = plan.subject_type || "unknown";
      const isCompleted = plan.simple_completed === true;

      // 요일별 집계
      const dayStats = dayOfWeekStats.get(dayOfWeek)!;
      dayStats.total++;
      if (isCompleted) dayStats.completed++;

      // 과목별 집계
      if (!subjectStats.has(subject)) {
        subjectStats.set(subject, { total: 0, completed: 0 });
      }
      const subStats = subjectStats.get(subject)!;
      subStats.total++;
      if (isCompleted) subStats.completed++;

      // 연속 미완료 추적
      if (!isCompleted) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // 취약 요일 찾기
    const weakDays: string[] = [];
    for (const [day, stats] of dayOfWeekStats) {
      if (stats.total >= 2) {
        const rate = (stats.completed / stats.total) * 100;
        if (rate < WEAK_DAY_THRESHOLD) {
          weakDays.push(DAY_NAMES[day]);
        }
      }
    }

    // 취약 과목 찾기
    const weakSubjects: string[] = [];
    for (const [subject, stats] of subjectStats) {
      if (stats.total >= 3) {
        const rate = (stats.completed / stats.total) * 100;
        if (rate < WEAK_DAY_THRESHOLD) {
          weakSubjects.push(subject);
        }
      }
    }

    // 주간 완료율 계산
    const totalPlans = allPlans.length;
    const completedPlans = allPlans.filter((p) => p.simple_completed === true).length;
    const weeklyCompletionRate =
      totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

    // 최근 트렌드 분석
    let recentTrend: "improving" | "stable" | "declining" = "stable";
    if (recentPlans.length >= 5 && olderPlans.length >= 5) {
      const recentRate =
        recentPlans.filter((p) => p.simple_completed).length / recentPlans.length;
      const olderRate =
        olderPlans.filter((p) => p.simple_completed).length / olderPlans.length;
      const diff = recentRate - olderRate;

      if (diff > 0.15) recentTrend = "improving";
      else if (diff < -0.15) recentTrend = "declining";
    }

    return {
      success: true,
      data: {
        studentId,
        weeklyCompletionRate,
        weakDays,
        weakSubjects,
        consecutiveIncompleteStreak: currentStreak, // 현재 진행 중인 연속 미완료
        recentTrend,
        averageDelayDays: 0, // TODO: 실제 지연일 추적 필요
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "plan", action: "analyzeStudentPattern" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 플랜 지연 예측
 *
 * 예정된 플랜의 지연 가능성을 예측합니다.
 *
 * @param studentId - 학생 ID
 * @param daysAhead - 예측 기간 (일)
 * @returns 지연 예측 배열
 */
export async function predictPlanDelays(
  studentId: string,
  daysAhead: number = DEFAULT_PREDICTION_DAYS
): Promise<DelayPredictionResult<DelayPrediction[]>> {
  try {
    // 먼저 패턴 분석
    const patternResult = await analyzeStudentPattern(studentId);
    if (!patternResult.success || !patternResult.data) {
      return {
        success: false,
        error: patternResult.error || "패턴 분석 실패",
      };
    }

    const pattern = patternResult.data;
    const supabase = await createSupabaseServerClient();

    // 예정된 플랜 조회
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + daysAhead);

    const { data: upcomingPlans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        plan_date,
        subject_type,
        estimated_duration
      `
      )
      .eq("student_id", studentId)
      .eq("simple_completed", false)
      .gte("plan_date", today.toISOString().split("T")[0])
      .lte("plan_date", endDate.toISOString().split("T")[0])
      .order("plan_date", { ascending: true });

    if (plansError) {
      throw new Error(`예정 플랜 조회 실패: ${plansError.message}`);
    }

    const predictions: DelayPrediction[] = [];

    for (const plan of upcomingPlans || []) {
      const riskFactors: string[] = [];
      let riskScore = 0;

      // 요일별 리스크
      const planDate = new Date(plan.plan_date);
      const dayOfWeek = planDate.getDay();
      const dayName = DAY_NAMES[dayOfWeek];

      if (pattern.weakDays.includes(dayName)) {
        riskScore += 0.3;
        riskFactors.push("weak_day");
      }

      // 과목별 리스크
      const subject = plan.subject_type || "unknown";
      if (pattern.weakSubjects.includes(subject)) {
        riskScore += 0.3;
        riskFactors.push("weak_subject");
      }

      // 연속 미완료 리스크
      if (pattern.consecutiveIncompleteStreak >= CONSECUTIVE_INCOMPLETE_THRESHOLD) {
        riskScore += 0.4;
        riskFactors.push("consecutive_incomplete");
      }

      // 트렌드 리스크
      if (pattern.recentTrend === "declining") {
        riskScore += 0.2;
        riskFactors.push("declining_trend");
      }

      // 전체 완료율 리스크
      if (pattern.weeklyCompletionRate < 50) {
        riskScore += 0.2;
        riskFactors.push("low_completion_rate");
      }

      // 리스크 점수 정규화 (최대 1.0)
      riskScore = Math.min(1.0, riskScore);

      const riskLevel = determineRiskLevel(riskScore);
      const suggestedActions = generateActions(riskLevel, riskFactors);

      predictions.push({
        planId: plan.id,
        planDate: plan.plan_date,
        subjectType: plan.subject_type,
        riskLevel,
        riskScore: Math.round(riskScore * 100) / 100,
        predictedDelayDays: calculateDelayDays(riskScore),
        confidence: calculateConfidence(pattern.weeklyCompletionRate > 0 ? 20 : 5),
        riskFactors,
        suggestedActions,
      });
    }

    return {
      success: true,
      data: predictions,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "plan", action: "predictPlanDelays" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 고위험 플랜 조회
 *
 * 지연 위험이 높은 플랜만 필터링합니다.
 *
 * @param studentId - 학생 ID
 * @param daysAhead - 예측 기간
 * @returns 고위험 플랜 배열
 */
export async function getHighRiskPlans(
  studentId: string,
  daysAhead: number = DEFAULT_PREDICTION_DAYS
): Promise<DelayPredictionResult<DelayPrediction[]>> {
  const result = await predictPlanDelays(studentId, daysAhead);

  if (!result.success || !result.data) {
    return result;
  }

  const highRiskPlans = result.data.filter(
    (p) => p.riskLevel === "high" || p.riskLevel === "medium"
  );

  return {
    success: true,
    data: highRiskPlans,
  };
}
