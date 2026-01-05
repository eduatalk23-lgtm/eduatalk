/**
 * 학습 속도 예측 서비스
 *
 * EWMA (Exponential Weighted Moving Average) 기반으로 학생의 학습 속도를 예측합니다.
 * 과목별/시간대별 학습 효율을 분석하여 플랜 생성 시 활용합니다.
 *
 * @module lib/domains/plan/services/learningPacePredictor
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import type { FatigueMetrics } from "./fatigueModelingService";

// ============================================
// 상수 정의
// ============================================

/** EWMA 감쇠율 (최근 데이터에 더 많은 가중치) */
const EWMA_ALPHA = 0.3;

/** 분석에 필요한 최소 데이터 포인트 */
const MIN_DATA_POINTS = 5;

/** 기본 학습 속도 (분/콘텐츠 단위) */
const DEFAULT_VELOCITY = 1.0;

/** 시간대별 효율 기본값 */
const DEFAULT_TIME_PERIOD_EFFICIENCY: Record<string, number> = {
  morning: 1.1, // 06:00-12:00: 집중력 높음
  afternoon: 1.0, // 12:00-18:00: 보통
  evening: 0.9, // 18:00-22:00: 약간 떨어짐
  night: 0.8, // 22:00-06:00: 집중력 낮음
};

/** 신뢰도 임계값 */
const CONFIDENCE_THRESHOLDS = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
};

// ============================================
// 타입 정의
// ============================================

/**
 * 시간대
 */
export type TimePeriod = "morning" | "afternoon" | "evening" | "night";

/**
 * 신뢰도 수준
 */
export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * 과목별 학습 속도 데이터
 */
export type SubjectVelocityData = {
  subjectType: string;
  velocity: number;
  dataPoints: number;
  trend: "increasing" | "stable" | "decreasing";
};

/**
 * 시간대별 효율 데이터
 */
export type TimePeriodEfficiency = {
  period: TimePeriod;
  efficiency: number;
  avgCompletionRate: number;
  dataPoints: number;
};

/**
 * 학습 속도 예측 입력
 */
export type LearningPacePredictionInput = {
  studentId: string;
  subjectType?: string;
  targetDate?: string;
  targetTimePeriod?: TimePeriod;
  fatigueMetrics?: FatigueMetrics;
};

/**
 * 학습 속도 예측 결과
 */
export type PredictedLearningPace = {
  /** 기본 학습 속도 */
  baseVelocity: number;
  /** 과목별 조정 계수 */
  subjectAdjustment: number;
  /** 시간대별 조정 계수 */
  timePeriodAdjustment: number;
  /** 피로도 반영 조정 계수 */
  fatigueAdjustment: number;
  /** 최종 예측 속도 */
  finalPredictedVelocity: number;
  /** 예측 신뢰도 */
  confidenceLevel: ConfidenceLevel;
  /** 분석 데이터 수 */
  dataPointsAnalyzed: number;
};

/**
 * 학생 학습 프로필
 */
export type StudentLearningProfile = {
  studentId: string;
  overallVelocity: number;
  subjectVelocities: SubjectVelocityData[];
  timePeriodEfficiencies: TimePeriodEfficiency[];
  strongPeriods: TimePeriod[];
  weakPeriods: TimePeriod[];
  analyzedPlansCount: number;
  lastUpdated: string;
};

/**
 * 서비스 결과
 */
export type LearningPaceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 시간을 시간대로 변환
 */
function getTimePeriod(time: string): TimePeriod {
  const hour = parseInt(time.split(":")[0], 10);

  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

/**
 * EWMA 계산
 */
function calculateEWMA(values: number[], alpha: number = EWMA_ALPHA): number {
  if (values.length === 0) return DEFAULT_VELOCITY;

  let ewma = values[0];
  for (let i = 1; i < values.length; i++) {
    ewma = alpha * values[i] + (1 - alpha) * ewma;
  }

  return ewma;
}

/**
 * 트렌드 분석
 */
function analyzeTrend(
  values: number[]
): "increasing" | "stable" | "decreasing" {
  if (values.length < 3) return "stable";

  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = (secondAvg - firstAvg) / firstAvg;

  if (change > 0.1) return "increasing";
  if (change < -0.1) return "decreasing";
  return "stable";
}

/**
 * 신뢰도 결정
 */
function determineConfidence(dataPoints: number): ConfidenceLevel {
  if (dataPoints >= CONFIDENCE_THRESHOLDS.HIGH) return "high";
  if (dataPoints >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

/**
 * 학습 속도 계산 (실제 소요 시간 / 예상 소요 시간)
 */
function calculateVelocity(
  estimatedMinutes: number,
  actualMinutes: number
): number {
  if (actualMinutes <= 0) return DEFAULT_VELOCITY;
  return estimatedMinutes / actualMinutes;
}

// ============================================
// 메인 함수
// ============================================

/**
 * 학습 속도 예측
 *
 * EWMA 기반으로 학생의 학습 속도를 예측합니다.
 *
 * @param input - 예측 입력
 * @returns 예측된 학습 속도
 */
export async function predictLearningPace(
  input: LearningPacePredictionInput
): Promise<LearningPaceResult<PredictedLearningPace>> {
  const {
    studentId,
    subjectType,
    targetTimePeriod,
    fatigueMetrics,
  } = input;

  try {
    const supabase = await createSupabaseServerClient();

    // 최근 30일간의 완료된 플랜 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        start_time,
        estimated_duration,
        subject_type,
        simple_completed,
        completed_at,
        study_session:student_study_sessions!plan_id(
          duration_seconds,
          paused_duration_seconds
        )
      `
      )
      .eq("student_id", studentId)
      .eq("simple_completed", true)
      .gte("completed_at", thirtyDaysAgo.toISOString())
      .order("completed_at", { ascending: true });

    if (plansError) {
      throw new Error(`플랜 조회 실패: ${plansError.message}`);
    }

    const completedPlans = plans || [];
    const dataPoints = completedPlans.length;

    // 기본값 반환 (데이터 부족)
    if (dataPoints < MIN_DATA_POINTS) {
      return {
        success: true,
        data: {
          baseVelocity: DEFAULT_VELOCITY,
          subjectAdjustment: 1.0,
          timePeriodAdjustment: targetTimePeriod
            ? DEFAULT_TIME_PERIOD_EFFICIENCY[targetTimePeriod]
            : 1.0,
          fatigueAdjustment: fatigueMetrics?.suggestedIntensityAdjustment || 1.0,
          finalPredictedVelocity: DEFAULT_VELOCITY,
          confidenceLevel: "low",
          dataPointsAnalyzed: dataPoints,
        },
      };
    }

    // 전체 학습 속도 계산
    const velocities: number[] = [];
    const subjectVelocities: Map<string, number[]> = new Map();
    const periodVelocities: Map<TimePeriod, number[]> = new Map();

    for (const plan of completedPlans) {
      const sessions = plan.study_session || [];
      const totalActualSeconds = sessions.reduce(
        (sum: number, s: { duration_seconds?: number; paused_duration_seconds?: number }) =>
          sum +
          ((s.duration_seconds || 0) - (s.paused_duration_seconds || 0)),
        0
      );
      const actualMinutes = totalActualSeconds / 60;
      const estimatedMinutes = plan.estimated_duration || 60;

      if (actualMinutes > 0) {
        const velocity = calculateVelocity(estimatedMinutes, actualMinutes);
        velocities.push(velocity);

        // 과목별 집계
        const subject = plan.subject_type || "unknown";
        if (!subjectVelocities.has(subject)) {
          subjectVelocities.set(subject, []);
        }
        subjectVelocities.get(subject)!.push(velocity);

        // 시간대별 집계
        if (plan.start_time) {
          const period = getTimePeriod(plan.start_time);
          if (!periodVelocities.has(period)) {
            periodVelocities.set(period, []);
          }
          periodVelocities.get(period)!.push(velocity);
        }
      }
    }

    // EWMA 기반 기본 속도
    const baseVelocity = calculateEWMA(velocities);

    // 과목별 조정
    let subjectAdjustment = 1.0;
    if (subjectType && subjectVelocities.has(subjectType)) {
      const subjectVels = subjectVelocities.get(subjectType)!;
      const subjectEWMA = calculateEWMA(subjectVels);
      subjectAdjustment = subjectEWMA / baseVelocity;
    }

    // 시간대별 조정
    let timePeriodAdjustment =
      DEFAULT_TIME_PERIOD_EFFICIENCY[targetTimePeriod || "afternoon"];
    if (targetTimePeriod && periodVelocities.has(targetTimePeriod)) {
      const periodVels = periodVelocities.get(targetTimePeriod)!;
      if (periodVels.length >= 3) {
        const periodEWMA = calculateEWMA(periodVels);
        timePeriodAdjustment = periodEWMA / baseVelocity;
      }
    }

    // 피로도 조정
    const fatigueAdjustment =
      fatigueMetrics?.suggestedIntensityAdjustment || 1.0;

    // 최종 예측 속도
    const finalPredictedVelocity =
      baseVelocity * subjectAdjustment * timePeriodAdjustment * fatigueAdjustment;

    return {
      success: true,
      data: {
        baseVelocity: Math.round(baseVelocity * 100) / 100,
        subjectAdjustment: Math.round(subjectAdjustment * 100) / 100,
        timePeriodAdjustment: Math.round(timePeriodAdjustment * 100) / 100,
        fatigueAdjustment: Math.round(fatigueAdjustment * 100) / 100,
        finalPredictedVelocity: Math.round(finalPredictedVelocity * 100) / 100,
        confidenceLevel: determineConfidence(dataPoints),
        dataPointsAnalyzed: dataPoints,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "plan", action: "predictLearningPace" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 학생 학습 프로필 조회
 *
 * 학생의 전체적인 학습 패턴 프로필을 생성합니다.
 *
 * @param studentId - 학생 ID
 * @returns 학습 프로필
 */
export async function getStudentLearningProfile(
  studentId: string
): Promise<LearningPaceResult<StudentLearningProfile>> {
  try {
    const supabase = await createSupabaseServerClient();

    // 최근 60일간의 완료된 플랜 조회
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        start_time,
        estimated_duration,
        subject_type,
        simple_completed,
        completed_at,
        progress,
        study_session:student_study_sessions!plan_id(
          duration_seconds,
          paused_duration_seconds
        )
      `
      )
      .eq("student_id", studentId)
      .eq("simple_completed", true)
      .gte("completed_at", sixtyDaysAgo.toISOString())
      .order("completed_at", { ascending: true });

    if (plansError) {
      throw new Error(`프로필 조회 실패: ${plansError.message}`);
    }

    const completedPlans = plans || [];

    // 과목별 속도 분석
    const subjectData: Map<string, number[]> = new Map();
    const periodData: Map<TimePeriod, { velocities: number[]; completionRates: number[] }> =
      new Map();

    for (const plan of completedPlans) {
      const sessions = plan.study_session || [];
      const totalActualSeconds = sessions.reduce(
        (sum: number, s: { duration_seconds?: number; paused_duration_seconds?: number }) =>
          sum + ((s.duration_seconds || 0) - (s.paused_duration_seconds || 0)),
        0
      );
      const actualMinutes = totalActualSeconds / 60;
      const estimatedMinutes = plan.estimated_duration || 60;

      if (actualMinutes > 0) {
        const velocity = calculateVelocity(estimatedMinutes, actualMinutes);

        // 과목별
        const subject = plan.subject_type || "unknown";
        if (!subjectData.has(subject)) {
          subjectData.set(subject, []);
        }
        subjectData.get(subject)!.push(velocity);

        // 시간대별
        if (plan.start_time) {
          const period = getTimePeriod(plan.start_time);
          if (!periodData.has(period)) {
            periodData.set(period, { velocities: [], completionRates: [] });
          }
          periodData.get(period)!.velocities.push(velocity);
          periodData.get(period)!.completionRates.push(plan.progress || 100);
        }
      }
    }

    // 과목별 결과 생성
    const subjectVelocities: SubjectVelocityData[] = [];
    for (const [subject, velocities] of subjectData) {
      subjectVelocities.push({
        subjectType: subject,
        velocity: Math.round(calculateEWMA(velocities) * 100) / 100,
        dataPoints: velocities.length,
        trend: analyzeTrend(velocities),
      });
    }

    // 시간대별 결과 생성
    const timePeriodEfficiencies: TimePeriodEfficiency[] = [];
    const allPeriods: TimePeriod[] = ["morning", "afternoon", "evening", "night"];

    for (const period of allPeriods) {
      const data = periodData.get(period);
      if (data && data.velocities.length > 0) {
        timePeriodEfficiencies.push({
          period,
          efficiency: Math.round(calculateEWMA(data.velocities) * 100) / 100,
          avgCompletionRate:
            Math.round(
              (data.completionRates.reduce((a, b) => a + b, 0) /
                data.completionRates.length) *
                10
            ) / 10,
          dataPoints: data.velocities.length,
        });
      } else {
        timePeriodEfficiencies.push({
          period,
          efficiency: DEFAULT_TIME_PERIOD_EFFICIENCY[period],
          avgCompletionRate: 0,
          dataPoints: 0,
        });
      }
    }

    // 강점/약점 시간대 분석
    const sortedEfficiencies = [...timePeriodEfficiencies]
      .filter((e) => e.dataPoints >= 3)
      .sort((a, b) => b.efficiency - a.efficiency);

    const strongPeriods =
      sortedEfficiencies.length > 0 ? [sortedEfficiencies[0].period] : [];
    const weakPeriods =
      sortedEfficiencies.length > 1
        ? [sortedEfficiencies[sortedEfficiencies.length - 1].period]
        : [];

    // 전체 속도 계산
    const allVelocities = Array.from(subjectData.values()).flat();
    const overallVelocity =
      allVelocities.length > 0
        ? Math.round(calculateEWMA(allVelocities) * 100) / 100
        : DEFAULT_VELOCITY;

    return {
      success: true,
      data: {
        studentId,
        overallVelocity,
        subjectVelocities,
        timePeriodEfficiencies,
        strongPeriods,
        weakPeriods,
        analyzedPlansCount: completedPlans.length,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "plan", action: "getStudentLearningProfile" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 예상 학습 시간 조정
 *
 * 학습 속도 예측을 기반으로 예상 시간을 조정합니다.
 *
 * @param baseMinutes - 기본 예상 시간 (분)
 * @param predictedPace - 예측된 학습 속도
 * @returns 조정된 예상 시간 (분)
 */
export function adjustEstimatedDuration(
  baseMinutes: number,
  predictedPace: PredictedLearningPace
): number {
  // velocity > 1: 예상보다 빠름 → 시간 줄임
  // velocity < 1: 예상보다 느림 → 시간 늘림
  const adjustedMinutes = baseMinutes / predictedPace.finalPredictedVelocity;

  // 최소 15분, 최대 원래의 2배
  return Math.round(
    Math.max(15, Math.min(baseMinutes * 2, adjustedMinutes))
  );
}
