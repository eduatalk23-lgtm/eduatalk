import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionsByDateRange } from "@/lib/studySessions/queries";
import { getSubjectFromContent } from "@/lib/studySessions/summary";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 주간 플랜 요약
export type WeeklyPlanSummary = {
  totalPlans: number;
  completedPlans: number;
  completionRate: number; // 0-100
  byDay: Array<{
    date: string;
    dayOfWeek: string;
    totalPlans: number;
    completedPlans: number;
    completionRate: number;
  }>;
  byBlock: Array<{
    blockIndex: number;
    totalPlans: number;
    completedPlans: number;
  }>;
};

// 주간 학습시간 요약
export type WeeklyStudyTimeSummary = {
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  byDay: Array<{
    date: string;
    dayOfWeek: string;
    seconds: number;
    minutes: number;
  }>;
  bySubject: Array<{
    subject: string;
    seconds: number;
    minutes: number;
    percentage: number;
  }>;
  byContentType: Array<{
    contentType: "book" | "lecture" | "custom";
    seconds: number;
    minutes: number;
    percentage: number;
  }>;
};

// 주간 목표 진행률
export type WeeklyGoalProgress = {
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
    daysRemaining: number | null;
    weeklyProgressAmount: number; // 이번 주 증가량
  }>;
};

// 취약과목 경향
export type WeeklyWeakSubjectTrend = {
  subjects: Array<{
    subject: string;
    riskScore: number; // 0-100
    trend: "improving" | "declining" | "stable";
    reason: string;
    studyTimeMinutes: number; // 이번 주 학습시간
    studyTimeChange: number; // 지난주 대비 변화 (분)
    scoreChange: number | null; // 최근 성적 변화
  }>;
};

// 일별 상세 분석
export type DailyBreakdown = Array<{
  date: string;
  dayOfWeek: string;
  studyTimeMinutes: number;
  totalPlans: number;
  completedPlans: number;
  completionRate: number;
  contents: Array<{
    contentType: "book" | "lecture" | "custom";
    contentTitle: string;
    subject: string | null;
    studyTimeMinutes: number;
  }>;
}>;

/**
 * 주간 플랜 요약 조회
 */
export async function getWeeklyPlanSummary(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyPlanSummary> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,plan_date,block_index,completed_amount")
        .gte("plan_date", weekStartStr)
        .lte("plan_date", weekEndStr)
        .order("plan_date", { ascending: true });

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: plans, error } = await selectPlans());
    }

    if (error) throw error;

    const planRows = (plans as Array<{
      id: string;
      plan_date?: string | null;
      block_index?: number | null;
      completed_amount?: number | null;
    }> | null) ?? [];

    // 진행률 조회
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress");

    let { data: progressData, error: progressError } = await selectProgress().eq(
      "student_id",
      studentId
    );

    if (progressError && progressError.code === "42703") {
      ({ data: progressData, error: progressError } = await selectProgress());
    }

    // 플랜별 진행률 매핑 (간단화: completed_amount 기준)
    const completedPlans = planRows.filter(
      (plan) => plan.completed_amount !== null && plan.completed_amount !== undefined && plan.completed_amount > 0
    ).length;

    // 날짜별 집계
    const dayMap = new Map<string, { total: number; completed: number }>();
    const blockMap = new Map<number, { total: number; completed: number }>();

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

    planRows.forEach((plan) => {
      if (!plan.plan_date) return;

      const dayKey = plan.plan_date;
      const dayData = dayMap.get(dayKey) ?? { total: 0, completed: 0 };
      dayData.total++;
      if (plan.completed_amount !== null && plan.completed_amount !== undefined && plan.completed_amount > 0) {
        dayData.completed++;
      }
      dayMap.set(dayKey, dayData);

      const blockIndex = plan.block_index ?? 0;
      const blockData = blockMap.get(blockIndex) ?? { total: 0, completed: 0 };
      blockData.total++;
      if (plan.completed_amount !== null && plan.completed_amount !== undefined && plan.completed_amount > 0) {
        blockData.completed++;
      }
      blockMap.set(blockIndex, blockData);
    });

    // 날짜별 배열 생성
    const byDay: WeeklyPlanSummary["byDay"] = [];
    const currentDate = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const dayData = dayMap.get(dateStr) ?? { total: 0, completed: 0 };
      const dayOfWeek = currentDate.getDay();
      
      byDay.push({
        date: dateStr,
        dayOfWeek: dayNames[dayOfWeek],
        totalPlans: dayData.total,
        completedPlans: dayData.completed,
        completionRate: dayData.total > 0 ? Math.round((dayData.completed / dayData.total) * 100) : 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 블록별 배열 생성
    const byBlock: WeeklyPlanSummary["byBlock"] = Array.from(blockMap.entries())
      .map(([blockIndex, data]) => ({
        blockIndex,
        totalPlans: data.total,
        completedPlans: data.completed,
      }))
      .sort((a, b) => a.blockIndex - b.blockIndex);

    return {
      totalPlans: planRows.length,
      completedPlans,
      completionRate: planRows.length > 0 ? Math.round((completedPlans / planRows.length) * 100) : 0,
      byDay,
      byBlock,
    };
  } catch (error) {
    console.error("[reports/weekly] 플랜 요약 조회 실패", error);
    return {
      totalPlans: 0,
      completedPlans: 0,
      completionRate: 0,
      byDay: [],
      byBlock: [],
    };
  }
}

/**
 * 주간 학습시간 요약 조회
 */
export async function getWeeklyStudyTimeSummary(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyStudyTimeSummary> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const sessions = await getSessionsByDateRange(supabase, studentId, weekStartStr, weekEndStr);

    let totalSeconds = 0;
    const byDayMap = new Map<string, number>();
    const bySubjectMap = new Map<string, number>();
    const byContentTypeMap = new Map<string, number>();

    // 세션별 집계
    for (const session of sessions) {
      if (!session.duration_seconds) continue;

      totalSeconds += session.duration_seconds;

      // 날짜별 집계
      const sessionDate = new Date(session.started_at).toISOString().slice(0, 10);
      byDayMap.set(sessionDate, (byDayMap.get(sessionDate) || 0) + session.duration_seconds);

      // 과목별 집계
      let subject: string | null = null;
      if (session.plan_id) {
        const plan = await getPlanInfo(supabase, studentId, session.plan_id);
        if (plan) {
          subject = await getSubjectFromContent(
            supabase,
            studentId,
            plan.content_type,
            plan.content_id
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

      // 콘텐츠 타입별 집계
      const contentType = session.content_type || "custom";
      byContentTypeMap.set(
        contentType,
        (byContentTypeMap.get(contentType) || 0) + session.duration_seconds
      );
    }

    // 날짜별 배열 생성
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const byDay: WeeklyStudyTimeSummary["byDay"] = [];
    const currentDate = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const seconds = byDayMap.get(dateStr) || 0;
      const dayOfWeek = currentDate.getDay();

      byDay.push({
        date: dateStr,
        dayOfWeek: dayNames[dayOfWeek],
        seconds,
        minutes: Math.floor(seconds / 60),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 과목별 배열 생성
    const bySubject: WeeklyStudyTimeSummary["bySubject"] = Array.from(bySubjectMap.entries())
      .map(([subject, seconds]) => ({
        subject,
        seconds,
        minutes: Math.floor(seconds / 60),
        percentage: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    // 콘텐츠 타입별 배열 생성
    const contentTypeLabels: Record<string, "book" | "lecture" | "custom"> = {
      book: "book",
      lecture: "lecture",
      custom: "custom",
    };

    const byContentType: WeeklyStudyTimeSummary["byContentType"] = Array.from(
      byContentTypeMap.entries()
    )
      .map(([contentType, seconds]) => ({
        contentType: contentTypeLabels[contentType] || "custom",
        seconds,
        minutes: Math.floor(seconds / 60),
        percentage: totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    return {
      totalSeconds,
      totalMinutes: Math.floor(totalSeconds / 60),
      totalHours: Math.floor(totalSeconds / 3600),
      byDay,
      bySubject,
      byContentType,
    };
  } catch (error) {
    console.error("[reports/weekly] 학습시간 요약 조회 실패", error);
    return {
      totalSeconds: 0,
      totalMinutes: 0,
      totalHours: 0,
      byDay: [],
      bySubject: [],
      byContentType: [],
    };
  }
}

/**
 * 주간 목표 진행률 조회
 */
export async function getWeeklyGoalProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyGoalProgress> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { calculateGoalProgress } = await import("@/lib/goals/calc");
    const { getWeekGoals, getGoalProgress } = await import("@/lib/goals/queries");

    const goals = await getWeekGoals(supabase, studentId, weekStartStr, weekEndStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progressRows = await getGoalProgress(supabase, studentId, goal.id);
        const progress = calculateGoalProgress(goal, progressRows, today);

        // 이번 주 진행량 계산
        const weekProgressRows = progressRows.filter((p) => {
          if (!p.recorded_at) return false;
          const recordedDate = new Date(p.recorded_at).toISOString().slice(0, 10);
          return recordedDate >= weekStartStr && recordedDate <= weekEndStr;
        });

        const weeklyProgressAmount = weekProgressRows.reduce(
          (sum, p) => sum + (p.progress_amount || 0),
          0
        );

        return {
          id: goal.id,
          title: goal.title,
          goalType: goal.goal_type,
          progressPercentage: progress.progressPercentage,
          status:
            progress.status === "scheduled"
              ? ("scheduled" as const)
              : progress.status === "in_progress"
              ? ("in_progress" as const)
              : progress.status === "completed"
              ? ("completed" as const)
              : ("failed" as const),
          daysRemaining: progress.daysRemaining,
          weeklyProgressAmount,
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
      totalGoals: goals.length,
      activeGoals,
      completedGoals,
      averageProgress,
      goals: goalsWithProgress,
    };
  } catch (error) {
    console.error("[reports/weekly] 목표 진행률 조회 실패", error);
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
 * 주간 취약과목 경향 분석
 */
export async function getWeeklyWeakSubjectTrend(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyWeakSubjectTrend> {
  try {
    // 지난 주 범위 계산
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(weekEnd.getDate() - 7);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
    const lastWeekEndStr = lastWeekEnd.toISOString().slice(0, 10);

    // 이번 주 학습시간
    const thisWeekSessions = await getSessionsByDateRange(
      supabase,
      studentId,
      weekStartStr,
      weekEndStr
    );
    const lastWeekSessions = await getSessionsByDateRange(
      supabase,
      studentId,
      lastWeekStartStr,
      lastWeekEndStr
    );

    // 과목별 학습시간 계산
    const thisWeekBySubject = new Map<string, number>();
    const lastWeekBySubject = new Map<string, number>();

    for (const session of thisWeekSessions) {
      if (!session.duration_seconds) continue;
      let subject: string | null = null;
      if (session.plan_id) {
        const plan = await getPlanInfo(supabase, studentId, session.plan_id);
        if (plan) {
          subject = await getSubjectFromContent(
            supabase,
            studentId,
            plan.content_type,
            plan.content_id
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
        thisWeekBySubject.set(
          subject,
          (thisWeekBySubject.get(subject) || 0) + session.duration_seconds
        );
      }
    }

    for (const session of lastWeekSessions) {
      if (!session.duration_seconds) continue;
      let subject: string | null = null;
      if (session.plan_id) {
        const plan = await getPlanInfo(supabase, studentId, session.plan_id);
        if (plan) {
          subject = await getSubjectFromContent(
            supabase,
            studentId,
            plan.content_type,
            plan.content_id
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
        lastWeekBySubject.set(
          subject,
          (lastWeekBySubject.get(subject) || 0) + session.duration_seconds
        );
      }
    }

    // 분석 데이터 조회
    const selectAnalysis = () =>
      supabase
        .from("student_analysis")
        .select("subject,risk_score,recent_grade_trend")
        .order("risk_score", { ascending: false });

    let { data: analyses, error } = await selectAnalysis().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: analyses, error } = await selectAnalysis());
    }

    const analysisRows = (analyses as Array<{
      subject?: string | null;
      risk_score?: number | null;
      recent_grade_trend?: number | null;
    }> | null) ?? [];

    // 성적 데이터 조회 (최근 변화 추적)
    const selectScores = () =>
      supabase
        .from("student_school_scores")
        .select("subject_group,grade_score,test_date")
        .order("test_date", { ascending: false })
        .limit(20);

    let { data: scores, error: scoreError } = await selectScores().eq("student_id", studentId);

    if (scoreError && scoreError.code === "42703") {
      ({ data: scores, error: scoreError } = await selectScores());
    }

    const scoreRows = (scores as Array<{
      subject_group?: string | null;
      grade_score?: number | null;
      test_date?: string | null;
    }> | null) ?? [];

    // 과목별 최근 성적 변화 계산
    const subjectScoreMap = new Map<string, Array<{ grade: number; date: string }>>();
    scoreRows.forEach((score) => {
      if (!score.subject_group || score.grade_score === null || score.grade_score === undefined) return;
      const existing = subjectScoreMap.get(score.subject_group) || [];
      existing.push({ grade: score.grade_score, date: score.test_date || "" });
      subjectScoreMap.set(score.subject_group, existing);
    });

    // 취약과목 리스트 생성
    const subjects: WeeklyWeakSubjectTrend["subjects"] = [];

    analysisRows.forEach((analysis) => {
      if (!analysis.subject || analysis.risk_score === null || analysis.risk_score === undefined) return;

      const thisWeekMinutes = Math.floor((thisWeekBySubject.get(analysis.subject) || 0) / 60);
      const lastWeekMinutes = Math.floor((lastWeekBySubject.get(analysis.subject) || 0) / 60);
      const studyTimeChange = thisWeekMinutes - lastWeekMinutes;

      // 성적 변화 계산
      const recentScores = subjectScoreMap.get(analysis.subject) || [];
      let scoreChange: number | null = null;
      if (recentScores.length >= 2) {
        const sorted = recentScores.sort((a, b) => b.date.localeCompare(a.date));
        scoreChange = sorted[0].grade - sorted[sorted.length - 1].grade;
      }

      // 트렌드 판단
      let trend: "improving" | "declining" | "stable" = "stable";
      if (analysis.recent_grade_trend !== null && analysis.recent_grade_trend !== undefined) {
        if (analysis.recent_grade_trend < 0) {
          trend = "improving"; // 등급 하락 = 개선
        } else if (analysis.recent_grade_trend > 0) {
          trend = "declining"; // 등급 상승 = 하락
        }
      }

      // 이유 생성
      let reason = "";
      if (analysis.risk_score >= 70) {
        reason = "매우 위험 - 즉시 집중 학습 필요";
      } else if (analysis.risk_score >= 50) {
        reason = "위험 - 집중 학습 권장";
      } else {
        reason = "주의 필요";
      }

      if (studyTimeChange < -30) {
        reason += " (학습시간 감소)";
      } else if (trend === "declining") {
        reason += " (성적 하락)";
      }

      subjects.push({
        subject: analysis.subject,
        riskScore: analysis.risk_score,
        trend,
        reason,
        studyTimeMinutes: thisWeekMinutes,
        studyTimeChange,
        scoreChange,
      });
    });

    // 위험도 순으로 정렬하고 상위 3개만 반환
    return {
      subjects: subjects.sort((a, b) => b.riskScore - a.riskScore).slice(0, 3),
    };
  } catch (error) {
    console.error("[reports/weekly] 취약과목 경향 조회 실패", error);
    return { subjects: [] };
  }
}

/**
 * 일별 상세 분석
 */
export async function getDailyBreakdown(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<DailyBreakdown> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const [sessions, plans] = await Promise.all([
      getSessionsByDateRange(supabase, studentId, weekStartStr, weekEndStr),
      getPlansForWeek(supabase, studentId, weekStartStr, weekEndStr),
    ]);

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const breakdown: DailyBreakdown = [];

    const currentDate = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const dayOfWeek = currentDate.getDay();

      // 해당 날짜의 세션
      const daySessions = sessions.filter((s) => {
        const sessionDate = new Date(s.started_at).toISOString().slice(0, 10);
        return sessionDate === dateStr;
      });

      // 해당 날짜의 플랜
      const dayPlans = plans.filter((p) => p.plan_date === dateStr);
      const completedPlans = dayPlans.filter(
        (p) => p.completed_amount !== null && p.completed_amount > 0
      ).length;

      // 학습시간 계산
      const studyTimeSeconds = daySessions.reduce(
        (sum, s) => sum + (s.duration_seconds || 0),
        0
      );

      // 콘텐츠 리스트 생성
      const contentsMap = new Map<string, {
        contentType: "book" | "lecture" | "custom";
        contentTitle: string;
        subject: string | null;
        studyTimeSeconds: number;
      }>();

      for (const session of daySessions) {
        if (!session.duration_seconds) continue;

        let contentType: "book" | "lecture" | "custom" = "custom";
        let contentId: string | null = null;
        let subject: string | null = null;

        if (session.plan_id) {
          const plan = await getPlanInfo(supabase, studentId, session.plan_id);
          if (plan) {
            contentType = plan.content_type;
            contentId = plan.content_id;
            subject = await getSubjectFromContent(supabase, studentId, contentType, contentId);
          }
        } else if (session.content_type && session.content_id) {
          contentType = session.content_type as "book" | "lecture" | "custom";
          contentId = session.content_id;
          subject = await getSubjectFromContent(supabase, studentId, contentType, contentId);
        }

        if (contentId) {
          const contentTitle = await getContentTitle(
            supabase,
            studentId,
            contentType,
            contentId
          );
          const key = `${contentType}:${contentId}`;
          const existing = contentsMap.get(key) || {
            contentType,
            contentTitle,
            subject,
            studyTimeSeconds: 0,
          };
          existing.studyTimeSeconds += session.duration_seconds;
          contentsMap.set(key, existing);
        }
      }

      const contents = Array.from(contentsMap.values()).map((c) => ({
        ...c,
        studyTimeMinutes: Math.floor(c.studyTimeSeconds / 60),
      }));

      breakdown.push({
        date: dateStr,
        dayOfWeek: dayNames[dayOfWeek],
        studyTimeMinutes: Math.floor(studyTimeSeconds / 60),
        totalPlans: dayPlans.length,
        completedPlans,
        completionRate: dayPlans.length > 0 ? Math.round((completedPlans / dayPlans.length) * 100) : 0,
        contents,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return breakdown;
  } catch (error) {
    console.error("[reports/weekly] 일별 상세 분석 실패", error);
    return [];
  }
}

// 헬퍼 함수들
async function getPlanInfo(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<{ content_type: "book" | "lecture" | "custom"; content_id: string } | null> {
  try {
    const selectPlan = () =>
      supabase.from("student_plan").select("content_type,content_id").eq("id", planId);

    let { data: plan, error } = await selectPlan().eq("student_id", studentId).maybeSingle();

    if (error && error.code === "42703") {
      ({ data: plan, error } = await selectPlan().maybeSingle());
    }

    if (error || !plan || !plan.content_type || !plan.content_id) {
      return null;
    }

    return {
      content_type: plan.content_type as "book" | "lecture" | "custom",
      content_id: plan.content_id,
    };
  } catch (error) {
    return null;
  }
}

async function getPlansForWeek(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: string,
  weekEnd: string
): Promise<Array<{ plan_date: string; completed_amount: number | null }>> {
  try {
    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("plan_date,completed_amount")
        .gte("plan_date", weekStart)
        .lte("plan_date", weekEnd);

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: plans, error } = await selectPlans());
    }

    return (plans as Array<{ plan_date: string; completed_amount: number | null }> | null) ?? [];
  } catch (error) {
    return [];
  }
}

async function getContentTitle(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: "book" | "lecture" | "custom",
  contentId: string
): Promise<string> {
  try {
    const tableName =
      contentType === "book"
        ? "books"
        : contentType === "lecture"
        ? "lectures"
        : "student_custom_contents";

    const selectContent = () =>
      supabase.from(tableName).select("title").eq("id", contentId);

    let { data, error } = await selectContent().eq("student_id", studentId).maybeSingle();

    if (error && error.code === "42703") {
      ({ data, error } = await selectContent().maybeSingle());
    }

    if (error || !data) {
      return "제목 없음";
    }

    return (data as { title: string | null }).title || "제목 없음";
  } catch (error) {
    return "제목 없음";
  }
}

