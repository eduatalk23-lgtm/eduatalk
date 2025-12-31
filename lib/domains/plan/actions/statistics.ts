"use server";

/**
 * 학습 통계 Server Actions
 *
 * 학습 패턴 분석, 진행 통계, 시간 분석 등
 * 다양한 학습 인사이트를 제공합니다.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// Types
// ============================================

export type TimeRange = "week" | "month" | "quarter" | "year" | "all";

export type DailyStats = {
  date: string;
  planned: number;
  completed: number;
  totalMinutes: number;
  subjects: string[];
};

export type SubjectStats = {
  subject: string;
  totalPlans: number;
  completedPlans: number;
  completionRate: number;
  totalMinutes: number;
  averageMinutesPerPlan: number;
  trend: "improving" | "declining" | "stable";
};

export type WeeklyPattern = {
  dayOfWeek: number;
  dayName: string;
  averagePlans: number;
  averageCompletion: number;
  isStrongDay: boolean;
};

export type LearningStats = {
  summary: {
    totalPlans: number;
    completedPlans: number;
    pendingPlans: number;
    skippedPlans: number;
    completionRate: number;
    totalStudyMinutes: number;
    averageStudyMinutesPerDay: number;
    currentStreak: number;
    longestStreak: number;
    totalStudyDays: number;
  };
  daily: DailyStats[];
  bySubject: SubjectStats[];
  weeklyPattern: WeeklyPattern[];
  trends: {
    completionTrend: "improving" | "declining" | "stable";
    studyTimeTrend: "increasing" | "decreasing" | "stable";
    consistencyScore: number; // 0-100
  };
};

// ============================================
// Main Statistics Function
// ============================================

/**
 * 학습 통계 조회
 */
export async function getLearningStatistics(
  range: TimeRange = "month"
): Promise<{
  success: boolean;
  data?: LearningStats;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 기간 계산
    const startDate = getStartDate(range);
    const startDateStr = startDate.toISOString().split("T")[0];

    // 플랜 조회
    const { data: plans, error } = await supabase
      .from("student_plan")
      .select("*")
      .eq("student_id", user.userId)
      .gte("plan_date", startDateStr)
      .order("plan_date", { ascending: true });

    if (error) throw error;

    if (!plans || plans.length === 0) {
      return {
        success: true,
        data: getEmptyStats(),
      };
    }

    // 통계 계산
    const stats = calculateStats(plans, startDate);

    return { success: true, data: stats };
  } catch (error) {
    logActionError({ domain: "plan", action: "getLearningStatistics" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "통계를 불러오는 데 실패했습니다.",
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function getStartDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "week":
      return new Date(now.setDate(now.getDate() - 7));
    case "month":
      return new Date(now.setMonth(now.getMonth() - 1));
    case "quarter":
      return new Date(now.setMonth(now.getMonth() - 3));
    case "year":
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case "all":
      return new Date(2020, 0, 1); // 충분히 오래된 날짜
  }
}

function getEmptyStats(): LearningStats {
  return {
    summary: {
      totalPlans: 0,
      completedPlans: 0,
      pendingPlans: 0,
      skippedPlans: 0,
      completionRate: 0,
      totalStudyMinutes: 0,
      averageStudyMinutesPerDay: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalStudyDays: 0,
    },
    daily: [],
    bySubject: [],
    weeklyPattern: [
      { dayOfWeek: 0, dayName: "일", averagePlans: 0, averageCompletion: 0, isStrongDay: false },
      { dayOfWeek: 1, dayName: "월", averagePlans: 0, averageCompletion: 0, isStrongDay: false },
      { dayOfWeek: 2, dayName: "화", averagePlans: 0, averageCompletion: 0, isStrongDay: false },
      { dayOfWeek: 3, dayName: "수", averagePlans: 0, averageCompletion: 0, isStrongDay: false },
      { dayOfWeek: 4, dayName: "목", averagePlans: 0, averageCompletion: 0, isStrongDay: false },
      { dayOfWeek: 5, dayName: "금", averagePlans: 0, averageCompletion: 0, isStrongDay: false },
      { dayOfWeek: 6, dayName: "토", averagePlans: 0, averageCompletion: 0, isStrongDay: false },
    ],
    trends: {
      completionTrend: "stable",
      studyTimeTrend: "stable",
      consistencyScore: 0,
    },
  };
}

interface PlanRow {
  id: string;
  plan_date: string;
  status: string;
  content_subject: string | null;
  actual_duration: number | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
}

function calculateStats(plans: PlanRow[], startDate: Date): LearningStats {
  // 기본 집계
  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.status === "completed").length;
  const pendingPlans = plans.filter((p) => p.status === "pending").length;
  const skippedPlans = plans.filter(
    (p) => p.status === "skipped" || p.status === "cancelled"
  ).length;
  const completionRate = totalPlans > 0 ? (completedPlans / totalPlans) * 100 : 0;

  // 총 학습 시간
  let totalStudyMinutes = 0;
  for (const plan of plans) {
    if (plan.status === "completed") {
      totalStudyMinutes += plan.actual_duration || 0;
    }
  }

  // 일별 통계
  const dailyMap = new Map<string, DailyStats>();
  for (const plan of plans) {
    const date = plan.plan_date;
    const existing = dailyMap.get(date) || {
      date,
      planned: 0,
      completed: 0,
      totalMinutes: 0,
      subjects: [],
    };

    existing.planned++;
    if (plan.status === "completed") {
      existing.completed++;
      existing.totalMinutes += plan.actual_duration || 0;
    }
    if (plan.content_subject && !existing.subjects.includes(plan.content_subject)) {
      existing.subjects.push(plan.content_subject);
    }

    dailyMap.set(date, existing);
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 학습일 수와 일 평균
  const totalStudyDays = daily.filter((d) => d.completed > 0).length;
  const averageStudyMinutesPerDay =
    totalStudyDays > 0 ? totalStudyMinutes / totalStudyDays : 0;

  // 스트릭 계산
  const { currentStreak, longestStreak } = calculateStreaks(daily);

  // 과목별 통계
  const subjectMap = new Map<string, { total: number; completed: number; minutes: number }>();
  for (const plan of plans) {
    const subject = plan.content_subject || "기타";
    const existing = subjectMap.get(subject) || { total: 0, completed: 0, minutes: 0 };
    existing.total++;
    if (plan.status === "completed") {
      existing.completed++;
      existing.minutes += plan.actual_duration || 0;
    }
    subjectMap.set(subject, existing);
  }

  const bySubject: SubjectStats[] = Array.from(subjectMap.entries())
    .map(([subject, stats]) => ({
      subject,
      totalPlans: stats.total,
      completedPlans: stats.completed,
      completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
      totalMinutes: stats.minutes,
      averageMinutesPerPlan: stats.completed > 0 ? stats.minutes / stats.completed : 0,
      trend: "stable" as const, // TODO: 시계열 분석
    }))
    .sort((a, b) => b.totalPlans - a.totalPlans);

  // 요일별 패턴
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const weekdayStats = new Map<number, { total: number; completed: number; count: number }>();

  for (const plan of plans) {
    const dayOfWeek = new Date(plan.plan_date).getDay();
    const existing = weekdayStats.get(dayOfWeek) || { total: 0, completed: 0, count: 0 };
    existing.total++;
    if (plan.status === "completed") existing.completed++;
    weekdayStats.set(dayOfWeek, existing);
  }

  // 각 요일별 주 수 계산
  const weekCount = Math.ceil(
    (new Date().getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  const weeklyPattern: WeeklyPattern[] = dayNames.map((name, index) => {
    const stats = weekdayStats.get(index) || { total: 0, completed: 0 };
    const avgPlans = weekCount > 0 ? stats.total / weekCount : 0;
    const avgCompletion =
      stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return {
      dayOfWeek: index,
      dayName: name,
      averagePlans: avgPlans,
      averageCompletion: avgCompletion,
      isStrongDay: avgCompletion >= 80,
    };
  });

  // 트렌드 분석
  const trends = analyzeTrends(daily);

  return {
    summary: {
      totalPlans,
      completedPlans,
      pendingPlans,
      skippedPlans,
      completionRate,
      totalStudyMinutes,
      averageStudyMinutesPerDay,
      currentStreak,
      longestStreak,
      totalStudyDays,
    },
    daily,
    bySubject,
    weeklyPattern,
    trends,
  };
}

function calculateStreaks(daily: DailyStats[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (daily.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // 완료된 날짜만 추출
  const completedDates = new Set(
    daily.filter((d) => d.completed > 0).map((d) => d.date)
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // 오늘부터 역순으로 스트릭 계산
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (completedDates.has(dateStr)) {
      tempStreak++;
      if (i === 0 || currentStreak > 0) {
        currentStreak = tempStreak;
      }
    } else {
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      if (currentStreak === 0) {
        // 현재 스트릭이 시작되지 않았으면 계속
        tempStreak = 0;
      } else {
        break; // 현재 스트릭 종료
      }
    }
  }

  if (tempStreak > longestStreak) {
    longestStreak = tempStreak;
  }

  return { currentStreak, longestStreak };
}

function analyzeTrends(daily: DailyStats[]): LearningStats["trends"] {
  if (daily.length < 7) {
    return {
      completionTrend: "stable",
      studyTimeTrend: "stable",
      consistencyScore: 0,
    };
  }

  // 최근 7일 vs 이전 7일 비교
  const recentWeek = daily.slice(-7);
  const previousWeek = daily.slice(-14, -7);

  const recentCompletion =
    recentWeek.reduce((sum, d) => sum + d.completed, 0) /
    Math.max(recentWeek.reduce((sum, d) => sum + d.planned, 0), 1);

  const previousCompletion =
    previousWeek.length > 0
      ? previousWeek.reduce((sum, d) => sum + d.completed, 0) /
        Math.max(previousWeek.reduce((sum, d) => sum + d.planned, 0), 1)
      : recentCompletion;

  const recentMinutes = recentWeek.reduce((sum, d) => sum + d.totalMinutes, 0);
  const previousMinutes =
    previousWeek.length > 0
      ? previousWeek.reduce((sum, d) => sum + d.totalMinutes, 0)
      : recentMinutes;

  // 완료율 트렌드
  let completionTrend: "improving" | "declining" | "stable" = "stable";
  if (recentCompletion > previousCompletion * 1.1) {
    completionTrend = "improving";
  } else if (recentCompletion < previousCompletion * 0.9) {
    completionTrend = "declining";
  }

  // 학습 시간 트렌드
  let studyTimeTrend: "increasing" | "decreasing" | "stable" = "stable";
  if (recentMinutes > previousMinutes * 1.1) {
    studyTimeTrend = "increasing";
  } else if (recentMinutes < previousMinutes * 0.9) {
    studyTimeTrend = "decreasing";
  }

  // 일관성 점수 (0-100)
  const activeDays = daily.filter((d) => d.completed > 0).length;
  const totalDays = daily.length;
  const consistencyScore = Math.round((activeDays / Math.max(totalDays, 1)) * 100);

  return {
    completionTrend,
    studyTimeTrend,
    consistencyScore,
  };
}

// ============================================
// Additional Statistics Functions
// ============================================

/**
 * 특정 과목의 상세 통계
 */
export async function getSubjectDetailStats(
  subject: string,
  range: TimeRange = "month"
): Promise<{
  success: boolean;
  data?: {
    subject: string;
    totalPlans: number;
    completedPlans: number;
    averageDuration: number;
    dailyProgress: Array<{ date: string; completed: number; minutes: number }>;
    contentBreakdown: Array<{ contentId: string; title: string; completed: number; total: number }>;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();
    const startDate = getStartDate(range);

    const { data: plans, error } = await supabase
      .from("student_plan")
      .select("*")
      .eq("student_id", user.userId)
      .eq("content_subject", subject)
      .gte("plan_date", startDate.toISOString().split("T")[0]);

    if (error) throw error;

    if (!plans || plans.length === 0) {
      return {
        success: true,
        data: {
          subject,
          totalPlans: 0,
          completedPlans: 0,
          averageDuration: 0,
          dailyProgress: [],
          contentBreakdown: [],
        },
      };
    }

    // 기본 통계
    const totalPlans = plans.length;
    const completedPlans = plans.filter((p) => p.status === "completed").length;
    const totalDuration = plans
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + (p.actual_duration || 0), 0);
    const averageDuration = completedPlans > 0 ? totalDuration / completedPlans : 0;

    // 일별 진행
    const dailyMap = new Map<string, { completed: number; minutes: number }>();
    for (const plan of plans) {
      const existing = dailyMap.get(plan.plan_date) || { completed: 0, minutes: 0 };
      if (plan.status === "completed") {
        existing.completed++;
        existing.minutes += plan.actual_duration || 0;
      }
      dailyMap.set(plan.plan_date, existing);
    }

    const dailyProgress = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 콘텐츠별 분석
    const contentMap = new Map<string, { title: string; completed: number; total: number }>();
    for (const plan of plans) {
      const contentId = plan.content_id || "unknown";
      const existing = contentMap.get(contentId) || {
        title: plan.content_title || "콘텐츠",
        completed: 0,
        total: 0,
      };
      existing.total++;
      if (plan.status === "completed") existing.completed++;
      contentMap.set(contentId, existing);
    }

    const contentBreakdown = Array.from(contentMap.entries())
      .map(([contentId, stats]) => ({ contentId, ...stats }))
      .sort((a, b) => b.total - a.total);

    return {
      success: true,
      data: {
        subject,
        totalPlans,
        completedPlans,
        averageDuration,
        dailyProgress,
        contentBreakdown,
      },
    };
  } catch (error) {
    logActionError({ domain: "plan", action: "getSubjectDetailStats" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "통계를 불러오는 데 실패했습니다.",
    };
  }
}

/**
 * 목표 대비 진행률 조회
 */
export async function getGoalProgress(): Promise<{
  success: boolean;
  data?: {
    weeklyGoal: { target: number; current: number; percentage: number };
    monthlyGoal: { target: number; current: number; percentage: number };
    planGroupProgress: Array<{
      id: string;
      name: string;
      totalPlans: number;
      completedPlans: number;
      percentage: number;
      daysRemaining: number;
    }>;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 이번 주 목표 (기본: 주 20개 플랜)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { data: weeklyPlans } = await supabase
      .from("student_plan")
      .select("status")
      .eq("student_id", user.userId)
      .gte("plan_date", weekStartStr);

    const weeklyCompleted = weeklyPlans?.filter((p) => p.status === "completed").length ?? 0;
    const weeklyTarget = 20;

    // 이번 달 목표 (기본: 월 80개 플랜)
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    const { data: monthlyPlans } = await supabase
      .from("student_plan")
      .select("status")
      .eq("student_id", user.userId)
      .gte("plan_date", monthStartStr);

    const monthlyCompleted = monthlyPlans?.filter((p) => p.status === "completed").length ?? 0;
    const monthlyTarget = 80;

    // 활성 플랜그룹 진행률
    const { data: planGroups } = await supabase
      .from("plan_groups")
      .select("id, name, period_end")
      .eq("student_id", user.userId)
      .eq("status", "active")
      .is("deleted_at", null);

    const planGroupProgress: Array<{
      id: string;
      name: string;
      totalPlans: number;
      completedPlans: number;
      percentage: number;
      daysRemaining: number;
    }> = [];

    if (planGroups) {
      for (const pg of planGroups) {
        const { data: pgPlans } = await supabase
          .from("student_plan")
          .select("status")
          .eq("plan_group_id", pg.id)
          .eq("is_active", true);

        if (pgPlans) {
          const total = pgPlans.length;
          const completed = pgPlans.filter((p) => p.status === "completed").length;
          const endDate = new Date(pg.period_end);
          const today = new Date();
          const daysRemaining = Math.max(
            0,
            Math.ceil((endDate.getTime() - today.getTime()) / 86400000)
          );

          planGroupProgress.push({
            id: pg.id,
            name: pg.name || "플랜그룹",
            totalPlans: total,
            completedPlans: completed,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            daysRemaining,
          });
        }
      }
    }

    return {
      success: true,
      data: {
        weeklyGoal: {
          target: weeklyTarget,
          current: weeklyCompleted,
          percentage: Math.round((weeklyCompleted / weeklyTarget) * 100),
        },
        monthlyGoal: {
          target: monthlyTarget,
          current: monthlyCompleted,
          percentage: Math.round((monthlyCompleted / monthlyTarget) * 100),
        },
        planGroupProgress: planGroupProgress.sort((a, b) => b.percentage - a.percentage),
      },
    };
  } catch (error) {
    logActionError({ domain: "plan", action: "getGoalProgress" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "진행률을 불러오는 데 실패했습니다.",
    };
  }
}
