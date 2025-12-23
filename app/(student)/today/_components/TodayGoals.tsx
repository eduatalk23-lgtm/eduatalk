import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { cn } from "@/lib/cn";
import {
  cardBase,
  bgPage,
  textPrimary,
  textSecondary,
  textMuted,
  textTertiary,
  borderDefault,
} from "@/lib/utils/darkMode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchGoalsSummary } from "@/lib/goals/queries";
import { formatDateString } from "@/lib/date/calendarUtils";

type TodayGoalsProps = {
  todayProgress: TodayProgress;
  studentId: string;
};

export async function TodayGoals({ todayProgress, studentId }: TodayGoalsProps) {
  try {
    // 오늘 날짜 및 주간 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = formatDateString(today);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartDate = formatDateString(weekStart);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndDate = formatDateString(weekEnd);

    // 목표 요약 조회
    const supabase = await createSupabaseServerClient();
    const goalsSummary = await fetchGoalsSummary(
      supabase,
      studentId,
      todayDate,
      weekStartDate,
      weekEndDate
    );

    // 오늘 목표 데이터를 컴포넌트에서 필요한 형식으로 변환
    const topGoals = goalsSummary.todayGoals
      .filter((goal) => goal.status === "active" || goal.status === "upcoming")
      .slice(0, 5) // 최대 5개만 표시
      .map((goal) => ({
        goalId: goal.id,
        title: goal.title,
        progress: goal.progressPercentage,
      }));

    if (topGoals.length === 0) {
      return (
        <div className={cn(
          "rounded-xl border border-dashed p-4",
          "border-gray-300 dark:border-gray-600",
          bgPage
        )}>
          <div className="flex flex-col gap-2">
            <h2 className={cn("text-lg font-semibold", textPrimary)}>오늘 목표</h2>
            <p className={cn("text-sm", textMuted)}>오늘 완료해야 할 목표가 없습니다.</p>
          </div>
        </div>
      );
    }

  return (
    <div className={cn(cardBase, "p-4")}>
      <div className="flex flex-col gap-4">
        <h2 className={cn("text-lg font-semibold", textPrimary)}>오늘 목표</h2>
        <div className="flex flex-col gap-3">
          {topGoals.map((goal) => (
            <div key={goal.goalId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className={cn("font-medium", textSecondary)}>{goal.title}</span>
                <span className={textTertiary}>{goal.progress}%</span>
              </div>
              <ProgressBar value={goal.progress} height="md" color="blue" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error("[TodayGoals] 컴포넌트 렌더링 실패", error);
    return (
      <div className={cn(
        "rounded-xl border border-dashed p-4",
        "border-gray-300 dark:border-gray-600",
        bgPage
      )}>
        <div className="flex flex-col gap-2">
          <h2 className={cn("text-lg font-semibold", textPrimary)}>오늘 목표</h2>
          <p className={cn("text-sm", textMuted)}>목표 정보를 불러오는 중 오류가 발생했습니다.</p>
        </div>
      </div>
    );
  }
}

