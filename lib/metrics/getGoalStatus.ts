import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveGoals } from "@/lib/goals/queries";
import { calculateGoalProgress, type Goal, type GoalProgress } from "@/lib/goals/calc";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { GOAL_CONSTANTS } from "@/lib/metrics/constants";
import type {
  SupabaseServerClient,
  MetricsResult,
  DateBasedMetricsOptions,
} from "./types";
import {
  normalizeDateString,
  handleMetricsError,
  nullToDefault,
} from "./utils";

/**
 * 목표 상태 메트릭 타입
 * 
 * @property totalActiveGoals - 활성 목표 수
 * @property goalsNearDeadline - 마감 임박 목표 수 (D-7 이내)
 * @property goalsVeryNearDeadline - 매우 임박 목표 수 (D-3 이내)
 * @property averageProgress - 평균 진행률 (0-100)
 * @property lowProgressGoals - 저진행률 목표 수 (30% 미만)
 * @property veryLowProgressGoals - 매우 저진행률 목표 수 (50% 미만)
 * @property goals - 목표별 상세 정보 목록
 */
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
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 메트릭 조회 옵션
 * @param options.studentId - 학생 ID
 * @param options.todayDate - 기준 날짜 (Date 객체 또는 YYYY-MM-DD 형식 문자열)
 * @returns 목표 상태 메트릭 결과
 * 
 * @example
 * ```typescript
 * const result = await getGoalStatus(supabase, {
 *   studentId: "student-123",
 *   todayDate: new Date('2025-01-15'),
 * });
 * 
 * if (result.success) {
 *   console.log(`평균 진행률: ${result.data.averageProgress}%`);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function getGoalStatus(
  supabase: SupabaseServerClient,
  options: DateBasedMetricsOptions
): Promise<MetricsResult<GoalStatusMetrics>> {
  try {
    const { studentId, todayDate } = options;
    const todayDateStr = normalizeDateString(todayDate);
    const today = new Date(todayDateStr);
    today.setHours(0, 0, 0, 0);

    // 활성 목표 조회
    const activeGoals = await getActiveGoals(supabase, studentId, todayDateStr);

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
      async () => {
        const result = await supabase
          .from("student_goal_progress")
          .select("*")
          .eq("student_id", studentId)
          .in("goal_id", goalIds)
          .order("recorded_at", { ascending: false });
        return { data: result.data as GoalProgress[] | null, error: result.error };
      },
      async () => {
        const result = await supabase
          .from("student_goal_progress")
          .select("*")
          .in("goal_id", goalIds)
          .order("recorded_at", { ascending: false });
        return { data: result.data as GoalProgress[] | null, error: result.error };
      },
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
      success: true,
      data: {
        totalActiveGoals,
        goalsNearDeadline,
        goalsVeryNearDeadline,
        averageProgress,
        lowProgressGoals,
        veryLowProgressGoals,
        goals: goalsWithProgress,
      },
    };
  } catch (error) {
    return handleMetricsError(
      error,
      "[metrics/getGoalStatus]",
      {
        totalActiveGoals: 0,
        goalsNearDeadline: 0,
        goalsVeryNearDeadline: 0,
        averageProgress: 0,
        lowProgressGoals: 0,
        veryLowProgressGoals: 0,
        goals: [],
      }
    );
  }
}

