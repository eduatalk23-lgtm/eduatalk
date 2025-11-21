import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudyTime, type StudyTimeMetrics } from "@/lib/metrics/getStudyTime";
import { getPlanCompletion, type PlanCompletionMetrics } from "@/lib/metrics/getPlanCompletion";
import { getGoalStatus, type GoalStatusMetrics } from "@/lib/metrics/getGoalStatus";
import { getWeakSubjects, type WeakSubjectMetrics } from "@/lib/metrics/getWeakSubjects";
import { getStudentRiskScore, type StudentRiskResult } from "@/lib/risk/engine";
import { getRecommendations, type Recommendations } from "@/lib/recommendations/engine";
import { getHistoryPattern, type HistoryPatternMetrics } from "@/lib/metrics/getHistoryPattern";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type WeeklyMetricsData = {
  weeklyStudyMinutes: number; // 이번주 학습시간 (분)
  weeklyStudyTrend: number; // 지난주 대비 변화율 (%)
  weeklyPlanCompletion: number; // 실행률 (%)
  weeklyGoalsProgress: number; // 목표 달성률 (%)
  weakSubjects: string[]; // 취약 과목 목록
  riskLevel: "low" | "medium" | "high"; // Risk Engine 결과
  recommendations: string[]; // 추천 엔진 결과
  consistencyScore: number; // 이번주 연속성 지표 (0-100)
  focusScore: number; // 집중 타이머 품질 (0-100)
};

/**
 * 주간 메트릭 데이터 수집
 */
export async function getWeeklyMetrics(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<WeeklyMetricsData> {
  try {
    // 이번 주 범위 계산 (월요일부터)
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
      studyTime,
      planCompletion,
      goalStatus,
      weakSubjects,
      riskResult,
      recommendations,
      historyPattern,
      sessions,
    ] = await Promise.all([
      getStudyTime(supabase, studentId, weekStart, weekEnd),
      getPlanCompletion(supabase, studentId, weekStart, weekEnd),
      getGoalStatus(supabase, studentId, todayDate),
      getWeakSubjects(supabase, studentId, weekStart, weekEnd),
      getStudentRiskScore(supabase, studentId, { recordHistory: false }),
      getRecommendations(supabase, studentId),
      getHistoryPattern(supabase, studentId, todayDate),
      getSessionsByDateRange(
        supabase,
        studentId,
        weekStart.toISOString().slice(0, 10),
        weekEnd.toISOString().slice(0, 10)
      ),
    ]);

    // 주간 학습시간
    const weeklyStudyMinutes = studyTime.thisWeekMinutes;
    const weeklyStudyTrend = studyTime.changePercent;

    // 플랜 실행률
    const weeklyPlanCompletion = planCompletion.completionRate;

    // 목표 달성률
    const weeklyGoalsProgress = goalStatus.averageProgress;

    // 취약 과목
    const weakSubjectsList = weakSubjects.weakSubjects;

    // Risk Level
    const riskLevel = riskResult.level;

    // 추천 엔진 결과 (상위 5개)
    const allRecommendations = [
      ...recommendations.goals,
      ...recommendations.subjects,
      ...recommendations.studyPlan,
      ...recommendations.contents,
    ];
    const topRecommendations = allRecommendations.slice(0, 5);

    // Consistency Score 계산 (이번주 연속성)
    const consistencyScore = calculateConsistencyScore(
      sessions,
      weekStart,
      weekEnd,
      historyPattern
    );

    // Focus Score 계산 (집중 타이머 품질)
    const focusScore = calculateFocusScore(sessions);

    return {
      weeklyStudyMinutes,
      weeklyStudyTrend,
      weeklyPlanCompletion,
      weeklyGoalsProgress,
      weakSubjects: weakSubjectsList,
      riskLevel,
      recommendations: topRecommendations,
      consistencyScore,
      focusScore,
    };
  } catch (error) {
    console.error("[coaching/getWeeklyMetrics] 주간 메트릭 수집 실패", error);
    // 기본값 반환
    return {
      weeklyStudyMinutes: 0,
      weeklyStudyTrend: 0,
      weeklyPlanCompletion: 0,
      weeklyGoalsProgress: 0,
      weakSubjects: [],
      riskLevel: "low",
      recommendations: [],
      consistencyScore: 0,
      focusScore: 0,
    };
  }
}

/**
 * Consistency Score 계산 (0-100)
 * - 이번주 학습일 수 기반
 * - 연속 학습일 수 기반
 * - 플랜 완료 일관성 기반
 */
function calculateConsistencyScore(
  sessions: Array<{ started_at?: string | null; duration_seconds?: number | null }>,
  weekStart: Date,
  weekEnd: Date,
  historyPattern: HistoryPatternMetrics
): number {
  // 이번주 학습일 수 계산
  const studyDays = new Set<string>();
  sessions.forEach((session) => {
    if (session.started_at && session.duration_seconds && session.duration_seconds > 0) {
      const date = new Date(session.started_at).toISOString().slice(0, 10);
      if (date >= weekStart.toISOString().slice(0, 10) && date <= weekEnd.toISOString().slice(0, 10)) {
        studyDays.add(date);
      }
    }
  });

  const studyDaysCount = studyDays.size;
  const totalDaysInWeek = 7;

  // 학습일 비율 (40%)
  const studyDaysRatio = (studyDaysCount / totalDaysInWeek) * 100;

  // 연속 학습일 점수 (30%)
  // 이번주 연속 학습일 수 계산
  let consecutiveDays = 0;
  const checkDate = new Date(weekEnd);
  for (let i = 0; i < 7; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (studyDays.has(dateStr)) {
      consecutiveDays++;
    } else {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  const consecutiveDaysScore = (consecutiveDays / 7) * 100;

  // 플랜 완료 일관성 (30%)
  // 연속 플랜 미완료가 적을수록 높은 점수
  const planFailurePenalty = Math.min(100, historyPattern.consecutivePlanFailures * 20);
  const planConsistencyScore = Math.max(0, 100 - planFailurePenalty);

  // 최종 점수 계산
  const consistencyScore =
    studyDaysRatio * 0.4 + consecutiveDaysScore * 0.3 + planConsistencyScore * 0.3;

  return Math.round(Math.min(100, Math.max(0, consistencyScore)));
}

/**
 * Focus Score 계산 (0-100)
 * - 세션 평균 길이 기반
 * - 긴 세션 비율 기반
 * - 세션 빈도 기반
 */
function calculateFocusScore(
  sessions: Array<{ duration_seconds?: number | null }>
): number {
  if (sessions.length === 0) {
    return 0;
  }

  const validSessions = sessions.filter(
    (s) => s.duration_seconds !== null && s.duration_seconds !== undefined && s.duration_seconds > 0
  );

  if (validSessions.length === 0) {
    return 0;
  }

  // 평균 세션 길이 (분)
  const totalMinutes = validSessions.reduce(
    (sum, s) => sum + (s.duration_seconds || 0) / 60,
    0
  );
  const avgSessionMinutes = totalMinutes / validSessions.length;

  // 평균 세션 길이 점수 (40%)
  // 30분 이상 = 100점, 15분 = 50점, 5분 = 0점
  const avgLengthScore = Math.min(100, Math.max(0, ((avgSessionMinutes - 5) / 25) * 100));

  // 긴 세션 비율 (30분 이상) (30%)
  const longSessions = validSessions.filter((s) => (s.duration_seconds || 0) >= 30 * 60).length;
  const longSessionRatio = (longSessions / validSessions.length) * 100;

  // 세션 빈도 점수 (30%)
  // 세션이 많을수록 좋음 (하루 평균 2개 이상 = 100점)
  const avgSessionsPerDay = validSessions.length / 7;
  const frequencyScore = Math.min(100, (avgSessionsPerDay / 2) * 100);

  // 최종 점수 계산
  const focusScore = avgLengthScore * 0.4 + longSessionRatio * 0.3 + frequencyScore * 0.3;

  return Math.round(Math.min(100, Math.max(0, focusScore)));
}

