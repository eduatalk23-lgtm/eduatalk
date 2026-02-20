/**
 * 배치 위험 학생 조회
 *
 * 대시보드용 벌크 쿼리: 학생별 N+1 개별 조회 대신
 * 전체 학생을 대상으로 ~9개 쿼리로 데이터를 조회한 뒤
 * JS에서 학생별로 조립하여 calculateRiskScore에 전달합니다.
 */
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCompletedPlan, filterLearningPlans } from "@/lib/utils/planUtils";
import { calculateGoalProgress, type Goal, type GoalProgress } from "@/lib/goals/calc";
import {
  SCORE_CONSTANTS,
  SCORE_TREND_CONSTANTS,
  GOAL_CONSTANTS,
  HISTORY_PATTERN_CONSTANTS,
  WEAK_SUBJECT_CONSTANTS,
} from "@/lib/metrics/constants";
import { calculateRiskScore, type WeeklyMetrics } from "./engine";
import type { StudyTimeMetrics } from "@/lib/metrics/getStudyTime";
import type { PlanCompletionMetrics } from "@/lib/metrics/getPlanCompletion";
import type { GoalStatusMetrics } from "@/lib/metrics/getGoalStatus";
import type { ScoreTrendMetrics } from "@/lib/metrics/getScoreTrend";
import type { WeakSubjectMetrics } from "@/lib/metrics/getWeakSubjects";
import type { HistoryPatternMetrics } from "@/lib/metrics/getHistoryPattern";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type BatchRiskResult = {
  studentId: string;
  riskScore: number;
  level: "low" | "medium" | "high";
  reasons: string[];
};

// ─── 주간 범위 계산 ───────────────────────────────────
function getWeekRanges() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(weekStart.getDate() - 1);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - HISTORY_PATTERN_CONSTANTS.HISTORY_LOOKBACK_DAYS);

  const toStr = (d: Date) => d.toISOString().slice(0, 10);

  return {
    weekStartStr: toStr(weekStart),
    weekEndStr: toStr(weekEnd),
    lastWeekStartStr: toStr(lastWeekStart),
    lastWeekEndStr: toStr(lastWeekEnd),
    todayStr: toStr(today),
    thirtyDaysAgoStr: toStr(thirtyDaysAgo),
    today,
  };
}

// ─── 벌크 Fetch 함수들 ────────────────────────────────

async function fetchBatchStudySessions(
  supabase: SupabaseServerClient,
  ids: string[],
  startDate: string,
  endDate: string
) {
  const { data } = await supabase
    .from("student_study_sessions")
    .select("student_id,started_at,duration_seconds")
    .in("student_id", ids)
    .gte("started_at", `${startDate}T00:00:00Z`)
    .lte("started_at", `${endDate}T23:59:59Z`);
  return data ?? [];
}

async function fetchBatchPlans(
  supabase: SupabaseServerClient,
  ids: string[],
  weekStartStr: string,
  weekEndStr: string
) {
  const { data } = await supabase
    .from("student_plan")
    .select("student_id,id,completed_amount,actual_end_time,progress,content_id,status")
    .in("student_id", ids)
    .gte("plan_date", weekStartStr)
    .lte("plan_date", weekEndStr);
  return data ?? [];
}

async function fetchBatchGoals(
  supabase: SupabaseServerClient,
  ids: string[],
  todayStr: string
) {
  const [goalsResult, progressResult] = await Promise.all([
    supabase
      .from("student_goals")
      .select("*")
      .in("student_id", ids)
      .lte("start_date", todayStr)
      .gte("end_date", todayStr),
    supabase
      .from("student_goal_progress")
      .select("*")
      .in("student_id", ids)
      .order("recorded_at", { ascending: false }),
  ]);
  return {
    goals: (goalsResult.data ?? []) as Goal[],
    progress: (progressResult.data ?? []) as GoalProgress[],
  };
}

async function fetchBatchScores(
  supabase: SupabaseServerClient,
  ids: string[]
) {
  const [internalResult, mockResult] = await Promise.all([
    supabase
      .from("student_internal_scores")
      .select("student_id,rank_grade,grade,semester,created_at,subject_groups:subject_group_id(name)")
      .in("student_id", ids)
      .order("created_at", { ascending: false })
      .limit(ids.length * SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
    supabase
      .from("student_mock_scores")
      .select("student_id,grade_score,exam_date,subject_groups:subject_group_id(name)")
      .in("student_id", ids)
      .order("exam_date", { ascending: false })
      .limit(ids.length * SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
  ]);
  return {
    internal: internalResult.data ?? [],
    mock: mockResult.data ?? [],
  };
}

async function fetchBatchHistory(
  supabase: SupabaseServerClient,
  ids: string[],
  thirtyDaysAgoStr: string
) {
  const { data } = await supabase
    .from("student_history")
    .select("student_id,event_type,created_at")
    .in("student_id", ids)
    .gte("created_at", thirtyDaysAgoStr)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function fetchBatchAnalysis(
  supabase: SupabaseServerClient,
  ids: string[]
) {
  const { data } = await supabase
    .from("student_analysis")
    .select("student_id,subject,risk_score")
    .in("student_id", ids);
  return data ?? [];
}

// ─── 학생별 메트릭 조립 (순수 함수) ──────────────────

function groupBy<T>(arr: T[], keyFn: (item: T) => string | undefined | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    if (!key) continue;
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

function assembleStudyTimeMetrics(
  sessions: Array<{ started_at: string; duration_seconds: number | null }>,
  weekStartStr: string,
  weekEndStr: string,
  lastWeekStartStr: string,
  lastWeekEndStr: string
): StudyTimeMetrics {
  let thisWeekSeconds = 0;
  let lastWeekSeconds = 0;

  for (const s of sessions) {
    const d = s.started_at.slice(0, 10);
    const dur = s.duration_seconds ?? 0;
    if (d >= weekStartStr && d <= weekEndStr) thisWeekSeconds += dur;
    else if (d >= lastWeekStartStr && d <= lastWeekEndStr) lastWeekSeconds += dur;
  }

  const thisWeekMinutes = Math.floor(thisWeekSeconds / 60);
  const lastWeekMinutes = Math.floor(lastWeekSeconds / 60);
  const changeMinutes = thisWeekMinutes - lastWeekMinutes;
  const changePercent =
    lastWeekMinutes > 0
      ? Math.round((changeMinutes / lastWeekMinutes) * 100)
      : thisWeekMinutes > 0
      ? 100
      : 0;

  return { thisWeekMinutes, lastWeekMinutes, changePercent, changeMinutes };
}

function assemblePlanCompletionMetrics(
  plans: Array<{
    id: string;
    completed_amount: number | null;
    actual_end_time: string | null;
    progress: number | null;
    content_id: string | null;
    status: string | null;
  }>
): PlanCompletionMetrics {
  const learningPlans = filterLearningPlans(plans);
  const totalPlans = learningPlans.length;
  const completedPlans = learningPlans.filter((p) => isCompletedPlan(p)).length;
  const completionRate =
    totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
  return { totalPlans, completedPlans, completionRate };
}

function assembleGoalStatusMetrics(
  goals: Goal[],
  progress: GoalProgress[],
  today: Date
): GoalStatusMetrics {
  if (goals.length === 0) {
    return {
      totalActiveGoals: 0,
      goalsNearDeadline: 0,
      goalsVeryNearDeadline: 0,
      averageProgress: 0,
      lowProgressGoals: 0,
      veryLowProgressGoals: 0,
      goals: [],
    };
  }

  const progressByGoalId = groupBy(progress, (p) => p.goal_id);

  const goalsWithProgress = goals.map((goal) => {
    const progressRows = progressByGoalId.get(goal.id) ?? [];
    const p = calculateGoalProgress(goal, progressRows, today);
    return {
      id: goal.id,
      title: goal.title,
      daysRemaining: p.daysRemaining,
      progressPercentage: p.progressPercentage,
    };
  });

  return {
    totalActiveGoals: goalsWithProgress.length,
    goalsNearDeadline: goalsWithProgress.filter(
      (g) => g.daysRemaining !== null && g.daysRemaining <= GOAL_CONSTANTS.NEAR_DEADLINE_DAYS && g.daysRemaining >= 0
    ).length,
    goalsVeryNearDeadline: goalsWithProgress.filter(
      (g) => g.daysRemaining !== null && g.daysRemaining <= GOAL_CONSTANTS.VERY_NEAR_DEADLINE_DAYS && g.daysRemaining >= 0
    ).length,
    averageProgress:
      goalsWithProgress.length > 0
        ? Math.round(goalsWithProgress.reduce((s, g) => s + g.progressPercentage, 0) / goalsWithProgress.length)
        : 0,
    lowProgressGoals: goalsWithProgress.filter(
      (g) => g.progressPercentage < GOAL_CONSTANTS.LOW_PROGRESS_THRESHOLD
    ).length,
    veryLowProgressGoals: goalsWithProgress.filter(
      (g) => g.progressPercentage < GOAL_CONSTANTS.VERY_LOW_PROGRESS_THRESHOLD
    ).length,
    goals: goalsWithProgress,
  };
}

function assembleScoreTrendMetrics(
  internal: Array<{
    rank_grade: number | null;
    grade: number | null;
    semester: number | null;
    created_at: string;
    subject_groups: { name: string } | null;
  }>,
  mock: Array<{
    grade_score: number | null;
    exam_date: string;
    subject_groups: { name: string } | null;
  }>
): ScoreTrendMetrics {
  const allScores: Array<{
    subject: string;
    scoreType: "internal" | "mock";
    grade: number;
    testDate: string;
  }> = [];

  for (const row of internal) {
    if (row.subject_groups?.name && row.rank_grade != null) {
      allScores.push({
        subject: row.subject_groups.name,
        scoreType: "internal",
        grade: row.rank_grade,
        testDate: row.created_at,
      });
    }
  }

  for (const row of mock) {
    if (row.subject_groups?.name && row.grade_score != null) {
      allScores.push({
        subject: row.subject_groups.name,
        scoreType: "mock",
        grade: row.grade_score,
        testDate: row.exam_date,
      });
    }
  }

  allScores.sort((a, b) => b.testDate.localeCompare(a.testDate));

  const subjectMap = new Map<string, Array<{ grade: number; testDate: string }>>();
  for (const s of allScores) {
    const arr = subjectMap.get(s.subject);
    if (arr) arr.push({ grade: s.grade, testDate: s.testDate });
    else subjectMap.set(s.subject, [{ grade: s.grade, testDate: s.testDate }]);
  }

  const decliningSubjects: string[] = [];
  const lowGradeSubjects: string[] = [];

  subjectMap.forEach((scores, subject) => {
    if (scores.length >= SCORE_CONSTANTS.DECLINING_TREND_THRESHOLD) {
      const sorted = scores.sort((a, b) => b.testDate.localeCompare(a.testDate));
      if (sorted[0].grade > sorted[1].grade) {
        decliningSubjects.push(subject);
      }
    }
    const latestGrade = scores.sort((a, b) => b.testDate.localeCompare(a.testDate))[0]?.grade;
    if (latestGrade !== undefined && latestGrade >= SCORE_CONSTANTS.LOW_GRADE_THRESHOLD) {
      lowGradeSubjects.push(subject);
    }
  });

  return {
    hasDecliningTrend: decliningSubjects.length > 0,
    decliningSubjects,
    lowGradeSubjects,
    recentScores: allScores.slice(0, SCORE_TREND_CONSTANTS.RETURN_SCORES_LIMIT),
  };
}

function assembleWeakSubjectsMetrics(
  analysis: Array<{ subject: string | null; risk_score: number | null }>
): WeakSubjectMetrics {
  const weakSubjects = analysis
    .filter((a) => a.subject && a.risk_score != null && a.risk_score >= WEAK_SUBJECT_CONSTANTS.RISK_SCORE_THRESHOLD)
    .map((a) => a.subject!);

  return {
    weakSubjects,
    subjectStudyTime: new Map<string, number>(),
    totalStudyTime: 0,
    weakSubjectStudyTimeRatio: 0, // 배치에서는 간소화 (최대 +10점 오차)
  };
}

function assembleHistoryPatternMetrics(
  historyRows: Array<{ event_type: string | null; created_at: string | null }>,
  todayStr: string
): HistoryPatternMetrics {
  const dateMap = new Map<string, Set<string>>();
  const studySessionDates = new Set<string>();

  for (const row of historyRows) {
    if (!row.created_at || !row.event_type) continue;
    const date = row.created_at.slice(0, 10);
    const existing = dateMap.get(date);
    if (existing) existing.add(row.event_type);
    else dateMap.set(date, new Set([row.event_type]));
    if (row.event_type === "study_session") studySessionDates.add(date);
  }

  let consecutivePlanFailures = 0;
  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
  for (const date of sortedDates) {
    if (!(dateMap.get(date)?.has("plan_completed"))) {
      consecutivePlanFailures++;
    } else {
      break;
    }
  }

  let consecutiveNoStudyDays = 0;
  const checkDate = new Date(todayStr + "T00:00:00");
  for (let i = 0; i < HISTORY_PATTERN_CONSTANTS.HISTORY_LOOKBACK_DAYS; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (!studySessionDates.has(dateStr)) {
      consecutiveNoStudyDays++;
    } else {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    consecutivePlanFailures,
    consecutiveNoStudyDays,
    recentHistoryEvents: historyRows
      .slice(0, HISTORY_PATTERN_CONSTANTS.RECENT_EVENTS_LIMIT)
      .map((r) => ({
        eventType: r.event_type ?? "",
        date: r.created_at?.slice(0, 10) ?? "",
      })),
  };
}

// ─── 메인 배치 함수 ──────────────────────────────────

export async function getBatchAtRiskStudents(
  supabase: SupabaseServerClient,
  studentIds: string[]
): Promise<BatchRiskResult[]> {
  if (studentIds.length === 0) return [];

  const ranges = getWeekRanges();

  // 6개 벌크 fetch를 병렬 실행 (~9 쿼리)
  const [sessions, plans, goalsData, scoresData, historyRows, analysisRows] =
    await Promise.all([
      fetchBatchStudySessions(supabase, studentIds, ranges.lastWeekStartStr, ranges.weekEndStr),
      fetchBatchPlans(supabase, studentIds, ranges.weekStartStr, ranges.weekEndStr),
      fetchBatchGoals(supabase, studentIds, ranges.todayStr),
      fetchBatchScores(supabase, studentIds),
      fetchBatchHistory(supabase, studentIds, ranges.thirtyDaysAgoStr),
      fetchBatchAnalysis(supabase, studentIds),
    ]);

  // 학생별로 그룹화
  const sessionsByStudent = groupBy(sessions, (s) => s.student_id);
  const plansByStudent = groupBy(plans, (p) => p.student_id);
  const goalsByStudent = groupBy(goalsData.goals, (g) => g.student_id);
  const progressByStudent = groupBy(goalsData.progress, (p) => p.student_id);
  const internalByStudent = groupBy(scoresData.internal, (s) => s.student_id);
  const mockByStudent = groupBy(scoresData.mock, (s) => s.student_id);
  const historyByStudent = groupBy(historyRows, (h) => h.student_id);
  const analysisByStudent = groupBy(analysisRows, (a) => a.student_id);

  // 학생별 메트릭 조립 + 위험 점수 계산
  return studentIds.map((studentId) => {
    const metrics: WeeklyMetrics = {
      studyTime: assembleStudyTimeMetrics(
        sessionsByStudent.get(studentId) ?? [],
        ranges.weekStartStr,
        ranges.weekEndStr,
        ranges.lastWeekStartStr,
        ranges.lastWeekEndStr
      ),
      planCompletion: assemblePlanCompletionMetrics(
        plansByStudent.get(studentId) ?? []
      ),
      goalStatus: assembleGoalStatusMetrics(
        goalsByStudent.get(studentId) ?? [],
        progressByStudent.get(studentId) ?? [],
        ranges.today
      ),
      scoreTrend: assembleScoreTrendMetrics(
        (internalByStudent.get(studentId) ?? []) as unknown as Array<{
          rank_grade: number | null;
          grade: number | null;
          semester: number | null;
          created_at: string;
          subject_groups: { name: string } | null;
        }>,
        (mockByStudent.get(studentId) ?? []) as unknown as Array<{
          grade_score: number | null;
          exam_date: string;
          subject_groups: { name: string } | null;
        }>
      ),
      weakSubjects: assembleWeakSubjectsMetrics(
        analysisByStudent.get(studentId) ?? []
      ),
      historyPattern: assembleHistoryPatternMetrics(
        historyByStudent.get(studentId) ?? [],
        ranges.todayStr
      ),
    };

    const result = calculateRiskScore(metrics, studentId);
    return {
      studentId,
      riskScore: result.riskScore,
      level: result.level,
      reasons: result.reasons,
    };
  });
}
