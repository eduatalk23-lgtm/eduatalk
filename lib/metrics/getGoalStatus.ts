import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveGoals } from "@/lib/goals/queries";
import { calculateGoalProgress, type Goal, type GoalProgress } from "@/lib/goals/calc";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { GOAL_CONSTANTS } from "@/lib/metrics/constants";

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
 * 
 * N+1 쿼리 최적화: 모든 목표의 진행률 데이터를 한 번의 쿼리로 조회
 */
export async function getGoalStatus(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string
): Promise<GoalStatusMetrics> {
  try {
    const today = new Date(todayDate);
    today.setHours(0, 0, 0, 0);

    // 활성 목표 조회
    const activeGoals = await getActiveGoals(supabase, studentId, todayDate);

    if (activeGoals.length === 0) {
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

    // 모든 목표 ID 수집
    const goalIds = activeGoals.map((goal) => goal.id);

    // 모든 목표의 진행률 데이터를 한 번에 조회
    const allProgressRows = await safeQueryArray<GoalProgress>(
      () =>
        supabase
          .from("student_goal_progress")
          .select("*")
          .eq("student_id", studentId)
          .in("goal_id", goalIds)
          .order("recorded_at", { ascending: false }),
      () =>
        supabase
          .from("student_goal_progress")
          .select("*")
          .in("goal_id", goalIds)
          .order("recorded_at", { ascending: false }),
      { context: "[metrics/getGoalStatus] 진행률 조회" }
    );

    // 목표별로 진행률 데이터 그룹화
    const progressByGoalId = new Map<string, GoalProgress[]>();
    allProgressRows.forEach((progress) => {
      const existing = progressByGoalId.get(progress.goal_id) || [];
      existing.push(progress);
      progressByGoalId.set(progress.goal_id, existing);
    });

    // 각 목표의 진행률 계산
    const goalsWithProgress = activeGoals.map((goal) => {
      const progressRows = progressByGoalId.get(goal.id) || [];
      const progress = calculateGoalProgress(goal, progressRows, today);

      return {
        id: goal.id,
        title: goal.title,
        daysRemaining: progress.daysRemaining,
        progressPercentage: progress.progressPercentage,
      };
    });

    const totalActiveGoals = goalsWithProgress.length;
    const goalsNearDeadline = goalsWithProgress.filter(
      (g) =>
        g.daysRemaining !== null &&
        g.daysRemaining <= GOAL_CONSTANTS.NEAR_DEADLINE_DAYS &&
        g.daysRemaining >= 0
    ).length;
    const goalsVeryNearDeadline = goalsWithProgress.filter(
      (g) =>
        g.daysRemaining !== null &&
        g.daysRemaining <= GOAL_CONSTANTS.VERY_NEAR_DEADLINE_DAYS &&
        g.daysRemaining >= 0
    ).length;
    const averageProgress =
      goalsWithProgress.length > 0
        ? Math.round(
            goalsWithProgress.reduce((sum, g) => sum + g.progressPercentage, 0) /
              goalsWithProgress.length
          )
        : 0;
    const lowProgressGoals = goalsWithProgress.filter(
      (g) => g.progressPercentage < GOAL_CONSTANTS.LOW_PROGRESS_THRESHOLD
    ).length;
    const veryLowProgressGoals = goalsWithProgress.filter(
      (g) => g.progressPercentage < GOAL_CONSTANTS.VERY_LOW_PROGRESS_THRESHOLD
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

