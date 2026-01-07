import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCompletedPlan, filterLearningPlans } from "@/lib/utils/planUtils";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import type {
  SupabaseServerClient,
  MetricsResult,
  WeeklyMetricsOptions,
} from "./types";
import {
  toDateString,
  handleMetricsError,
  nullToDefault,
  isEmptyArray,
} from "./utils";

type PlanRow = {
  id: string;
  completed_amount: number | null;
  actual_end_time: string | null;
  progress: number | null;
  content_id: string | null;
};

export type PlanCompletionMetrics = {
  totalPlans: number;
  completedPlans: number;
  completionRate: number; // 0-100
};

/**
 * 주간 플랜 실행률 메트릭 조회
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param options - 메트릭 조회 옵션
 * @param options.studentId - 학생 ID
 * @param options.weekStart - 주간 시작일
 * @param options.weekEnd - 주간 종료일
 * @returns 플랜 실행률 메트릭 결과
 * 
 * @example
 * ```typescript
 * const result = await getPlanCompletion(supabase, {
 *   studentId: "student-123",
 *   weekStart: new Date('2025-01-13'),
 *   weekEnd: new Date('2025-01-19'),
 * });
 * 
 * if (result.success) {
 *   console.log(`실행률: ${result.data.completionRate}%`);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  options: WeeklyMetricsOptions
): Promise<MetricsResult<PlanCompletionMetrics>> {
  try {
    const { studentId, weekStart, weekEnd } = options;
    const weekStartStr = toDateString(weekStart);
    const weekEndStr = toDateString(weekEnd);

    const planRows = await safeQueryArray<PlanRow>(
      async () => {
        const result = await supabase
          .from("student_plan")
          .select("id,completed_amount,actual_end_time,progress,content_id")
          .eq("student_id", studentId)
          .gte("plan_date", weekStartStr)
          .lte("plan_date", weekEndStr);
        return { data: result.data as PlanRow[] | null, error: result.error };
      },
      async () => {
        const result = await supabase
          .from("student_plan")
          .select("id,completed_amount,actual_end_time,progress,content_id")
          .gte("plan_date", weekStartStr)
          .lte("plan_date", weekEndStr);
        return { data: result.data as PlanRow[] | null, error: result.error };
      },
      { context: "[metrics/getPlanCompletion] 플랜 조회" }
    );

    // null 체크 및 기본값 처리
    const safePlanRows = nullToDefault(planRows, []);

    // 학습 플랜만 필터링 (더미 콘텐츠 제외)
    const learningPlans = filterLearningPlans(safePlanRows);

    const totalPlans = learningPlans.length;
    // 통일된 완료 기준 사용 (actual_end_time 또는 progress >= 100)
    const completedPlans = learningPlans.filter((p) => isCompletedPlan(p)).length;
    const completionRate =
      totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

    return {
      success: true,
      data: {
        totalPlans,
        completedPlans,
        completionRate,
      },
    };
  } catch (error) {
    return handleMetricsError(
      error,
      "[metrics/getPlanCompletion]",
      {
        totalPlans: 0,
        completedPlans: 0,
        completionRate: 0,
      }
    );
  }
}

