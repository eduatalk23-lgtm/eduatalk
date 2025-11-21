import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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

    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,completed_amount")
        .gte("plan_date", weekStartStr)
        .lte("plan_date", weekEndStr);

    let { data: plans, error } = await selectPlans().eq("student_id", studentId);

    if (error && error.code === "42703") {
      ({ data: plans, error } = await selectPlans());
    }

    if (error) throw error;

    const planRows = (plans as Array<{
      id: string;
      completed_amount?: number | null;
    }> | null) ?? [];

    const totalPlans = planRows.length;
    const completedPlans = planRows.filter(
      (p) => p.completed_amount !== null && p.completed_amount !== undefined && p.completed_amount > 0
    ).length;
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

