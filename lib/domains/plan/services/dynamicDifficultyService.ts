/**
 * 동적 난이도 조정 서비스
 *
 * 학생의 진행 속도와 완료율을 기반으로 난이도 피드백을 추론합니다.
 * 이를 통해 적절한 난이도의 콘텐츠를 추천할 수 있습니다.
 *
 * @module lib/domains/plan/services/dynamicDifficultyService
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// 상수 정의
// ============================================

/** 난이도 추론 임계값 */
const DIFFICULTY_THRESHOLDS = {
  /** 너무 쉬움: 시간 비율 < 0.7 && 진행률 >= 90% */
  TOO_EASY_TIME_RATIO: 0.7,
  TOO_EASY_PROGRESS: 90,

  /** 너무 어려움: 시간 비율 > 1.5 && 진행률 < 70% */
  TOO_HARD_TIME_RATIO: 1.5,
  TOO_HARD_PROGRESS: 70,

  /** 최소 데이터 포인트 */
  MIN_DATA_POINTS: 5,
};

/** 난이도 조정 권장 계수 */
const DIFFICULTY_ADJUSTMENT = {
  DECREASE: -1, // 한 단계 낮추기
  MAINTAIN: 0, // 현행 유지
  INCREASE: 1, // 한 단계 높이기
};

// ============================================
// 타입 정의
// ============================================

/**
 * 난이도 피드백 타입
 */
export type DifficultyFeedback = "too_easy" | "appropriate" | "too_hard";

/**
 * 과목별 난이도 프로필
 */
export type SubjectDifficultyData = {
  subjectType: string;
  averageTimeRatio: number;
  averageProgress: number;
  inferredDifficulty: DifficultyFeedback;
  dataPoints: number;
  recommendedAdjustment: number;
};

/**
 * 학생 난이도 프로필
 */
export type StudentDifficultyProfile = {
  studentId: string;
  overallDifficulty: DifficultyFeedback;
  subjectProfiles: SubjectDifficultyData[];
  recentTrend: "getting_easier" | "stable" | "getting_harder";
  analyzedPlansCount: number;
  lastUpdated: string;
};

/**
 * 난이도 분석 입력
 */
export type DifficultyAnalysisInput = {
  studentId: string;
  subjectType?: string;
  daysBack?: number;
};

/**
 * 서비스 결과
 */
export type DifficultyResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 플랜 데이터 (분석용)
 */
type PlanData = {
  id: string;
  estimated_duration: number | null;
  subject_type: string | null;
  progress: number | null;
  completed_at: string | null;
  study_session: Array<{
    duration_seconds?: number;
    paused_duration_seconds?: number;
  }> | null;
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 시간 비율 계산 (실제 / 예상)
 */
function calculateTimeRatio(
  estimatedMinutes: number,
  actualMinutes: number
): number {
  if (estimatedMinutes <= 0) return 1.0;
  return actualMinutes / estimatedMinutes;
}

/**
 * 난이도 피드백 추론
 */
function inferDifficultyFeedback(
  timeRatio: number,
  progress: number
): DifficultyFeedback {
  // 너무 쉬움: 빠르게 끝내고 진행률도 높음
  if (
    timeRatio < DIFFICULTY_THRESHOLDS.TOO_EASY_TIME_RATIO &&
    progress >= DIFFICULTY_THRESHOLDS.TOO_EASY_PROGRESS
  ) {
    return "too_easy";
  }

  // 너무 어려움: 오래 걸리고 진행률도 낮음
  if (
    timeRatio > DIFFICULTY_THRESHOLDS.TOO_HARD_TIME_RATIO &&
    progress < DIFFICULTY_THRESHOLDS.TOO_HARD_PROGRESS
  ) {
    return "too_hard";
  }

  return "appropriate";
}

/**
 * 난이도 조정 권장값 결정
 */
function determineAdjustment(feedback: DifficultyFeedback): number {
  switch (feedback) {
    case "too_easy":
      return DIFFICULTY_ADJUSTMENT.INCREASE;
    case "too_hard":
      return DIFFICULTY_ADJUSTMENT.DECREASE;
    default:
      return DIFFICULTY_ADJUSTMENT.MAINTAIN;
  }
}

/**
 * 전체 난이도 결정 (빈도 기반)
 */
function determineOverallDifficulty(
  feedbacks: DifficultyFeedback[]
): DifficultyFeedback {
  const counts = {
    too_easy: 0,
    appropriate: 0,
    too_hard: 0,
  };

  for (const feedback of feedbacks) {
    counts[feedback]++;
  }

  // 가장 빈번한 피드백 반환
  if (counts.too_hard > counts.appropriate && counts.too_hard > counts.too_easy) {
    return "too_hard";
  }
  if (counts.too_easy > counts.appropriate && counts.too_easy > counts.too_hard) {
    return "too_easy";
  }
  return "appropriate";
}

/**
 * 난이도 트렌드 분석
 */
function analyzeDifficultyTrend(
  feedbacks: Array<{ feedback: DifficultyFeedback; date: string }>
): "getting_easier" | "stable" | "getting_harder" {
  if (feedbacks.length < 6) return "stable";

  // 날짜순 정렬
  const sorted = [...feedbacks].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  // 점수화: too_easy = -1, appropriate = 0, too_hard = 1
  const score = (f: DifficultyFeedback) => {
    if (f === "too_easy") return -1;
    if (f === "too_hard") return 1;
    return 0;
  };

  const firstAvg =
    firstHalf.reduce((sum, f) => sum + score(f.feedback), 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, f) => sum + score(f.feedback), 0) /
    secondHalf.length;

  const change = secondAvg - firstAvg;

  if (change > 0.3) return "getting_harder";
  if (change < -0.3) return "getting_easier";
  return "stable";
}

// ============================================
// 메인 함수
// ============================================

/**
 * 플랜의 난이도 피드백 추론
 *
 * 단일 플랜의 시간 비율과 진행률을 기반으로 난이도를 추론합니다.
 *
 * @param plan - 플랜 데이터
 * @returns 난이도 피드백
 */
export function inferPlanDifficultyFeedback(plan: {
  estimatedMinutes: number;
  actualMinutes: number;
  progress: number;
}): DifficultyFeedback {
  const timeRatio = calculateTimeRatio(plan.estimatedMinutes, plan.actualMinutes);
  return inferDifficultyFeedback(timeRatio, plan.progress);
}

/**
 * 학생 난이도 프로필 조회
 *
 * 학생의 전체적인 난이도 적합성 프로필을 생성합니다.
 *
 * @param input - 분석 입력
 * @returns 난이도 프로필
 */
export async function getStudentDifficultyProfile(
  input: DifficultyAnalysisInput
): Promise<DifficultyResult<StudentDifficultyProfile>> {
  const { studentId, daysBack = 30 } = input;

  try {
    const supabase = await createSupabaseServerClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data: plans, error: plansError } = await supabase
      .from("student_plan")
      .select(
        `
        id,
        estimated_duration,
        subject_type,
        progress,
        completed_at,
        study_session:student_study_sessions!plan_id(
          duration_seconds,
          paused_duration_seconds
        )
      `
      )
      .eq("student_id", studentId)
      .eq("simple_completed", true)
      .gte("completed_at", startDate.toISOString())
      .order("completed_at", { ascending: true });

    if (plansError) {
      throw new Error(`프로필 조회 실패: ${plansError.message}`);
    }

    const completedPlans = (plans as PlanData[]) || [];

    // 과목별 데이터 수집
    const subjectData: Map<
      string,
      { timeRatios: number[]; progresses: number[] }
    > = new Map();
    const allFeedbacks: Array<{ feedback: DifficultyFeedback; date: string }> =
      [];

    for (const plan of completedPlans) {
      const sessions = plan.study_session || [];
      const totalActualSeconds = sessions.reduce(
        (sum, s) =>
          sum + ((s.duration_seconds || 0) - (s.paused_duration_seconds || 0)),
        0
      );
      const actualMinutes = totalActualSeconds / 60;
      const estimatedMinutes = plan.estimated_duration || 60;
      const progress = plan.progress || 0;

      if (actualMinutes > 0) {
        const timeRatio = calculateTimeRatio(estimatedMinutes, actualMinutes);
        const feedback = inferDifficultyFeedback(timeRatio, progress);

        // 전체 피드백 기록
        allFeedbacks.push({
          feedback,
          date: plan.completed_at || new Date().toISOString(),
        });

        // 과목별 집계
        const subject = plan.subject_type || "unknown";
        if (!subjectData.has(subject)) {
          subjectData.set(subject, { timeRatios: [], progresses: [] });
        }
        subjectData.get(subject)!.timeRatios.push(timeRatio);
        subjectData.get(subject)!.progresses.push(progress);
      }
    }

    // 과목별 프로필 생성
    const subjectProfiles: SubjectDifficultyData[] = [];
    for (const [subject, data] of subjectData) {
      const avgTimeRatio =
        data.timeRatios.reduce((a, b) => a + b, 0) / data.timeRatios.length;
      const avgProgress =
        data.progresses.reduce((a, b) => a + b, 0) / data.progresses.length;
      const inferredDifficulty = inferDifficultyFeedback(
        avgTimeRatio,
        avgProgress
      );

      subjectProfiles.push({
        subjectType: subject,
        averageTimeRatio: Math.round(avgTimeRatio * 100) / 100,
        averageProgress: Math.round(avgProgress * 10) / 10,
        inferredDifficulty,
        dataPoints: data.timeRatios.length,
        recommendedAdjustment: determineAdjustment(inferredDifficulty),
      });
    }

    // 전체 난이도 및 트렌드
    const overallDifficulty = determineOverallDifficulty(
      allFeedbacks.map((f) => f.feedback)
    );
    const recentTrend = analyzeDifficultyTrend(allFeedbacks);

    return {
      success: true,
      data: {
        studentId,
        overallDifficulty,
        subjectProfiles,
        recentTrend,
        analyzedPlansCount: completedPlans.length,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    logActionError({ domain: "plan", action: "getStudentDifficultyProfile" }, error, { studentId });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 과목별 난이도 조정 권장 조회
 *
 * 특정 과목에 대한 난이도 조정 권장값을 조회합니다.
 *
 * @param studentId - 학생 ID
 * @param subjectType - 과목 타입
 * @returns 권장 조정값 (-1, 0, 1)
 */
export async function getSubjectDifficultyAdjustment(
  studentId: string,
  subjectType: string
): Promise<DifficultyResult<{ adjustment: number; confidence: "low" | "medium" | "high" }>> {
  const profile = await getStudentDifficultyProfile({
    studentId,
    subjectType,
  });

  if (!profile.success || !profile.data) {
    return {
      success: false,
      error: profile.error || "프로필 조회 실패",
    };
  }

  const subjectProfile = profile.data.subjectProfiles.find(
    (p) => p.subjectType === subjectType
  );

  if (!subjectProfile) {
    return {
      success: true,
      data: {
        adjustment: DIFFICULTY_ADJUSTMENT.MAINTAIN,
        confidence: "low",
      },
    };
  }

  // 신뢰도 결정
  let confidence: "low" | "medium" | "high" = "low";
  if (subjectProfile.dataPoints >= 20) {
    confidence = "high";
  } else if (subjectProfile.dataPoints >= 10) {
    confidence = "medium";
  }

  return {
    success: true,
    data: {
      adjustment: subjectProfile.recommendedAdjustment,
      confidence,
    },
  };
}

/**
 * 난이도 조정이 필요한 과목 목록 조회
 *
 * 난이도 조정이 권장되는 과목들을 조회합니다.
 *
 * @param studentId - 학생 ID
 * @returns 조정이 필요한 과목 목록
 */
export async function getSubjectsNeedingAdjustment(
  studentId: string
): Promise<
  DifficultyResult<
    Array<{
      subjectType: string;
      currentDifficulty: DifficultyFeedback;
      recommendedAdjustment: number;
    }>
  >
> {
  const profile = await getStudentDifficultyProfile({ studentId });

  if (!profile.success || !profile.data) {
    return {
      success: false,
      error: profile.error || "프로필 조회 실패",
    };
  }

  const needingAdjustment = profile.data.subjectProfiles
    .filter((p) => p.recommendedAdjustment !== 0 && p.dataPoints >= 5)
    .map((p) => ({
      subjectType: p.subjectType,
      currentDifficulty: p.inferredDifficulty,
      recommendedAdjustment: p.recommendedAdjustment,
    }));

  return {
    success: true,
    data: needingAdjustment,
  };
}
