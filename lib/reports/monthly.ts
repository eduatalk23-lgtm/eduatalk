import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { getSubjectFromContent } from "@/lib/studySessions/summary";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 월간 학습시간 요약
export type MonthlyStudyTime = {
  totalMinutes: number;
  totalHours: number;
  byWeek: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    minutes: number;
    hours: number;
  }>;
  bySubject: Array<{
    subject: string;
    minutes: number;
    hours: number;
    percentage: number;
  }>;
};

// 월간 플랜 요약
export type MonthlyPlanSummary = {
  totalPlans: number;
  completedPlans: number;
  completionRate: number; // 0-100
  byWeek: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    totalPlans: number;
    completedPlans: number;
    completionRate: number;
  }>;
};

// 월간 목표 요약
export type MonthlyGoalSummary = {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  averageProgress: number; // 0-100
  goals: Array<{
    id: string;
    title: string;
    goalType: string;
    progressPercentage: number;
    status: "scheduled" | "in_progress" | "completed" | "failed";
  }>;
};

// 월간 성적 변화
export type MonthlyScoreTrend = {
  thisMonth: Array<{
    subject: string;
    grade: number;
    rawScore: number;
    testDate: string;
  }>;
  lastMonth: Array<{
    subject: string;
    grade: number;
    rawScore: number;
    testDate: string;
  }>;
  trend: "improving" | "declining" | "stable";
};

// 취약 과목 트렌드
export type MonthlyWeakSubjectTrend = {
  subjects: Array<{
    subject: string;
    riskScore: number; // 0-100
    studyTimeMinutes: number;
    scoreChange: number | null; // 등급 변화 (음수면 개선, 양수면 악화)
  }>;
};

// 콘텐츠 진행률
export type MonthlyContentProgress = {
  progressList: Array<{
    contentType: "book" | "lecture" | "custom";
    contentId: string;
    title: string;
    subject: string | null;
    progress: number;
    progressChange: number; // 이번 달 증가량
  }>;
};

// 히스토리 요약
export type MonthlyHistory = {
  events: Array<{
    id: string;
    eventType: string;
    detail: any;
    createdAt: string;
  }>;
};

// 월간 리포트 전체 데이터
export type MonthlyReport = {
  period: {
    start: string;
    end: string;
    monthLabel: string;
  };
  totals: {
    studyMinutes: number;
    completionRate: number;
    goalRate: number;
  };
  subjects: {
    strong: string[];
    weak: string[];
  };
  scores: MonthlyScoreTrend;
  goals: MonthlyGoalSummary;
  content: MonthlyContentProgress;
  history: MonthlyHistory;
  comparison: {
    studyTimeChange: number; // 지난달 대비 변화 (분)
    completionRateChange: number; // 지난달 대비 변화 (%)
    goalRateChange: number; // 지난달 대비 변화 (%)
  };
  // 그래프용 데이터
  studyTimeByWeek: MonthlyStudyTime["byWeek"];
  planCompletionByWeek: MonthlyPlanSummary["byWeek"];
  studyTimeBySubject: MonthlyStudyTime["bySubject"];
};

/**
 * 플랜 정보 조회 (헬퍼)
 */
async function getPlanInfo(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<{ content_type: string | null; content_id: string | null } | null> {
  try {
    const selectPlan = () =>
      supabase.from("student_plan").select("content_type,content_id").eq("id", planId);

    let { data, error } = await selectPlan().eq("student_id", studentId).maybeSingle();

    if (error && error.code === "42703") {
      ({ data, error } = await selectPlan().maybeSingle());
    }

    if (error) throw error;

    return data as { content_type: string | null; content_id: string | null } | null;
  } catch (error) {
    console.error("[reports/monthly] 플랜 정보 조회 실패", error);
    return null;
  }
}

/**
 * 월간 학습시간 조회
 */
export async function getMonthlyStudyTime(
  supabase: SupabaseServerClient,
  studentId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyStudyTime> {
  try {
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    const sessions = await getSessionsByDateRange(
      supabase,
      studentId,
      monthStartStr,
      monthEndStr
    );

    let totalSeconds = 0;
    const byWeekMap = new Map<number, number>();
    const bySubjectMap = new Map<string, number>();

    // 주차 계산 헬퍼
    const getWeekNumber = (date: Date): number => {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const dayOfMonth = date.getDate();
      return Math.ceil((dayOfMonth + firstDay.getDay()) / 7);
    };

    // 세션별 집계
    for (const session of sessions) {
      if (!session.duration_seconds) continue;

      totalSeconds += session.duration_seconds;

      // 주차별 집계
      const sessionDate = new Date(session.started_at);
      const weekNumber = getWeekNumber(sessionDate);
      byWeekMap.set(weekNumber, (byWeekMap.get(weekNumber) || 0) + session.duration_seconds);

      // 과목별 집계
      let subject: string | null = null;
      if (session.plan_id) {
        const plan = await getPlanInfo(supabase, studentId, session.plan_id);
        if (plan && plan.content_type && plan.content_id) {
          const contentType = plan.content_type;
          const contentId = plan.content_id;
          subject = await getSubjectFromContent(
            supabase,
            studentId,
            contentType,
            contentId
          );
        }
      } else if (session.content_type && session.content_id) {
        subject = await getSubjectFromContent(
          supabase,
          studentId,
          session.content_type,
          session.content_id
        );
      }

      if (subject) {
        bySubjectMap.set(subject, (bySubjectMap.get(subject) || 0) + session.duration_seconds);
      }
    }

    // 주차별 배열 생성
    const byWeek: MonthlyStudyTime["byWeek"] = [];
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);

    // 월의 주차 계산 (1주차부터)
    const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const totalWeeks = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);

    for (let week = 1; week <= totalWeeks; week++) {
      const weekStartDate = new Date(firstDay);
      weekStartDate.setDate(1 + (week - 1) * 7 - firstDay.getDay());
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);

      // 월 범위 내로 제한
      if (weekStartDate < monthStart) weekStartDate.setTime(monthStart.getTime());
      if (weekEndDate > monthEnd) weekEndDate.setTime(monthEnd.getTime());

      const weekSeconds = byWeekMap.get(week) || 0;
      byWeek.push({
        weekNumber: week,
        startDate: weekStartDate.toISOString().slice(0, 10),
        endDate: weekEndDate.toISOString().slice(0, 10),
        minutes: Math.floor(weekSeconds / 60),
        hours: Math.floor(weekSeconds / 3600),
      });
    }

    // 과목별 배열 생성
    const totalSubjectSeconds = Array.from(bySubjectMap.values()).reduce((a, b) => a + b, 0);
    const bySubject: MonthlyStudyTime["bySubject"] = Array.from(bySubjectMap.entries())
      .map(([subject, seconds]) => {
        const minutes = Math.floor(seconds / 60);
        return {
          subject,
          minutes,
          hours: Math.floor(minutes / 60),
          percentage: totalSubjectSeconds > 0 ? Math.round((seconds / totalSubjectSeconds) * 100) : 0,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    return {
      totalMinutes,
      totalHours,
      byWeek,
      bySubject,
    };
  } catch (error) {
    console.error("[reports/monthly] 학습시간 조회 실패", error);
    return {
      totalMinutes: 0,
      totalHours: 0,
      byWeek: [],
      bySubject: [],
    };
  }
}

/**
 * 월간 플랜 요약 조회
 */
export async function getMonthlyPlanSummary(
  supabase: SupabaseServerClient,
  studentId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyPlanSummary> {
  try {
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,plan_date,completed_amount")
        .gte("plan_date", monthStartStr)
        .lte("plan_date", monthEndStr)
        .order("plan_date", { ascending: true });

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: plans, error } = await selectPlans());
    }

    if (error) throw error;

    const planRows = (plans as Array<{
      id: string;
      plan_date?: string | null;
      completed_amount?: number | null;
    }> | null) ?? [];

    const completedPlans = planRows.filter(
      (plan) => plan.completed_amount !== null && plan.completed_amount !== undefined && plan.completed_amount > 0
    ).length;

    // 주차별 집계
    const byWeekMap = new Map<number, { total: number; completed: number }>();
    const getWeekNumber = (date: Date): number => {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const dayOfMonth = date.getDate();
      return Math.ceil((dayOfMonth + firstDay.getDay()) / 7);
    };

    planRows.forEach((plan) => {
      if (!plan.plan_date) return;
      const planDate = new Date(plan.plan_date);
      const weekNumber = getWeekNumber(planDate);
      const weekData = byWeekMap.get(weekNumber) ?? { total: 0, completed: 0 };
      weekData.total++;
      if (plan.completed_amount !== null && plan.completed_amount !== undefined && plan.completed_amount > 0) {
        weekData.completed++;
      }
      byWeekMap.set(weekNumber, weekData);
    });

    // 주차별 배열 생성
    const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const totalWeeks = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);

    const byWeek: MonthlyPlanSummary["byWeek"] = [];
    for (let week = 1; week <= totalWeeks; week++) {
      const weekStartDate = new Date(firstDay);
      weekStartDate.setDate(1 + (week - 1) * 7 - firstDay.getDay());
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);

      if (weekStartDate < monthStart) weekStartDate.setTime(monthStart.getTime());
      if (weekEndDate > monthEnd) weekEndDate.setTime(monthEnd.getTime());

      const weekData = byWeekMap.get(week) ?? { total: 0, completed: 0 };
      byWeek.push({
        weekNumber: week,
        startDate: weekStartDate.toISOString().slice(0, 10),
        endDate: weekEndDate.toISOString().slice(0, 10),
        totalPlans: weekData.total,
        completedPlans: weekData.completed,
        completionRate: weekData.total > 0 ? Math.round((weekData.completed / weekData.total) * 100) : 0,
      });
    }

    return {
      totalPlans: planRows.length,
      completedPlans,
      completionRate: planRows.length > 0 ? Math.round((completedPlans / planRows.length) * 100) : 0,
      byWeek,
    };
  } catch (error) {
    console.error("[reports/monthly] 플랜 요약 조회 실패", error);
    return {
      totalPlans: 0,
      completedPlans: 0,
      completionRate: 0,
      byWeek: [],
    };
  }
}

/**
 * 월간 목표 요약 조회
 */
export async function getMonthlyGoalSummary(
  supabase: SupabaseServerClient,
  studentId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyGoalSummary> {
  try {
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    const selectGoals = () =>
      supabase
        .from("student_goals")
        .select("id,title,goal_type,start_date,end_date,expected_amount,target_score")
        .lte("start_date", monthEndStr)
        .gte("end_date", monthStartStr)
        .order("start_date", { ascending: false });

    let { data: goals, error } = await selectGoals().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: goals, error } = await selectGoals());
    }

    if (error) throw error;

    const goalRows = (goals as Array<{
      id: string;
      title?: string | null;
      goal_type?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      expected_amount?: number | null;
      target_score?: number | null;
    }> | null) ?? [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 목표별 진행률 계산
    const goalsWithProgress = await Promise.all(
      goalRows.map(async (goal) => {
        const { getGoalProgress } = await import("@/lib/goals/queries");
        const { calculateGoalProgress } = await import("@/lib/goals/calc");
        const progressRows = await getGoalProgress(supabase, studentId, goal.id);
        const goalForCalc: import("@/lib/goals/calc").Goal = {
          id: goal.id,
          student_id: studentId,
          goal_type: (goal.goal_type ?? "range") as "range" | "exam" | "weekly" | "monthly" | "weak_subject",
          title: goal.title ?? "목표",
          description: null,
          subject: null,
          content_id: null,
          start_date: goal.start_date ?? new Date().toISOString().slice(0, 10),
          end_date: goal.end_date ?? new Date().toISOString().slice(0, 10),
          expected_amount: goal.expected_amount ?? null,
          target_score: goal.target_score ?? null,
          created_at: new Date().toISOString(),
        };
        const progress = calculateGoalProgress(goalForCalc, progressRows, today);

        return {
          id: goal.id,
          title: goal.title ?? "목표",
          goalType: goal.goal_type ?? "range",
          progressPercentage: progress.progressPercentage,
          status: progress.status,
        };
      })
    );

    const activeGoals = goalsWithProgress.filter((g) => g.status === "in_progress").length;
    const completedGoals = goalsWithProgress.filter((g) => g.status === "completed").length;
    const averageProgress =
      goalsWithProgress.length > 0
        ? Math.round(
            goalsWithProgress.reduce((sum, g) => sum + g.progressPercentage, 0) /
              goalsWithProgress.length
          )
        : 0;

    return {
      totalGoals: goalRows.length,
      activeGoals,
      completedGoals,
      averageProgress,
      goals: goalsWithProgress.slice(0, 10), // 최대 10개
    };
  } catch (error) {
    console.error("[reports/monthly] 목표 요약 조회 실패", error);
    return {
      totalGoals: 0,
      activeGoals: 0,
      completedGoals: 0,
      averageProgress: 0,
      goals: [],
    };
  }
}

/**
 * 월간 성적 변화 조회
 */
export async function getMonthlyScoreTrend(
  supabase: SupabaseServerClient,
  studentId: string,
  monthStart: Date,
  monthEnd: Date,
  lastMonthStart: Date,
  lastMonthEnd: Date
): Promise<MonthlyScoreTrend> {
  try {
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);
    const lastMonthStartStr = lastMonthStart.toISOString().slice(0, 10);
    const lastMonthEndStr = lastMonthEnd.toISOString().slice(0, 10);

    const selectScores = () =>
      supabase
        .from("student_scores")
        .select("subject_type,grade,raw_score,test_date")
        .order("test_date", { ascending: false });

    let { data: allScores, error } = await selectScores()
      .eq("student_id", studentId)
      .gte("test_date", lastMonthStartStr)
      .lte("test_date", monthEndStr);

    if (error && error.code === "42703") {
      ({ data: allScores, error } = await selectScores()
        .gte("test_date", lastMonthStartStr)
        .lte("test_date", monthEndStr));
    }

    if (error) throw error;

    const scoreRows = (allScores as Array<{
      subject_type?: string | null;
      grade?: number | null;
      raw_score?: number | null;
      test_date?: string | null;
    }> | null) ?? [];

    const thisMonth = scoreRows
      .filter((s) => s.test_date && s.test_date >= monthStartStr && s.test_date <= monthEndStr)
      .map((s) => ({
        subject: s.subject_type ?? "미지정",
        grade: s.grade ?? 9,
        rawScore: s.raw_score ?? 0,
        testDate: s.test_date ?? "",
      }));

    const lastMonth = scoreRows
      .filter(
        (s) => s.test_date && s.test_date >= lastMonthStartStr && s.test_date <= lastMonthEndStr
      )
      .map((s) => ({
        subject: s.subject_type ?? "미지정",
        grade: s.grade ?? 9,
        rawScore: s.raw_score ?? 0,
        testDate: s.test_date ?? "",
      }));

    // 트렌드 계산 (등급이 낮을수록 좋음)
    let trend: "improving" | "declining" | "stable" = "stable";
    if (thisMonth.length > 0 && lastMonth.length > 0) {
      const thisMonthAvg = thisMonth.reduce((sum, s) => sum + s.grade, 0) / thisMonth.length;
      const lastMonthAvg = lastMonth.reduce((sum, s) => sum + s.grade, 0) / lastMonth.length;
      if (thisMonthAvg < lastMonthAvg) {
        trend = "improving";
      } else if (thisMonthAvg > lastMonthAvg) {
        trend = "declining";
      }
    }

    return {
      thisMonth,
      lastMonth,
      trend,
    };
  } catch (error) {
    console.error("[reports/monthly] 성적 변화 조회 실패", error);
    return {
      thisMonth: [],
      lastMonth: [],
      trend: "stable",
    };
  }
}

/**
 * 월간 취약 과목 트렌드 조회
 */
export async function getMonthlyWeakSubjectTrend(
  supabase: SupabaseServerClient,
  studentId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyWeakSubjectTrend> {
  try {
    // 성적 기반 취약 과목 조회
    const { getRiskIndexBySubject } = await import("@/lib/scheduler/scoreLoader");
    const riskMap = await getRiskIndexBySubject(studentId);

    // 월간 학습시간 조회
    const studyTime = await getMonthlyStudyTime(supabase, studentId, monthStart, monthEnd);

    // 과목별 성적 변화 계산
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(monthEnd);
    lastMonthEnd.setMonth(lastMonthEnd.getMonth() - 1);

    const selectScores = () =>
      supabase
        .from("student_scores")
        .select("subject_type,grade,test_date")
        .order("test_date", { ascending: false });

    let { data: scores, error } = await selectScores()
      .eq("student_id", studentId)
      .gte("test_date", lastMonthStart.toISOString().slice(0, 10))
      .lte("test_date", monthEndStr);

    if (error && error.code === "42703") {
      ({ data: scores, error } = await selectScores()
        .gte("test_date", lastMonthStart.toISOString().slice(0, 10))
        .lte("test_date", monthEndStr));
    }

    const scoreRows = (scores as Array<{
      subject_type?: string | null;
      grade?: number | null;
      test_date?: string | null;
    }> | null) ?? [];

    // 과목별 최신 등급
    const subjectGrades = new Map<string, { thisMonth: number | null; lastMonth: number | null }>();
    scoreRows.forEach((s) => {
      if (!s.subject_type) return;
      const subject = s.subject_type;
      const grade = s.grade ?? null;
      const testDate = s.test_date ?? "";

      if (!subjectGrades.has(subject)) {
        subjectGrades.set(subject, { thisMonth: null, lastMonth: null });
      }

      const data = subjectGrades.get(subject)!;
      if (testDate >= monthStartStr && testDate <= monthEndStr) {
        if (data.thisMonth === null || grade !== null) {
          data.thisMonth = grade;
        }
      } else if (testDate >= lastMonthStart.toISOString().slice(0, 10) && testDate < monthStartStr) {
        if (data.lastMonth === null || grade !== null) {
          data.lastMonth = grade;
        }
      }
    });

    // 취약 과목 리스트 생성
    const subjects: MonthlyWeakSubjectTrend["subjects"] = Array.from(riskMap.entries())
      .filter(([_, risk]) => risk.riskScore >= 30)
      .map(([subject, risk]) => {
        const studyTimeData = studyTime.bySubject.find((s) => s.subject === subject);
        const grades = subjectGrades.get(subject);
        const scoreChange =
          grades && grades.thisMonth !== null && grades.lastMonth !== null
            ? grades.lastMonth - grades.thisMonth // 음수면 개선, 양수면 악화
            : null;

        return {
          subject,
          riskScore: risk.riskScore,
          studyTimeMinutes: studyTimeData?.minutes ?? 0,
          scoreChange,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5); // 상위 5개

    return { subjects };
  } catch (error) {
    console.error("[reports/monthly] 취약 과목 트렌드 조회 실패", error);
    return { subjects: [] };
  }
}

/**
 * 월간 콘텐츠 진행률 조회
 */
export async function getMonthlyContentProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyContentProgress> {
  try {
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    // 현재 진행률 조회
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress,last_updated");

    let { data: progressData, error } = await selectProgress().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: progressData, error } = await selectProgress());
    }

    if (error) throw error;

    const progressRows = (progressData as Array<{
      content_type?: string | null;
      content_id?: string | null;
      progress?: number | null;
      last_updated?: string | null;
    }> | null) ?? [];

    // 히스토리에서 이번 달 진행률 변화 조회
    const selectHistory = () =>
      supabase
        .from("student_history")
        .select("detail,created_at")
        .eq("event_type", "content_progress")
        .gte("created_at", monthStartStr)
        .lte("created_at", monthEndStr)
        .order("created_at", { ascending: false });

    let { data: historyData, error: historyError } = await selectHistory().eq("student_id", studentId);

    if (historyError && historyError.code === "42703") {
      ({ data: historyData, error: historyError } = await selectHistory());
    }

    // 콘텐츠 정보 조회
    const [books, lectures, custom] = await Promise.all([
      supabase.from("books").select("id,title,subject").eq("student_id", studentId),
      supabase.from("lectures").select("id,title,subject").eq("student_id", studentId),
      supabase
        .from("student_custom_contents")
        .select("id,title,subject")
        .eq("student_id", studentId),
    ]);

    const contentMap = new Map<string, { title: string; subject: string | null }>();
    (books.data ?? []).forEach((b: { id: string; title?: string | null; subject?: string | null }) => {
      contentMap.set(`book:${b.id}`, { title: b.title ?? "책", subject: b.subject ?? null });
    });
    (lectures.data ?? []).forEach((l: { id: string; title?: string | null; subject?: string | null }) => {
      contentMap.set(`lecture:${l.id}`, { title: l.title ?? "강의", subject: l.subject ?? null });
    });
    (custom.data ?? []).forEach((c: { id: string; title?: string | null; subject?: string | null }) => {
      contentMap.set(`custom:${c.id}`, { title: c.title ?? "커스텀", subject: c.subject ?? null });
    });

    // 진행률 변화 계산
    const progressChangeMap = new Map<string, number>();
    (historyData ?? []).forEach((h: { detail?: any; created_at?: string | null }) => {
      if (h.detail?.content_type && h.detail?.content_id && h.detail?.progress) {
        const key = `${h.detail.content_type}:${h.detail.content_id}`;
        const currentChange = progressChangeMap.get(key) ?? 0;
        progressChangeMap.set(key, Math.max(currentChange, h.detail.progress));
      }
    });

    // 진행률 리스트 생성
    const progressList: MonthlyContentProgress["progressList"] = progressRows
      .filter((p) => p.content_type && p.content_id)
      .map((p) => {
        const key = `${p.content_type}:${p.content_id}`;
        const contentInfo = contentMap.get(key) ?? { title: "콘텐츠", subject: null };
        const progressChange = progressChangeMap.get(key) ?? 0;

        return {
          contentType: (p.content_type as "book" | "lecture" | "custom") ?? "book",
          contentId: p.content_id ?? "",
          title: contentInfo.title,
          subject: contentInfo.subject,
          progress: p.progress ?? 0,
          progressChange,
        };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10); // 상위 10개

    return { progressList };
  } catch (error) {
    console.error("[reports/monthly] 콘텐츠 진행률 조회 실패", error);
    return { progressList: [] };
  }
}

/**
 * 월간 히스토리 조회
 */
export async function getMonthlyHistory(
  supabase: SupabaseServerClient,
  studentId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyHistory> {
  try {
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    const selectHistory = () =>
      supabase
        .from("student_history")
        .select("id,event_type,detail,created_at")
        .gte("created_at", monthStartStr)
        .lte("created_at", monthEndStr)
        .order("created_at", { ascending: false })
        .limit(10);

    let { data: historyData, error } = await selectHistory().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: historyData, error } = await selectHistory());
    }

    if (error) throw error;

    const historyRows = (historyData as Array<{
      id: string;
      event_type?: string | null;
      detail?: any;
      created_at?: string | null;
    }> | null) ?? [];

    return {
      events: historyRows.map((h) => ({
        id: h.id,
        eventType: h.event_type ?? "unknown",
        detail: h.detail ?? {},
        createdAt: h.created_at ?? "",
      })),
    };
  } catch (error) {
    console.error("[reports/monthly] 히스토리 조회 실패", error);
    return { events: [] };
  }
}

/**
 * 월간 리포트 데이터 통합 조회
 */
export async function getMonthlyReportData(
  supabase: SupabaseServerClient,
  studentId: string,
  monthDate: Date
): Promise<MonthlyReport> {
  try {
    // 이번 달 범위
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // 지난 달 범위
    const lastMonthStart = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    lastMonthStart.setHours(0, 0, 0, 0);
    const lastMonthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0);
    lastMonthEnd.setHours(23, 59, 59, 999);

    // 병렬 조회
    const [
      studyTime,
      planSummary,
      goalSummary,
      scoreTrend,
      weakSubjects,
      contentProgress,
      history,
      lastMonthStudyTime,
      lastMonthPlanSummary,
      lastMonthGoalSummary,
    ] = await Promise.all([
      getMonthlyStudyTime(supabase, studentId, monthStart, monthEnd),
      getMonthlyPlanSummary(supabase, studentId, monthStart, monthEnd),
      getMonthlyGoalSummary(supabase, studentId, monthStart, monthEnd),
      getMonthlyScoreTrend(supabase, studentId, monthStart, monthEnd, lastMonthStart, lastMonthEnd),
      getMonthlyWeakSubjectTrend(supabase, studentId, monthStart, monthEnd),
      getMonthlyContentProgress(supabase, studentId, monthStart, monthEnd),
      getMonthlyHistory(supabase, studentId, monthStart, monthEnd),
      getMonthlyStudyTime(supabase, studentId, lastMonthStart, lastMonthEnd),
      getMonthlyPlanSummary(supabase, studentId, lastMonthStart, lastMonthEnd),
      getMonthlyGoalSummary(supabase, studentId, lastMonthStart, lastMonthEnd),
    ]);

    // 강점/약점 과목 계산
    const strongSubjects = studyTime.bySubject
      .filter((s) => s.minutes > 0)
      .slice(0, 3)
      .map((s) => s.subject);
    const weakSubjectNames = weakSubjects.subjects.map((s) => s.subject);

    // 비교 데이터 계산
    const studyTimeChange = studyTime.totalMinutes - lastMonthStudyTime.totalMinutes;
    const completionRateChange = planSummary.completionRate - lastMonthPlanSummary.completionRate;
    const goalRateChange = goalSummary.averageProgress - lastMonthGoalSummary.averageProgress;

    const monthLabel = `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월`;

    return {
      period: {
        start: monthStart.toISOString().slice(0, 10),
        end: monthEnd.toISOString().slice(0, 10),
        monthLabel,
      },
      totals: {
        studyMinutes: studyTime.totalMinutes,
        completionRate: planSummary.completionRate,
        goalRate: goalSummary.averageProgress,
      },
      subjects: {
        strong: strongSubjects,
        weak: weakSubjectNames,
      },
      scores: scoreTrend,
      goals: goalSummary,
      content: contentProgress,
      history,
      comparison: {
        studyTimeChange,
        completionRateChange,
        goalRateChange,
      },
      // 그래프용 데이터
      studyTimeByWeek: studyTime.byWeek,
      planCompletionByWeek: planSummary.byWeek,
      studyTimeBySubject: studyTime.bySubject,
    };
  } catch (error) {
    console.error("[reports/monthly] 리포트 데이터 조회 실패", error);
    throw error;
  }
}

