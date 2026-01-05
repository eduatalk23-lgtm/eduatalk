/**
 * 학습 데이터 기반 추천 가중치 서비스
 *
 * 학생의 실제 학습 이력을 분석하여 슬롯 추천에 사용할 가중치를 계산합니다.
 *
 * @module lib/domains/plan/services/learningWeightService
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// 상수 정의
// ============================================

/** 분석 기간 (일) */
const DEFAULT_ANALYSIS_DAYS = 30;

/** 캐시 TTL (밀리초) - 7일 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 최소 데이터 포인트 */
const MIN_DATA_POINTS = 5;

/** 기본 가중치 */
const DEFAULT_WEIGHT = 1.0;

/** 요일 매핑 */
const DAY_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

// ============================================
// 타입 정의
// ============================================

/**
 * 과목별 가중치
 */
export type SubjectWeight = {
  subjectType: string;
  weight: number;
  completionRate: number;
  avgDuration: number;
  dataPoints: number;
};

/**
 * 시간 슬롯 가중치
 */
export type TimeSlotWeight = {
  hour: number;
  dayOfWeek: (typeof DAY_OF_WEEK)[number];
  weight: number;
  completionRate: number;
  dataPoints: number;
};

/**
 * 학습 가중치 결과
 */
export type LearningWeightResult = {
  studentId: string;
  subjectWeights: SubjectWeight[];
  timeSlotWeights: TimeSlotWeight[];
  dayOfWeekWeights: Record<(typeof DAY_OF_WEEK)[number], number>;
  overallEfficiency: number;
  recommendedWorkload: number;
  analyzedPlansCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
  cachedAt?: string;
};

/**
 * 서비스 결과
 */
export type WeightServiceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 가중치 정규화 (0.5-1.5 범위)
 */
function normalizeWeight(value: number, avg: number): number {
  if (avg === 0) return DEFAULT_WEIGHT;
  const ratio = value / avg;
  return Math.max(0.5, Math.min(1.5, ratio));
}

/**
 * 효율성 점수 계산 (완료율 * 속도 보정)
 */
function calculateEfficiency(completionRate: number, timeRatio: number): number {
  // 완료율이 높고, 시간 효율이 좋을수록 높은 점수
  const timeScore = timeRatio <= 1 ? 1 + (1 - timeRatio) * 0.5 : 1 - (timeRatio - 1) * 0.3;
  return (completionRate / 100) * Math.max(0.3, timeScore);
}

/**
 * 권장 학습량 계산
 */
function calculateRecommendedWorkload(
  avgCompletedMinutes: number,
  completionRate: number
): number {
  // 완료율이 높으면 학습량 증가, 낮으면 감소
  const adjustmentFactor = completionRate >= 80 ? 1.1 : completionRate >= 60 ? 1.0 : 0.9;
  return Math.round(avgCompletedMinutes * adjustmentFactor);
}

// ============================================
// 메인 함수
// ============================================

/**
 * 학습 가중치 계산
 *
 * 학생의 학습 이력을 분석하여 가중치를 계산합니다.
 *
 * @param studentId - 학생 ID
 * @param daysBack - 분석 기간 (일)
 * @returns 학습 가중치 결과
 */
export async function calculateLearningWeights(
  studentId: string,
  daysBack: number = DEFAULT_ANALYSIS_DAYS
): Promise<WeightServiceResult<LearningWeightResult>> {
  try {
    const supabase = await createSupabaseServerClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);

    // 완료된 플랜 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        plan_date,
        start_time,
        estimated_duration,
        subject_type,
        progress,
        simple_completed,
        study_session:student_study_sessions!plan_id(
          duration_seconds,
          paused_duration_seconds
        )
      `
      )
      .eq("student_id", studentId)
      .gte("plan_date", startDate.toISOString().split("T")[0])
      .lte("plan_date", endDate.toISOString().split("T")[0])
      .order("plan_date", { ascending: true });

    if (plansError) {
      throw new Error(`플랜 조회 실패: ${plansError.message}`);
    }

    const allPlans = plans || [];

    // 데이터 부족 시 기본값 반환
    if (allPlans.length < MIN_DATA_POINTS) {
      return {
        success: true,
        data: {
          studentId,
          subjectWeights: [],
          timeSlotWeights: [],
          dayOfWeekWeights: {
            sunday: 1.0,
            monday: 1.0,
            tuesday: 1.0,
            wednesday: 1.0,
            thursday: 1.0,
            friday: 1.0,
            saturday: 1.0,
          },
          overallEfficiency: 1.0,
          recommendedWorkload: 180, // 기본 3시간
          analyzedPlansCount: allPlans.length,
          period: {
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
          },
        },
      };
    }

    // 과목별 데이터 집계
    const subjectData: Map<
      string,
      { completionRates: number[]; durations: number[] }
    > = new Map();

    // 시간대별 데이터 집계
    const timeSlotData: Map<
      string,
      { completionRates: number[]; dayOfWeek: (typeof DAY_OF_WEEK)[number] }
    > = new Map();

    // 요일별 데이터 집계
    const dayOfWeekData: Map<(typeof DAY_OF_WEEK)[number], number[]> = new Map();
    for (const day of DAY_OF_WEEK) {
      dayOfWeekData.set(day, []);
    }

    let totalCompletedMinutes = 0;
    let totalCompletionRate = 0;
    let completedCount = 0;

    for (const plan of allPlans) {
      const sessions = plan.study_session || [];
      const totalActualSeconds = sessions.reduce(
        (sum: number, s: { duration_seconds?: number; paused_duration_seconds?: number }) =>
          sum + ((s.duration_seconds || 0) - (s.paused_duration_seconds || 0)),
        0
      );
      const actualMinutes = totalActualSeconds / 60;
      const estimatedMinutes = plan.estimated_duration || 60;
      const progress = plan.progress || 0;
      const isCompleted = plan.simple_completed === true;

      if (isCompleted) {
        completedCount++;
        totalCompletedMinutes += actualMinutes;
        totalCompletionRate += progress;
      }

      // 과목별 집계
      const subject = plan.subject_type || "unknown";
      if (!subjectData.has(subject)) {
        subjectData.set(subject, { completionRates: [], durations: [] });
      }
      subjectData.get(subject)!.completionRates.push(progress);
      subjectData.get(subject)!.durations.push(actualMinutes);

      // 시간대별 집계
      if (plan.start_time && plan.plan_date) {
        const hour = parseInt(plan.start_time.split(":")[0], 10);
        const date = new Date(plan.plan_date);
        const dayOfWeek = DAY_OF_WEEK[date.getDay()];
        const key = `${hour}-${dayOfWeek}`;

        if (!timeSlotData.has(key)) {
          timeSlotData.set(key, { completionRates: [], dayOfWeek });
        }
        timeSlotData.get(key)!.completionRates.push(progress);

        // 요일별 집계
        dayOfWeekData.get(dayOfWeek)!.push(progress);
      }
    }

    // 전체 평균 계산
    const avgCompletionRate = completedCount > 0 ? totalCompletionRate / completedCount : 0;
    const avgCompletedMinutes = completedCount > 0 ? totalCompletedMinutes / completedCount : 60;

    // 과목별 가중치 계산
    const subjectWeights: SubjectWeight[] = [];
    for (const [subject, data] of subjectData) {
      const avgSubjectCompletion =
        data.completionRates.reduce((a, b) => a + b, 0) / data.completionRates.length;
      const avgDuration =
        data.durations.reduce((a, b) => a + b, 0) / data.durations.length;

      subjectWeights.push({
        subjectType: subject,
        weight: normalizeWeight(avgSubjectCompletion, avgCompletionRate),
        completionRate: Math.round(avgSubjectCompletion * 10) / 10,
        avgDuration: Math.round(avgDuration),
        dataPoints: data.completionRates.length,
      });
    }

    // 시간 슬롯 가중치 계산
    const timeSlotWeights: TimeSlotWeight[] = [];
    for (const [key, data] of timeSlotData) {
      const [hourStr, dayOfWeek] = key.split("-");
      const hour = parseInt(hourStr, 10);
      const avgCompletion =
        data.completionRates.reduce((a, b) => a + b, 0) / data.completionRates.length;

      timeSlotWeights.push({
        hour,
        dayOfWeek: dayOfWeek as (typeof DAY_OF_WEEK)[number],
        weight: normalizeWeight(avgCompletion, avgCompletionRate),
        completionRate: Math.round(avgCompletion * 10) / 10,
        dataPoints: data.completionRates.length,
      });
    }

    // 요일별 가중치 계산
    const dayOfWeekWeights: Record<(typeof DAY_OF_WEEK)[number], number> = {} as Record<
      (typeof DAY_OF_WEEK)[number],
      number
    >;
    for (const [day, completionRates] of dayOfWeekData) {
      if (completionRates.length > 0) {
        const avgDayCompletion =
          completionRates.reduce((a, b) => a + b, 0) / completionRates.length;
        dayOfWeekWeights[day] = normalizeWeight(avgDayCompletion, avgCompletionRate);
      } else {
        dayOfWeekWeights[day] = DEFAULT_WEIGHT;
      }
    }

    // 전체 효율성 계산
    const overallEfficiency =
      completedCount > 0 ? Math.round((avgCompletionRate / 100) * 100) / 100 : 1.0;

    return {
      success: true,
      data: {
        studentId,
        subjectWeights,
        timeSlotWeights,
        dayOfWeekWeights,
        overallEfficiency,
        recommendedWorkload: calculateRecommendedWorkload(avgCompletedMinutes, avgCompletionRate),
        analyzedPlansCount: allPlans.length,
        period: {
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
        },
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "plan", action: "calculateLearningWeights" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 특정 시간대의 가중치 조회
 *
 * @param weights - 학습 가중치 결과
 * @param hour - 시간 (0-23)
 * @param dayOfWeek - 요일
 * @returns 가중치 (기본값 1.0)
 */
export function getTimeSlotWeight(
  weights: LearningWeightResult,
  hour: number,
  dayOfWeek: (typeof DAY_OF_WEEK)[number]
): number {
  const slot = weights.timeSlotWeights.find(
    (s) => s.hour === hour && s.dayOfWeek === dayOfWeek
  );

  if (slot && slot.dataPoints >= 3) {
    return slot.weight;
  }

  // 시간대 데이터가 없으면 요일 가중치 반환
  return weights.dayOfWeekWeights[dayOfWeek] || DEFAULT_WEIGHT;
}

/**
 * 특정 과목의 가중치 조회
 *
 * @param weights - 학습 가중치 결과
 * @param subjectType - 과목 타입
 * @returns 가중치 (기본값 1.0)
 */
export function getSubjectWeight(
  weights: LearningWeightResult,
  subjectType: string
): number {
  const subject = weights.subjectWeights.find(
    (s) => s.subjectType === subjectType
  );

  if (subject && subject.dataPoints >= 3) {
    return subject.weight;
  }

  return DEFAULT_WEIGHT;
}

/**
 * 슬롯 추천에 가중치 적용
 *
 * @param baseScore - 기본 점수
 * @param weights - 학습 가중치 결과
 * @param options - 적용 옵션
 * @returns 가중치가 적용된 점수
 */
export function applyLearningWeights(
  baseScore: number,
  weights: LearningWeightResult,
  options: {
    hour?: number;
    dayOfWeek?: (typeof DAY_OF_WEEK)[number];
    subjectType?: string;
  }
): number {
  let adjustedScore = baseScore;

  // 시간대 가중치 적용
  if (options.hour !== undefined && options.dayOfWeek) {
    const timeWeight = getTimeSlotWeight(weights, options.hour, options.dayOfWeek);
    adjustedScore *= timeWeight;
  }

  // 과목 가중치 적용
  if (options.subjectType) {
    const subjectWeight = getSubjectWeight(weights, options.subjectType);
    adjustedScore *= subjectWeight;
  }

  return Math.round(adjustedScore * 100) / 100;
}
