import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getHabits } from "@/lib/domains/habit";
import { HabitList } from "./_components/HabitList";
import type { HabitWithLogs } from "@/lib/domains/habit/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "습관 트래커 | TimeLevelUp",
  description: "매일 꾸준히 실천하는 습관 관리",
};

export default async function HabitsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  const today = new Date().toISOString().split("T")[0];

  // 습관 목록 조회
  const habitsResult = await getHabits(user.userId);
  const habits = habitsResult.success ? habitsResult.data || [] : [];

  // 오늘 로그 조회
  const supabase = await createSupabaseServerClient();
  const habitIds = habits.map((h) => h.id);

  let todayLogs: Record<string, { completedCount: number; isCompleted: boolean }> = {};

  if (habitIds.length > 0) {
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("*")
      .in("habit_id", habitIds)
      .eq("log_date", today);

    if (logs) {
      todayLogs = logs.reduce(
        (acc, log) => {
          acc[log.habit_id] = {
            completedCount: log.completed_count,
            isCompleted: log.is_completed,
          };
          return acc;
        },
        {} as typeof todayLogs
      );
    }
  }

  // 습관에 오늘 로그 연결
  const habitsWithLogs: HabitWithLogs[] = habits.map((habit) => ({
    ...habit,
    logs: [],
    todayLog: todayLogs[habit.id]
      ? {
          id: "",
          habitId: habit.id,
          logDate: today,
          completedCount: todayLogs[habit.id].completedCount,
          isCompleted: todayLogs[habit.id].isCompleted,
          notes: null,
          createdAt: "",
          updatedAt: "",
        }
      : undefined,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">습관 트래커</h1>
          <p className="text-gray-500">매일 꾸준히 실천하세요</p>
        </header>

        {/* Habit List */}
        <HabitList
          habits={habitsWithLogs}
          studentId={user.userId}
          tenantId={tenantContext?.tenantId || ""}
          today={today}
        />
      </div>
    </div>
  );
}
