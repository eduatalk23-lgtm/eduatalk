import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCompletedPlan, filterLearningPlans } from "@/lib/utils/planUtils";
import { safeQueryArray } from "@/lib/supabase/safeQuery";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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
 */
export async function getPlanCompletion(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<PlanCompletionMetrics> {
  try {
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

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

    // 학습 플랜만 필터링 (더미 콘텐츠 제외)
    const learningPlans = filterLearningPlans(planRows);

    const totalPlans = learningPlans.length;
    // 통일된 완료 기준 사용 (actual_end_time 또는 progress >= 100)
    const completedPlans = learningPlans.filter((p) => isCompletedPlan(p)).length;
    const completionRate =
      totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

    return {
      totalPlans,
      completedPlans,
      completionRate,
    };
  } catch (error) {
    console.error("[metrics/getPlanCompletion] 플랜 실행률 조회 실패", error);
    return {
      totalPlans: 0,
      completedPlans: 0,
      completionRate: 0,
    };
  }
}

