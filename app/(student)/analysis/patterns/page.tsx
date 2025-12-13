export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PatternAnalysisView } from "./_components/PatternAnalysisView";

export default async function PatternAnalysisPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 최근 4주 데이터 조회
  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(today.getDate() - 28);
  fourWeeksAgo.setHours(0, 0, 0, 0);

  const startDate = fourWeeksAgo.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);

  // 최근 4주간의 플랜 및 시간 데이터 조회
  const { data: plans } = await supabase
    .from("student_plan")
    .select(
      "plan_date,total_duration_seconds,paused_duration_seconds,actual_start_time,actual_end_time,block_index"
    )
    .eq("student_id", user.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .not("total_duration_seconds", "is", null);

  // 요일별 통계 계산
  const byDayOfWeek: Record<number, { totalSeconds: number; planCount: number }> = {};
  const byHour: Record<number, number> = {};
  const byDate: Record<string, { totalSeconds: number; planCount: number }> = {};

  plans?.forEach((plan) => {
    if (!plan.plan_date) return;

    const date = new Date(plan.plan_date);
    const dayOfWeek = date.getDay();
    const dateStr = plan.plan_date;

    // 요일별 통계
    if (!byDayOfWeek[dayOfWeek]) {
      byDayOfWeek[dayOfWeek] = { totalSeconds: 0, planCount: 0 };
    }
    byDayOfWeek[dayOfWeek].totalSeconds += plan.total_duration_seconds || 0;
    byDayOfWeek[dayOfWeek].planCount += 1;

    // 날짜별 통계
    if (!byDate[dateStr]) {
      byDate[dateStr] = { totalSeconds: 0, planCount: 0 };
    }
    byDate[dateStr].totalSeconds += plan.total_duration_seconds || 0;
    byDate[dateStr].planCount += 1;

    // 시간대별 통계 (actual_start_time 기준)
    if (plan.actual_start_time) {
      const startTime = new Date(plan.actual_start_time);
      const hour = startTime.getHours();
      byHour[hour] = (byHour[hour] || 0) + (plan.total_duration_seconds || 0);
    }
  });

  // 가장 활발한 요일 찾기
  const mostActiveDay = Object.entries(byDayOfWeek).reduce(
    (max, [day, stats]) => {
      return stats.totalSeconds > max.totalSeconds
        ? { day: Number(day), ...stats }
        : max;
    },
    { day: 0, totalSeconds: 0, planCount: 0 }
  );

  // 가장 활발한 시간대 찾기
  const mostActiveHour = Object.entries(byHour).reduce(
    (max, [hour, seconds]) => {
      return seconds > max.seconds ? { hour: Number(hour), seconds } : max;
    },
    { hour: 0, seconds: 0 }
  );

  // 주간 평균 학습 시간 계산
  const weekCount = 4;
  const totalSeconds = Object.values(byDate).reduce(
    (sum, stats) => sum + stats.totalSeconds,
    0
  );
  const averageWeeklySeconds = totalSeconds / weekCount;

  // 최근 주간 학습 시간 추이
  const weeklyTrend: Array<{ week: number; totalSeconds: number }> = [];
  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (week * 7) - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const weekSeconds = Object.entries(byDate)
      .filter(([date]) => date >= weekStartStr && date <= weekEndStr)
      .reduce((sum, [, stats]) => sum + stats.totalSeconds, 0);

    weeklyTrend.push({
      week: 4 - week,
      totalSeconds: weekSeconds,
    });
  }

  // 학습 지연 감지 (최근 3일 평균 vs 이전 3일 평균)
  const recent3Days = Object.entries(byDate)
    .filter(([date]) => {
      const d = new Date(date);
      const daysDiff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff < 3;
    })
    .reduce((sum, [, stats]) => sum + stats.totalSeconds, 0) / 3;

  const previous3Days = Object.entries(byDate)
    .filter(([date]) => {
      const d = new Date(date);
      const daysDiff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 3 && daysDiff < 6;
    })
    .reduce((sum, [, stats]) => sum + stats.totalSeconds, 0) / 3;

  const delayPercentage =
    previous3Days > 0
      ? Math.round(((previous3Days - recent3Days) / previous3Days) * 100)
      : 0;

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900">학습 패턴 분석</h1>
        <p className="mt-2 text-sm text-gray-600">
          최근 4주간의 학습 패턴을 분석하고 개선점을 찾아보세요
        </p>
      </div>

      <PatternAnalysisView
        byDayOfWeek={byDayOfWeek}
        byHour={byHour}
        byDate={byDate}
        mostActiveDay={mostActiveDay}
        mostActiveHour={mostActiveHour}
        averageWeeklySeconds={averageWeeklySeconds}
        weeklyTrend={weeklyTrend}
        delayPercentage={delayPercentage}
        weekdays={weekdays}
      />
    </section>
  );
}

