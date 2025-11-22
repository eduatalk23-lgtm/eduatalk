import { getPlansForStudent } from "@/lib/data/studentPlans";
import { getSessionsInRange } from "@/lib/data/studentSessions";
import { getGoalsForStudent } from "@/lib/data/studentGoals";
import { getGoalProgressList } from "@/lib/data/studentGoals";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type TodayProgress = {
  todayStudyMinutes: number; // 오늘 학습 시간 (분)
  planCompletedCount: number; // 완료한 플랜 수
  planTotalCount: number; // 전체 플랜 수
  goalProgressSummary: Array<{
    goalId: string;
    title: string;
    progress: number; // 0-100
  }>;
  achievementScore: number; // 0-100
};

/**
 * 특정 날짜의 학습 진행률 계산
 * @param studentId 학생 ID
 * @param tenantId 테넌트 ID
 * @param targetDate 계산할 날짜 (YYYY-MM-DD 형식, 기본값: 오늘)
 */
export async function calculateTodayProgress(
  studentId: string,
  tenantId?: string | null,
  targetDate?: string
): Promise<TodayProgress> {
  try {
    // targetDate가 없으면 오늘 날짜 사용
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = targetDate || today.toISOString().slice(0, 10);
    
    // 계산할 날짜 설정
    const target = new Date(todayDate + "T00:00:00");
    const targetEnd = new Date(target);
    targetEnd.setHours(23, 59, 59, 999);
    const targetEndStr = targetEnd.toISOString();

    // 1. 해당 날짜의 플랜 조회
    const plans = await getPlansForStudent({
      studentId,
      tenantId,
      planDate: todayDate,
    });

    const planTotalCount = plans.length;
    const planCompletedCount = plans.filter(
      (plan) => plan.progress !== null && plan.progress !== undefined && plan.progress >= 100
    ).length;

    // 2. 해당 날짜의 세션 조회 및 학습 시간 계산
    const sessions = await getSessionsInRange({
      studentId,
      tenantId,
      dateRange: {
        start: target.toISOString(),
        end: targetEndStr,
      },
    });

    const todayStudyMinutes = sessions.reduce((total, session) => {
      if (session.duration_seconds) {
        return total + Math.floor(session.duration_seconds / 60);
      }
      return total;
    }, 0);

    // 3. 오늘 목표 진행률 조회
    const goals = await getGoalsForStudent({
      studentId,
      tenantId,
      isActive: true,
    });

    const goalProgressSummary = await Promise.all(
      goals.map(async (goal) => {
        const progressList = await getGoalProgressList(
          goal.id,
          studentId,
          tenantId
        );

        // 해당 날짜의 진행률만 계산
        const targetDateProgress = progressList.filter((p) => {
          const progressDate = p.created_at
            ? new Date(p.created_at).toISOString().slice(0, 10)
            : null;
          return progressDate === todayDate;
        });

        const targetDateAmount = targetDateProgress.reduce(
          (sum, p) => sum + p.progress_amount,
          0
        );

        let progress = 0;
        if (goal.expected_amount && goal.expected_amount > 0) {
          progress = Math.min(
            Math.round((targetDateAmount / goal.expected_amount) * 100),
            100
          );
        }

        return {
          goalId: goal.id,
          title: goal.title,
          progress,
        };
      })
    );

    // 4. Achievement Score 계산
    // (오늘 실행률 * 0.5) + (오늘 목표 달성률 * 0.3) + (집중 타이머 누적/예상 * 0.2)
    const executionRate =
      planTotalCount > 0 ? (planCompletedCount / planTotalCount) * 100 : 0;

    const goalCompletionRate =
      goalProgressSummary.length > 0
        ? goalProgressSummary.reduce((sum, g) => sum + g.progress, 0) /
          goalProgressSummary.length
        : 0;

    // 예상 학습 시간 계산 (플랜 기반, 평균 60분 가정)
    const expectedMinutes = planTotalCount * 60;
    const focusTimerRate =
      expectedMinutes > 0
        ? Math.min((todayStudyMinutes / expectedMinutes) * 100, 100)
        : 0;

    const achievementScore = Math.round(
      executionRate * 0.5 + goalCompletionRate * 0.3 + focusTimerRate * 0.2
    );

    return {
      todayStudyMinutes,
      planCompletedCount,
      planTotalCount,
      goalProgressSummary,
      achievementScore,
    };
  } catch (error) {
    console.error("[metrics/todayProgress] 오늘 진행률 계산 실패", error);
    return {
      todayStudyMinutes: 0,
      planCompletedCount: 0,
      planTotalCount: 0,
      goalProgressSummary: [],
      achievementScore: 0,
    };
  }
}

