/**
 * 실시간 피드백 서비스
 *
 * 학습 완료 시 피드백을 수집하고 즉시 반영하여 개인화된 추천을 생성합니다.
 *
 * @module lib/domains/plan/services/realtimeFeedbackService
 */

import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// 타입 정의
// ============================================

/**
 * 학습 완료 피드백 입력
 */
export type CompletionFeedbackInput = {
  /** 플랜 ID */
  planId: string;
  /** 학생 ID */
  studentId: string;
  /** 과목 타입 */
  subjectType: string;
  /** 완료 날짜 */
  completedDate: string;
  /** 실제 소요 시간 (분) */
  actualDurationMinutes: number;
  /** 예상 소요 시간 (분) */
  expectedDurationMinutes: number;
  /** 만족도 (1-5) */
  satisfactionRating?: number;
  /** 난이도 피드백 */
  difficultyFeedback?: "too_easy" | "appropriate" | "too_hard";
  /** 피드백 태그 */
  feedbackTags?: string[];
};

/**
 * 피드백 분석 결과
 */
export type FeedbackAnalysis = {
  /** 효율성 점수 (실제 시간 / 예상 시간) */
  efficiencyScore: number;
  /** 효율성 등급 */
  efficiencyGrade: "excellent" | "good" | "average" | "poor";
  /** 난이도 적정 여부 */
  difficultyAppropriate: boolean;
  /** 권장 조치 */
  recommendations: FeedbackRecommendation[];
  /** 학습 가중치 조정 */
  weightAdjustments: WeightAdjustment[];
};

/**
 * 피드백 기반 권장사항
 */
export type FeedbackRecommendation = {
  type: "time_adjust" | "difficulty_adjust" | "schedule_shift" | "rest_suggest";
  message: string;
  priority: "low" | "medium" | "high";
  autoApplicable: boolean;
};

/**
 * 가중치 조정
 */
export type WeightAdjustment = {
  targetType: "subject" | "timeSlot" | "dayOfWeek";
  targetValue: string;
  currentWeight: number;
  suggestedWeight: number;
  reason: string;
};

/**
 * 실시간 추천 결과
 */
export type RealtimeRecommendation = {
  /** 다음 플랜 추천 시간대 */
  nextOptimalTimeSlot?: {
    dayOfWeek: string;
    hour: number;
    reason: string;
  };
  /** 휴식 권장 여부 */
  shouldRest: boolean;
  restReason?: string;
  /** 학습량 조정 권장 */
  workloadAdjustment?: {
    direction: "increase" | "decrease" | "maintain";
    percentage: number;
    reason: string;
  };
  /** 난이도 조정 권장 */
  difficultyAdjustment?: {
    direction: "easier" | "harder" | "maintain";
    reason: string;
  };
  /** 동기 부여 메시지 */
  motivationalMessage?: string;
};

// ============================================
// 상수
// ============================================

/** 효율성 등급 임계값 */
const EFFICIENCY_THRESHOLDS = {
  EXCELLENT: 0.8, // 예상 시간의 80% 이하
  GOOD: 1.0, // 예상 시간과 동일
  AVERAGE: 1.3, // 예상 시간의 130% 이하
  // POOR: 130% 초과
};

/** 피로 임계값 (일일 학습 시간, 분) */
const FATIGUE_THRESHOLD_MINUTES = 180;

/** 연속 학습 임계값 (시간) */
const CONTINUOUS_STUDY_THRESHOLD_HOURS = 2;

// ============================================
// 핵심 함수
// ============================================

/**
 * 학습 완료 피드백을 분석하고 즉시 반영합니다.
 *
 * @param input - 완료 피드백 입력
 * @returns 피드백 분석 결과
 */
export async function processCompletionFeedback(
  input: CompletionFeedbackInput
): Promise<{ success: boolean; data?: FeedbackAnalysis; error?: string }> {
  try {
    // 효율성 점수 계산
    const efficiencyScore =
      input.expectedDurationMinutes > 0
        ? input.actualDurationMinutes / input.expectedDurationMinutes
        : 1;

    // 효율성 등급 결정
    let efficiencyGrade: FeedbackAnalysis["efficiencyGrade"];
    if (efficiencyScore <= EFFICIENCY_THRESHOLDS.EXCELLENT) {
      efficiencyGrade = "excellent";
    } else if (efficiencyScore <= EFFICIENCY_THRESHOLDS.GOOD) {
      efficiencyGrade = "good";
    } else if (efficiencyScore <= EFFICIENCY_THRESHOLDS.AVERAGE) {
      efficiencyGrade = "average";
    } else {
      efficiencyGrade = "poor";
    }

    // 난이도 적정 여부 판단
    const difficultyAppropriate =
      input.difficultyFeedback === "appropriate" ||
      input.difficultyFeedback === undefined;

    // 권장사항 생성
    const recommendations: FeedbackRecommendation[] = [];

    // 효율성 기반 권장
    if (efficiencyGrade === "poor") {
      recommendations.push({
        type: "time_adjust",
        message: "예상보다 많은 시간이 소요되었습니다. 플랜 분량 조정을 고려하세요.",
        priority: "medium",
        autoApplicable: false,
      });
    } else if (efficiencyGrade === "excellent") {
      recommendations.push({
        type: "time_adjust",
        message: "효율적으로 학습하셨습니다! 다음 플랜의 분량을 늘려볼 수 있습니다.",
        priority: "low",
        autoApplicable: false,
      });
    }

    // 난이도 기반 권장
    if (input.difficultyFeedback === "too_hard") {
      recommendations.push({
        type: "difficulty_adjust",
        message: "어렵게 느껴지셨네요. 난이도를 낮추거나 분량을 줄여보세요.",
        priority: "high",
        autoApplicable: false,
      });
    } else if (input.difficultyFeedback === "too_easy") {
      recommendations.push({
        type: "difficulty_adjust",
        message: "쉽게 완료하셨네요! 도전적인 내용을 추가해보세요.",
        priority: "low",
        autoApplicable: false,
      });
    }

    // 만족도 기반 권장
    if (input.satisfactionRating !== undefined && input.satisfactionRating <= 2) {
      recommendations.push({
        type: "schedule_shift",
        message: "학습 만족도가 낮습니다. 학습 시간이나 환경을 바꿔보세요.",
        priority: "medium",
        autoApplicable: false,
      });
    }

    // 가중치 조정 계산
    const weightAdjustments: WeightAdjustment[] = [];

    // 과목 가중치 조정
    if (efficiencyGrade === "poor" || efficiencyGrade === "average") {
      weightAdjustments.push({
        targetType: "subject",
        targetValue: input.subjectType,
        currentWeight: 1.0,
        suggestedWeight: 0.9,
        reason: `${input.subjectType} 과목 학습 효율이 낮습니다.`,
      });
    } else if (efficiencyGrade === "excellent") {
      weightAdjustments.push({
        targetType: "subject",
        targetValue: input.subjectType,
        currentWeight: 1.0,
        suggestedWeight: 1.1,
        reason: `${input.subjectType} 과목 학습 효율이 높습니다.`,
      });
    }

    return {
      success: true,
      data: {
        efficiencyScore: Math.round(efficiencyScore * 100) / 100,
        efficiencyGrade,
        difficultyAppropriate,
        recommendations,
        weightAdjustments,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError(
      { domain: "plan", action: "processCompletionFeedback" },
      error,
      { planId: input.planId, studentId: input.studentId }
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * 오늘의 학습 현황을 기반으로 실시간 추천을 생성합니다.
 *
 * @param studentId - 학생 ID
 * @returns 실시간 추천 결과
 */
export async function generateRealtimeRecommendation(
  studentId: string
): Promise<{ success: boolean; data?: RealtimeRecommendation; error?: string }> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    // 오늘 날짜
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentHour = now.getHours();

    // 오늘 완료된 플랜 조회
    const { data: todayPlans, error: plansError } = await supabase
      .from("student_plan")
      .select("id, simple_completed, actual_duration_minutes, expected_duration_minutes")
      .eq("student_id", studentId)
      .eq("plan_date", today);

    if (plansError) {
      return { success: false, error: `플랜 조회 실패: ${plansError.message}` };
    }

    const plans = todayPlans || [];
    const completedPlans = plans.filter((p) => p.simple_completed);
    const totalStudyMinutes = completedPlans.reduce(
      (sum, p) => sum + (p.actual_duration_minutes || p.expected_duration_minutes || 0),
      0
    );

    const recommendation: RealtimeRecommendation = {
      shouldRest: false,
    };

    // 피로도 기반 휴식 권장
    if (totalStudyMinutes >= FATIGUE_THRESHOLD_MINUTES) {
      recommendation.shouldRest = true;
      recommendation.restReason = `오늘 ${Math.round(totalStudyMinutes / 60 * 10) / 10}시간 학습하셨습니다. 충분한 휴식을 취하세요.`;
    }

    // 학습량 조정 권장
    const completionRate = plans.length > 0
      ? (completedPlans.length / plans.length) * 100
      : 0;

    if (completionRate >= 100 && plans.length > 0) {
      recommendation.workloadAdjustment = {
        direction: "increase",
        percentage: 10,
        reason: "오늘 모든 플랜을 완료하셨습니다! 내일은 조금 더 도전해보세요.",
      };
    } else if (completionRate < 50 && plans.length >= 3) {
      recommendation.workloadAdjustment = {
        direction: "decrease",
        percentage: 20,
        reason: "완료율이 낮습니다. 학습량을 줄여 달성감을 높여보세요.",
      };
    } else {
      recommendation.workloadAdjustment = {
        direction: "maintain",
        percentage: 0,
        reason: "현재 학습량이 적절합니다.",
      };
    }

    // 최적 시간대 추천
    // 간단한 휴리스틱: 오후 2-5시가 가장 효율적인 시간대로 가정
    const optimalHours = [14, 15, 16, 17];
    const nextOptimalHour = optimalHours.find((h) => h > currentHour) || optimalHours[0];

    if (!recommendation.shouldRest && completedPlans.length < plans.length) {
      recommendation.nextOptimalTimeSlot = {
        dayOfWeek: ["일", "월", "화", "수", "목", "금", "토"][now.getDay()],
        hour: nextOptimalHour,
        reason: "오후 시간대는 집중력이 높은 시간입니다.",
      };
    }

    // 동기 부여 메시지
    if (completionRate === 100 && plans.length > 0) {
      recommendation.motivationalMessage = "훌륭합니다! 오늘 목표를 모두 달성하셨어요!";
    } else if (completionRate >= 80) {
      recommendation.motivationalMessage = "거의 다 왔어요! 마지막까지 화이팅!";
    } else if (completedPlans.length > 0) {
      recommendation.motivationalMessage = `${completedPlans.length}개 완료! 조금만 더 힘내세요.`;
    } else if (plans.length > 0) {
      recommendation.motivationalMessage = "오늘의 첫 플랜을 시작해보세요!";
    }

    return {
      success: true,
      data: recommendation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError(
      { domain: "plan", action: "generateRealtimeRecommendation" },
      error,
      { studentId }
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * 최근 피드백 기반으로 학습 가중치를 업데이트합니다.
 *
 * @param studentId - 학생 ID
 * @param daysBack - 분석할 일수 (기본: 7일)
 * @returns 업데이트된 가중치 정보
 */
export async function updateLearningWeightsFromFeedback(
  studentId: string,
  daysBack: number = 7
): Promise<{
  success: boolean;
  data?: {
    subjectWeights: Record<string, number>;
    timeSlotWeights: Record<string, number>;
    updatedAt: string;
  };
  error?: string;
}> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // 최근 완료된 플랜 조회
    const { data: recentPlans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        subject_type,
        plan_date,
        simple_completed,
        actual_duration_minutes,
        expected_duration_minutes,
        scheduled_start_time
      `
      )
      .eq("student_id", studentId)
      .eq("simple_completed", true)
      .gte("plan_date", startDate.toISOString().split("T")[0]);

    if (plansError) {
      return { success: false, error: `플랜 조회 실패: ${plansError.message}` };
    }

    const plans = recentPlans || [];

    if (plans.length === 0) {
      return {
        success: true,
        data: {
          subjectWeights: {},
          timeSlotWeights: {},
          updatedAt: new Date().toISOString(),
        },
      };
    }

    // 과목별 효율성 계산
    const subjectStats: Record<string, { totalEfficiency: number; count: number }> = {};
    const timeSlotStats: Record<string, { totalEfficiency: number; count: number }> = {};

    for (const plan of plans) {
      const subject = plan.subject_type || "unknown";
      const expected = plan.expected_duration_minutes || 30;
      const actual = plan.actual_duration_minutes || expected;
      const efficiency = expected > 0 ? expected / actual : 1; // 높을수록 좋음

      // 과목별 집계
      if (!subjectStats[subject]) {
        subjectStats[subject] = { totalEfficiency: 0, count: 0 };
      }
      subjectStats[subject].totalEfficiency += efficiency;
      subjectStats[subject].count++;

      // 시간대별 집계
      if (plan.scheduled_start_time) {
        const hour = parseInt(plan.scheduled_start_time.split(":")[0], 10);
        const timeSlot = getTimeSlotLabel(hour);

        if (!timeSlotStats[timeSlot]) {
          timeSlotStats[timeSlot] = { totalEfficiency: 0, count: 0 };
        }
        timeSlotStats[timeSlot].totalEfficiency += efficiency;
        timeSlotStats[timeSlot].count++;
      }
    }

    // 가중치 계산 (효율성 기반)
    const subjectWeights: Record<string, number> = {};
    for (const [subject, stats] of Object.entries(subjectStats)) {
      const avgEfficiency = stats.totalEfficiency / stats.count;
      // 효율성을 0.5 ~ 1.5 범위의 가중치로 변환
      subjectWeights[subject] = Math.min(1.5, Math.max(0.5, avgEfficiency));
    }

    const timeSlotWeights: Record<string, number> = {};
    for (const [timeSlot, stats] of Object.entries(timeSlotStats)) {
      const avgEfficiency = stats.totalEfficiency / stats.count;
      timeSlotWeights[timeSlot] = Math.min(1.5, Math.max(0.5, avgEfficiency));
    }

    return {
      success: true,
      data: {
        subjectWeights,
        timeSlotWeights,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError(
      { domain: "plan", action: "updateLearningWeightsFromFeedback" },
      error,
      { studentId }
    );
    return { success: false, error: errorMessage };
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 시간을 시간대 레이블로 변환합니다.
 */
function getTimeSlotLabel(hour: number): string {
  if (hour >= 6 && hour < 12) return "오전";
  if (hour >= 12 && hour < 17) return "오후";
  if (hour >= 17 && hour < 21) return "저녁";
  if (hour >= 21 || hour < 6) return "밤/새벽";
  return "기타";
}
