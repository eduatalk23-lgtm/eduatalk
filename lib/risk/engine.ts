import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudyTime, type StudyTimeMetrics } from "@/lib/metrics/getStudyTime";
import { getPlanCompletion, type PlanCompletionMetrics } from "@/lib/metrics/getPlanCompletion";
import { getGoalStatus, type GoalStatusMetrics } from "@/lib/metrics/getGoalStatus";
import { getScoreTrend, type ScoreTrendMetrics } from "@/lib/metrics/getScoreTrend";
import { getWeakSubjects, type WeakSubjectMetrics } from "@/lib/metrics/getWeakSubjects";
import { getHistoryPattern, type HistoryPatternMetrics } from "@/lib/metrics/getHistoryPattern";
import { getCached, setCached, getCacheKey } from "./cache";
import { recordHistory } from "@/lib/history/record";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type StudentRiskResult = {
  studentId: string;
  riskScore: number; // 0~100
  level: "low" | "medium" | "high";
  reasons: string[]; // 위험 요인 상세 설명
  metrics: {
    studyTime: StudyTimeMetrics;
    planCompletion: PlanCompletionMetrics;
    goalStatus: GoalStatusMetrics;
    scoreTrend: ScoreTrendMetrics;
    weakSubjects: WeakSubjectMetrics;
    historyPattern: HistoryPatternMetrics;
  };
};

export type WeeklyMetrics = {
  studyTime: StudyTimeMetrics;
  planCompletion: PlanCompletionMetrics;
  goalStatus: GoalStatusMetrics;
  scoreTrend: ScoreTrendMetrics;
  weakSubjects: WeakSubjectMetrics;
  historyPattern: HistoryPatternMetrics;
};

/**
 * 주간 메트릭 조회
 */
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<WeeklyMetrics> {
  // 이번 주 범위 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const todayDate = today.toISOString().slice(0, 10);

  // 모든 메트릭 병렬 조회
  const [
    studyTimeResult,
    planCompletionResult,
    goalStatusResult,
    scoreTrendResult,
    weakSubjectsResult,
    historyPatternResult,
  ] = await Promise.all([
    getStudyTime(supabase, { studentId, weekStart, weekEnd }),
    getPlanCompletion(supabase, { studentId, weekStart, weekEnd }),
    getGoalStatus(supabase, { studentId, todayDate }),
    getScoreTrend(supabase, { studentId }),
    getWeakSubjects(supabase, { studentId, weekStart, weekEnd }),
    getHistoryPattern(supabase, { studentId, todayDate }),
  ]);

  // 플랜 실행률 결과 처리
  const planCompletion = planCompletionResult.success
    ? planCompletionResult.data
    : { totalPlans: 0, completedPlans: 0, completionRate: 0 };

  // 목표 상태 결과 처리
  const goalStatus = goalStatusResult.success
    ? goalStatusResult.data
    : {
        totalActiveGoals: 0,
        goalsNearDeadline: 0,
        goalsVeryNearDeadline: 0,
        averageProgress: 0,
        lowProgressGoals: 0,
        veryLowProgressGoals: 0,
        goals: [],
      };

  // 성적 추이 결과 처리
  const scoreTrend = scoreTrendResult.success
    ? scoreTrendResult.data
    : {
        hasDecliningTrend: false,
        decliningSubjects: [],
        lowGradeSubjects: [],
        recentScores: [],
      };

  // 취약 과목 결과 처리
  const weakSubjects = weakSubjectsResult.success
    ? weakSubjectsResult.data
    : {
        weakSubjects: [],
        subjectStudyTime: new Map<string, number>(),
        totalStudyTime: 0,
        weakSubjectStudyTimeRatio: 0,
      };

  // 히스토리 패턴 결과 처리
  const historyPattern = historyPatternResult.success
    ? historyPatternResult.data
    : {
        consecutivePlanFailures: 0,
        consecutiveNoStudyDays: 0,
        recentHistoryEvents: [],
      };

  // 주간 학습시간 결과 처리
  const studyTime = studyTimeResult.success
    ? studyTimeResult.data
    : {
        thisWeekMinutes: 0,
        lastWeekMinutes: 0,
        changePercent: 0,
        changeMinutes: 0,
      };

  return {
    studyTime,
    planCompletion,
    goalStatus,
    scoreTrend,
    weakSubjects,
    historyPattern,
  };
}

/**
 * 위험 점수 계산 (Rule-based)
 */
export function calculateRiskScore(
  metrics: WeeklyMetrics,
  studentId: string
): StudentRiskResult {
  let riskScore = 0;
  const reasons: string[] = [];

  // 1) 학습시간 급감
  const { thisWeekMinutes, lastWeekMinutes, changePercent } = metrics.studyTime;
  if (lastWeekMinutes > 0) {
    const ratio = thisWeekMinutes / lastWeekMinutes;
    if (ratio < 0.5) {
      riskScore += 25;
      reasons.push(
        `이번주 학습시간이 지난주 대비 ${Math.abs(changePercent)}% 감소 (${thisWeekMinutes}분 → ${lastWeekMinutes}분)`
      );
    } else if (ratio < 0.7) {
      riskScore += 15;
      reasons.push(
        `이번주 학습시간이 지난주 대비 ${Math.abs(changePercent)}% 감소 (${thisWeekMinutes}분 → ${lastWeekMinutes}분)`
      );
    }
  }

  // 2) 이번주 학습시간 부족
  if (thisWeekMinutes < 5 * 60) {
    // 5시간 미만
    riskScore += 20;
    reasons.push(`이번주 학습시간이 5시간 미만 (${Math.floor(thisWeekMinutes / 60)}시간)`);
  } else if (thisWeekMinutes < 10 * 60) {
    // 10시간 미만
    riskScore += 10;
    reasons.push(`이번주 학습시간이 10시간 미만 (${Math.floor(thisWeekMinutes / 60)}시간)`);
  }

  // 3) 플랜 실행률
  const { completionRate } = metrics.planCompletion;
  if (completionRate < 40) {
    riskScore += 20;
    reasons.push(`플랜 실행률이 ${completionRate}%로 매우 낮음`);
  } else if (completionRate < 60) {
    riskScore += 10;
    reasons.push(`플랜 실행률이 ${completionRate}%로 낮음`);
  }

  // 4) 목표 진행률 저조
  const { goalsNearDeadline, goalsVeryNearDeadline, lowProgressGoals, veryLowProgressGoals } =
    metrics.goalStatus;
  if (goalsNearDeadline >= 2 && lowProgressGoals >= 2) {
    riskScore += 20;
    reasons.push(
      `목표 ${goalsNearDeadline}개가 곧 마감인데 진행률이 저조함 (평균 ${metrics.goalStatus.averageProgress}%)`
    );
  } else if (goalsVeryNearDeadline >= 1 && veryLowProgressGoals >= 1) {
    riskScore += 15;
    reasons.push(
      `목표 ${goalsVeryNearDeadline}개가 3일 이내 마감인데 진행률이 50% 미만`
    );
  }

  // 5) 성적 하락
  if (metrics.scoreTrend.hasDecliningTrend) {
    riskScore += 20;
    reasons.push(
      `최근 모의고사/내신 등급이 2회 연속 하락한 과목: ${metrics.scoreTrend.decliningSubjects.join(", ")}`
    );
  }
  if (metrics.scoreTrend.lowGradeSubjects.length > 0) {
    riskScore += 15;
    reasons.push(
      `7등급 이하 과목: ${metrics.scoreTrend.lowGradeSubjects.join(", ")}`
    );
  }

  // 6) 취약 과목에 학습시간 부족
  if (metrics.weakSubjects.weakSubjectStudyTimeRatio < 10 && metrics.weakSubjects.weakSubjects.length > 0) {
    riskScore += 10;
    reasons.push(
      `취약 과목 학습시간이 전체의 ${metrics.weakSubjects.weakSubjectStudyTimeRatio}%로 부족함 (취약 과목: ${metrics.weakSubjects.weakSubjects.join(", ")})`
    );
  }

  // 7) 히스토리 기반 위험 신호
  if (metrics.historyPattern.consecutivePlanFailures >= 5) {
    riskScore += 20;
    reasons.push(
      `플랜 미완료가 ${metrics.historyPattern.consecutivePlanFailures}회 연속 발생`
    );
  }
  if (metrics.historyPattern.consecutiveNoStudyDays >= 3) {
    riskScore += 15;
    reasons.push(
      `학습세션이 없는 날이 ${metrics.historyPattern.consecutiveNoStudyDays}일 연속 발생`
    );
  }

  // 최대 100으로 클램프
  riskScore = Math.min(100, riskScore);

  // 위험 수준 결정
  let level: "low" | "medium" | "high";
  if (riskScore <= 30) {
    level = "low";
  } else if (riskScore <= 60) {
    level = "medium";
  } else {
    level = "high";
  }

  return {
    studentId,
    riskScore,
    level,
    reasons,
    metrics,
  };
}

/**
 * 학생 위험 점수 조회 (메인 함수, 캐싱 포함)
 */
export async function getStudentRiskScore(
  supabase: SupabaseServerClient,
  studentId: string,
  options?: { recordHistory?: boolean }
): Promise<StudentRiskResult> {
  // 캐시 확인
  const cacheKey = getCacheKey(studentId);
  const cached = getCached<StudentRiskResult>(cacheKey);
  if (cached) {
    return cached;
  }

  // 캐시 미스 시 계산
  const metrics = await getWeeklyMetrics(supabase, studentId);
  const result = calculateRiskScore(metrics, studentId);

  // 캐시 저장
  setCached(cacheKey, result);

  // 히스토리 기록 (옵션)
  if (options?.recordHistory !== false) {
    try {
      await recordHistory(supabase, studentId, "risk_evaluation", {
        riskScore: result.riskScore,
        level: result.level,
        reasons: result.reasons,
      });
    } catch (error) {
      // 히스토리 기록 실패는 무시 (메인 기능에 영향 없음)
      console.error("[risk/engine] 히스토리 기록 실패", error);
    }
  }

  return result;
}

