import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveGoals, getGoalProgress } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type GoalStatusMetrics = {
  totalActiveGoals: number;
  goalsNearDeadline: number; // D-7 이내 목표 수
  goalsVeryNearDeadline: number; // D-3 이내 목표 수
  averageProgress: number; // 평균 진행률 (0-100)
  lowProgressGoals: number; // 진행률 30% 미만 목표 수
  veryLowProgressGoals: number; // 진행률 50% 미만 목표 수
  goals: Array<{
    id: string;
    title: string;
    daysRemaining: number | null;
    progressPercentage: number;
  }>;
};

/**
 * 목표 상태 메트릭 조회
 */
export async function getGoalStatus(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string
): Promise<GoalStatusMetrics> {
  try {
    const today = new Date(todayDate);
    today.setHours(0, 0, 0, 0);

    const activeGoals = await getActiveGoals(supabase, studentId, todayDate);

    const goalsWithProgress = await Promise.all(
      activeGoals.map(async (goal) => {
        const progressRows = await getGoalProgress(supabase, studentId, goal.id);
        const progress = calculateGoalProgress(goal, progressRows, today);

        return {
          id: goal.id,
          title: goal.title,
          daysRemaining: progress.daysRemaining,
          progressPercentage: progress.progressPercentage,
        };
      })
    );

    const totalActiveGoals = goalsWithProgress.length;
    const goalsNearDeadline = goalsWithProgress.filter(
      (g) => g.daysRemaining !== null && g.daysRemaining <= 7 && g.daysRemaining >= 0
    ).length;
    const goalsVeryNearDeadline = goalsWithProgress.filter(
      (g) => g.daysRemaining !== null && g.daysRemaining <= 3 && g.daysRemaining >= 0
    ).length;
    const averageProgress =
      goalsWithProgress.length > 0
        ? Math.round(
            goalsWithProgress.reduce((sum, g) => sum + g.progressPercentage, 0) /
              goalsWithProgress.length
          )
        : 0;
    const lowProgressGoals = goalsWithProgress.filter(
      (g) => g.progressPercentage < 30
    ).length;
    const veryLowProgressGoals = goalsWithProgress.filter(
      (g) => g.progressPercentage < 50
    ).length;

    return {
      totalActiveGoals,
      goalsNearDeadline,
      goalsVeryNearDeadline,
      averageProgress,
      lowProgressGoals,
      veryLowProgressGoals,
      goals: goalsWithProgress,
    };
  } catch (error) {
    console.error("[metrics/getGoalStatus] 목표 상태 조회 실패", error);
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
}

