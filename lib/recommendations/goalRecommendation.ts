import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveGoals, getGoalProgress } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 목표 기반 행동 추천 생성
 * - 목표 마감 D-day, 진행률 기반 추천
 * - 위험 목표(high risk goals)는 긴급 추천
 */
export async function getGoalRecommendations(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<string[]> {
  const recommendations: string[] = [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().slice(0, 10);

    // 활성 목표 조회
    const activeGoals = await getActiveGoals(supabase, studentId, todayDate);

    if (activeGoals.length === 0) {
      return [];
    }

    // 각 목표의 진행률 계산
    const goalsWithProgress = await Promise.all(
      activeGoals.map(async (goal) => {
        const progressRows = await getGoalProgress(supabase, studentId, goal.id);
        const progress = calculateGoalProgress(goal, progressRows, today);
        return { goal, progress };
      })
    );

    // Rule 1: D <= 7이고 목표 달성률 < 40% → 긴급 추천
    const urgentGoals = goalsWithProgress.filter(
      (g) =>
        g.progress.daysRemaining !== null &&
        g.progress.daysRemaining <= 7 &&
        g.progress.progressPercentage < 40
    );

    for (const { goal, progress } of urgentGoals) {
      const daysLeft = progress.daysRemaining || 0;
      recommendations.push(
        `"${goal.title}" 목표가 D-${daysLeft}인데 진행률이 ${progress.progressPercentage}%입니다. 이번주 학습 비중을 높여야 합니다.`
      );
    }

    // Rule 2: D <= 3이고 60% 이하 → 경고 추천
    const warningGoals = goalsWithProgress.filter(
      (g) =>
        g.progress.daysRemaining !== null &&
        g.progress.daysRemaining <= 3 &&
        g.progress.progressPercentage <= 60
    );

    for (const { goal, progress } of warningGoals) {
      const daysLeft = progress.daysRemaining || 0;
      if (progress.progressPercentage < 40) {
        // Rule 1에서 이미 처리됨
        continue;
      }
      recommendations.push(
        `"${goal.title}" 목표가 D-${daysLeft}인데 진행률이 ${progress.progressPercentage}%입니다. 남은 기간 동안 집중 학습이 필요합니다.`
      );
    }

    // Rule 3: 목표가 3개 이상인데 1개도 >50%가 없음 → 전략 조정 추천
    if (goalsWithProgress.length >= 3) {
      const highProgressCount = goalsWithProgress.filter(
        (g) => g.progress.progressPercentage > 50
      ).length;

      if (highProgressCount === 0) {
        recommendations.push(
          `진행 중인 목표 ${goalsWithProgress.length}개 중 진행률 50% 이상인 목표가 없습니다. 목표 우선순위를 재조정하거나 목표 기간을 연장하는 것을 고려하세요.`
        );
      }
    }

    // Rule 4: D-10 이하 목표에 대한 일반 추천
    const nearDeadlineGoals = goalsWithProgress.filter(
      (g) =>
        g.progress.daysRemaining !== null &&
        g.progress.daysRemaining <= 10 &&
        g.progress.daysRemaining > 7 &&
        g.progress.progressPercentage < 70
    );

    for (const { goal, progress } of nearDeadlineGoals) {
      const daysLeft = progress.daysRemaining || 0;
      recommendations.push(
        `"${goal.title}" 목표가 D-${daysLeft}이므로 핵심 단원에 집중하세요.`
      );
    }

    // Rule 5: 하루에 필요한 학습량이 과도한 경우
    for (const { goal, progress } of goalsWithProgress) {
      if (
        progress.dailyRequiredAmount !== null &&
        progress.dailyRequiredAmount > 100 &&
        progress.progressPercentage < 50
      ) {
        const daysLeft = progress.daysRemaining || 0;
        recommendations.push(
          `"${goal.title}" 목표를 달성하려면 하루에 ${progress.dailyRequiredAmount} 이상 학습해야 합니다. 목표 기간 연장을 고려하세요.`
        );
      }
    }

    return recommendations;
  } catch (error) {
    console.error("[recommendations/goal] 목표 추천 생성 실패", error);
    return [];
  }
}

