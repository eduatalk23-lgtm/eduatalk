
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TimeAnalysisView } from "./_components/TimeAnalysisView";
import { getContainerClass } from "@/lib/constants/layout";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function TimeAnalysisPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 오늘 날짜
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = today.toISOString().slice(0, 10);

  // 이번 주 범위 계산
  const weekStart = new Date(today);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // 이번 달 범위 계산
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  // 오늘의 시간 통계
  const { data: todayPlans } = await supabase
    .from("student_plan")
    .select("total_duration_seconds,paused_duration_seconds")
    .eq("student_id", user.id)
    .eq("plan_date", todayDate)
    .not("total_duration_seconds", "is", null);

  const todayStats = todayPlans?.reduce(
    (acc, plan) => {
      acc.totalSeconds += plan.total_duration_seconds || 0;
      acc.pausedSeconds += plan.paused_duration_seconds || 0;
      return acc;
    },
    { totalSeconds: 0, pausedSeconds: 0 }
  ) || { totalSeconds: 0, pausedSeconds: 0 };

  // 이번 주 시간 통계
  const { data: weekPlans } = await supabase
    .from("student_plan")
    .select("total_duration_seconds,paused_duration_seconds,content_type")
    .eq("student_id", user.id)
    .gte("plan_date", weekStartStr)
    .lte("plan_date", weekEndStr)
    .not("total_duration_seconds", "is", null);

  const weekStats = weekPlans?.reduce(
    (acc, plan) => {
      acc.totalSeconds += plan.total_duration_seconds || 0;
      acc.pausedSeconds += plan.paused_duration_seconds || 0;
      if (plan.content_type) {
        acc.byContentType[plan.content_type] =
          (acc.byContentType[plan.content_type] || 0) + (plan.total_duration_seconds || 0);
      }
      return acc;
    },
    {
      totalSeconds: 0,
      pausedSeconds: 0,
      byContentType: {} as Record<string, number>,
    }
  ) || {
    totalSeconds: 0,
    pausedSeconds: 0,
    byContentType: {},
  };

  // 이번 달 시간 통계
  const { data: monthPlans } = await supabase
    .from("student_plan")
    .select("total_duration_seconds,paused_duration_seconds,plan_date")
    .eq("student_id", user.id)
    .gte("plan_date", monthStartStr)
    .lte("plan_date", monthEndStr)
    .not("total_duration_seconds", "is", null);

  const monthStats = monthPlans?.reduce(
    (acc, plan) => {
      acc.totalSeconds += plan.total_duration_seconds || 0;
      acc.pausedSeconds += plan.paused_duration_seconds || 0;
      if (plan.plan_date) {
        const date = new Date(plan.plan_date);
        const dayOfWeek = date.getDay();
        acc.byDayOfWeek[dayOfWeek] =
          (acc.byDayOfWeek[dayOfWeek] || 0) + (plan.total_duration_seconds || 0);
      }
      return acc;
    },
    {
      totalSeconds: 0,
      pausedSeconds: 0,
      byDayOfWeek: {} as Record<number, number>,
    }
  ) || {
    totalSeconds: 0,
    pausedSeconds: 0,
    byDayOfWeek: {},
  };

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="시간 분석"
          description="학습 시간을 분석하고 패턴을 파악하세요"
        />

        <TimeAnalysisView
          todayStats={todayStats}
          weekStats={weekStats}
          monthStats={monthStats}
        />
      </div>
    </section>
  );
}

