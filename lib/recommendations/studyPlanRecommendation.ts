import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudyTime } from "@/lib/metrics/getStudyTime";
import { getPlanCompletion } from "@/lib/metrics/getPlanCompletion";
import { getStudentRiskScore } from "@/lib/risk/engine";
import { getActiveGoals, getGoalProgress } from "@/lib/goals/queries";
import { calculateGoalProgress } from "@/lib/goals/calc";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 다음주 학습시간/플랜 추천 생성
 * - 이번주 학습시간, 플랜 실행률, 위험 신호, 목표 D-day 기반
 */
export async function getStudyPlanRecommendations(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<string[]> {
  const recommendations: string[] = [];

  try {
    // 이번 주 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 데이터 조회
    const [studyTimeResult, planCompletionResult, riskResult, activeGoals] = await Promise.all([
      getStudyTime(supabase, { studentId, weekStart, weekEnd }),
      getPlanCompletion(supabase, { studentId, weekStart, weekEnd }),
      getStudentRiskScore(supabase, studentId, { recordHistory: false }),
      getActiveGoals(supabase, studentId, today.toISOString().slice(0, 10)),
    ]);

    // 주간 학습시간 결과 처리
    const studyTime = studyTimeResult.success
      ? studyTimeResult.data
      : {
          thisWeekMinutes: 0,
          lastWeekMinutes: 0,
          changePercent: 0,
          changeMinutes: 0,
        };

    // 플랜 실행률 결과 처리
    const planCompletion = planCompletionResult.success
      ? planCompletionResult.data
      : { totalPlans: 0, completedPlans: 0, completionRate: 0 };

    // Rule 1: 플랜 실행률 < 50% → 다음주 블록 수 줄이기
    if (planCompletion.completionRate < 50) {
      const reductionPercent = planCompletion.completionRate < 30 ? 20 : 10;
      recommendations.push(
        `이번주 플랜 실행률이 ${planCompletion.completionRate}%로 낮았으므로, 다음주는 블록 수를 ${reductionPercent}% 줄이고 실행 가능성을 높이세요.`
      );
    }

    // Rule 2: 학습시간 급감 → 일정 조정 + 타이머 집중 루틴 복구
    if (studyTime.changePercent < -30 && studyTime.thisWeekMinutes < studyTime.lastWeekMinutes) {
      const hours = Math.floor(studyTime.thisWeekMinutes / 60);
      const lastHours = Math.floor(studyTime.lastWeekMinutes / 60);
      recommendations.push(
        `이번주 학습시간이 지난주 대비 ${Math.abs(studyTime.changePercent)}% 감소했습니다 (${lastHours}시간 → ${hours}시간). 일정 조정과 타이머 집중 루틴 복구가 필요합니다.`
      );
    }

    // Rule 3: D-7 이하 목표가 많음 → 목표 기반 플랜 생성 우선
    const goalsWithProgress = await Promise.all(
      activeGoals.map(async (goal) => {
        const progressRows = await getGoalProgress(supabase, studentId, goal.id);
        const progress = calculateGoalProgress(goal, progressRows, today);
        return { goal, progress };
      })
    );

    const urgentGoals = goalsWithProgress.filter(
      (g) =>
        g.progress.daysRemaining !== null &&
        g.progress.daysRemaining <= 7 &&
        g.progress.progressPercentage < 70
    );

    if (urgentGoals.length >= 2) {
      const subjectList = urgentGoals
        .map((g) => g.goal.subject)
        .filter((s): s is string => s !== null)
        .join(", ");
      recommendations.push(
        `목표 ${urgentGoals.length}개가 마감 임박이므로 해당 과목(${subjectList}) 중심의 플랜 구성 권장.`
      );
    } else if (urgentGoals.length === 1) {
      const goal = urgentGoals[0].goal;
      const subject = goal.subject || "해당 과목";
      recommendations.push(
        `"${goal.title}" 목표가 D-${urgentGoals[0].progress.daysRemaining}이므로 ${subject}에 최소 4시간 이상 투자하는 것이 필요합니다.`
      );
    }

    // Rule 4: 위험 신호가 있는 경우
    if (riskResult.level === "high") {
      if (riskResult.reasons.length > 0) {
        const mainReason = riskResult.reasons[0];
        recommendations.push(
          `위험 신호가 감지되었습니다: ${mainReason}. 다음주 학습 계획을 재검토하세요.`
        );
      }
    }

    // Rule 5: 학습시간이 매우 부족한 경우
    if (studyTime.thisWeekMinutes < 5 * 60) {
      const hours = Math.floor(studyTime.thisWeekMinutes / 60);
      recommendations.push(
        `이번주 학습시간이 ${hours}시간으로 매우 부족합니다. 다음주에는 최소 10시간 이상 학습하도록 계획하세요.`
      );
    }

    // Rule 6: 취약 과목에 대한 구체적 시간 제안
    if (urgentGoals.length > 0) {
      const subjectGoals = urgentGoals.filter((g) => g.goal.subject !== null);
      if (subjectGoals.length > 0) {
        const subjects = new Set(
          subjectGoals.map((g) => g.goal.subject).filter((s): s is string => s !== null)
        );
        const minHours = Math.ceil(4 / subjects.size);
        for (const subject of subjects) {
          recommendations.push(
            `다음주에는 ${subject}에 최소 ${minHours}시간 이상 투자하는 것이 필요합니다.`
          );
        }
      }
    }

    return recommendations;
  } catch (error) {
    console.error("[recommendations/studyPlan] 학습 플랜 추천 생성 실패", error);
    return [];
  }
}

