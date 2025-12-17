import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Goal, GoalProgress } from "./calc";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 모든 목표 조회
export async function getAllGoals(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Goal[]> {
  try {
    const selectGoals = () =>
      supabase
        .from("student_goals")
        .select("*")
        .order("created_at", { ascending: false });

    let { data, error } = await selectGoals().eq("student_id", studentId);

    if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ data, error } = await selectGoals());
    }

    if (error) {
      console.error("[goals] 목표 조회 실패", error);
      return [];
    }

    return (data as Goal[] | null) ?? [];
  } catch (error) {
    console.error("[goals] 목표 조회 실패", error);
    return [];
  }
}

// 단일 목표 조회
export async function getGoalById(
  supabase: SupabaseServerClient,
  studentId: string,
  goalId: string
): Promise<Goal | null> {
  try {
    const selectGoal = () =>
      supabase.from("student_goals").select("*").eq("id", goalId);

    let { data, error } = await selectGoal().eq("student_id", studentId).maybeSingle();

    if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ data, error } = await selectGoal().maybeSingle());
    }

    if (error) {
      console.error("[goals] 목표 조회 실패", error);
      return null;
    }

    return (data as Goal | null) ?? null;
  } catch (error) {
    console.error("[goals] 목표 조회 실패", error);
    return null;
  }
}

// 목표 진행률 기록 조회
export async function getGoalProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  goalId: string
): Promise<GoalProgress[]> {
  try {
    const selectProgress = () =>
      supabase
        .from("student_goal_progress")
        .select("*")
        .eq("goal_id", goalId)
        .order("recorded_at", { ascending: false });

    let { data, error } = await selectProgress().eq("student_id", studentId);

    if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ data, error } = await selectProgress());
    }

    if (error) {
      console.error("[goals] 진행률 조회 실패", error);
      return [];
    }

    return (data as GoalProgress[] | null) ?? [];
  } catch (error) {
    console.error("[goals] 진행률 조회 실패", error);
    return [];
  }
}

// 활성 목표 조회 (오늘 기준)
export async function getActiveGoals(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string
): Promise<Goal[]> {
  try {
    const selectGoals = () =>
      supabase
        .from("student_goals")
        .select("*")
        .lte("start_date", todayDate)
        .gte("end_date", todayDate)
        .order("end_date", { ascending: true });

    let { data, error } = await selectGoals().eq("student_id", studentId);

    if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ data, error } = await selectGoals());
    }

    if (error) {
      console.error("[goals] 활성 목표 조회 실패", error);
      return [];
    }

    return (data as Goal[] | null) ?? [];
  } catch (error) {
    console.error("[goals] 활성 목표 조회 실패", error);
    return [];
  }
}

// 이번 주 목표 조회
export async function getWeekGoals(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: string,
  weekEnd: string
): Promise<Goal[]> {
  try {
    const selectGoals = () =>
      supabase
        .from("student_goals")
        .select("*")
        .lte("start_date", weekEnd)
        .gte("end_date", weekStart)
        .order("end_date", { ascending: true });

    let { data, error } = await selectGoals().eq("student_id", studentId);

    if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ data, error } = await selectGoals());
    }

    if (error) {
      console.error("[goals] 주간 목표 조회 실패", error);
      return [];
    }

    return (data as Goal[] | null) ?? [];
  } catch (error) {
    console.error("[goals] 주간 목표 조회 실패", error);
    return [];
  }
}

// 목표에 연결된 플랜 조회
export async function getPlansForGoal(
  supabase: SupabaseServerClient,
  studentId: string,
  goalId: string
): Promise<Array<{
  id: string;
  plan_date: string;
  content_type: string | null;
  content_id: string | null;
  content_title: string | null;
}>> {
  try {
    // goal_progress에서 plan_id 목록 가져오기
    const selectProgress = () =>
      supabase
        .from("student_goal_progress")
        .select("plan_id")
        .eq("goal_id", goalId)
        .not("plan_id", "is", null);

    let { data: progressData, error: progressError } = await selectProgress()
      .eq("student_id", studentId);

    if (progressError && progressError.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ data: progressData, error: progressError } = await selectProgress());
    }

    if (progressError || !progressData || progressData.length === 0) {
      return [];
    }

    const planIds = progressData
      .map((p: any) => p.plan_id)
      .filter((id: string | null): id is string => id !== null);

    if (planIds.length === 0) {
      return [];
    }

    // 플랜 정보 조회
    const selectPlans = () =>
      supabase
        .from("student_plan")
        .select("id,plan_date,content_type,content_id")
        .in("id", planIds);

    let { data: plans, error: plansError } = await selectPlans()
      .eq("student_id", studentId);

    if (plansError && plansError.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
      ({ data: plans, error: plansError } = await selectPlans());
    }

    if (plansError || !plans) {
      return [];
    }

    // 콘텐츠 정보 조회
    const contentMap = new Map<string, string>();
    for (const plan of plans) {
      if (!plan.content_type || !plan.content_id) continue;

      const tableName =
        plan.content_type === "book"
          ? "books"
          : plan.content_type === "lecture"
          ? "lectures"
          : "student_custom_contents";

      const selectContent = () =>
        supabase.from(tableName).select("id,title").eq("id", plan.content_id);

      let { data: content, error: contentError } = await selectContent()
        .eq("student_id", studentId)
        .maybeSingle();

      if (contentError && contentError.code === "42703") {
        ({ data: content, error: contentError } = await selectContent().maybeSingle());
      }

      if (!contentError && content) {
        type ContentWithTitle = { title?: string | null };
        const contentWithTitle = content as ContentWithTitle;
        contentMap.set(`${plan.content_type}:${plan.content_id}`, contentWithTitle.title || "제목 없음");
      }
    }

    return plans.map((plan) => ({
      id: plan.id,
      plan_date: plan.plan_date || "",
      content_type: plan.content_type,
      content_id: plan.content_id,
      content_title: plan.content_type && plan.content_id
        ? contentMap.get(`${plan.content_type}:${plan.content_id}`) || null
        : null,
    }));
  } catch (error) {
    console.error("[goals] 목표 플랜 조회 실패", error);
    return [];
  }
}

// 목표 요약 조회 (오늘 및 주간)
export async function fetchGoalsSummary(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string,
  weekStart: string,
  weekEnd: string
): Promise<{
  todayGoals: Array<{
    id: string;
    title: string;
    goal_type: string;
    progressPercentage: number;
    status: "upcoming" | "active" | "completed" | "failed";
    daysRemaining: number | null;
  }>;
  weekGoals: Array<{
    id: string;
    title: string;
    goal_type: string;
    progressPercentage: number;
    status: "upcoming" | "active" | "completed" | "failed";
    daysRemaining: number | null;
  }>;
}> {
  try {
    const { calculateGoalProgress } = await import("./calc");

    const [activeGoals, weekGoals] = await Promise.all([
      getActiveGoals(supabase, studentId, todayDate),
      getWeekGoals(supabase, studentId, weekStart, weekEnd),
    ]);

    const today = new Date(todayDate);
    today.setHours(0, 0, 0, 0);

    // 오늘 목표 진행률 계산
    const todayGoalsWithProgress = await Promise.all(
      activeGoals.map(async (goal) => {
        const progressRows = await getGoalProgress(supabase, studentId, goal.id);
        const progress = calculateGoalProgress(goal, progressRows, today);
        return {
          id: goal.id,
          title: goal.title,
          goal_type: goal.goal_type,
          progressPercentage: progress.progressPercentage,
          status:
            progress.status === "scheduled"
              ? ("upcoming" as const)
              : progress.status === "in_progress"
              ? ("active" as const)
              : progress.status === "completed"
              ? ("completed" as const)
              : ("failed" as const),
          daysRemaining: progress.daysRemaining,
        };
      })
    );

    // 주간 목표 진행률 계산
    const weekGoalsWithProgress = await Promise.all(
      weekGoals.map(async (goal) => {
        const progressRows = await getGoalProgress(supabase, studentId, goal.id);
        const progress = calculateGoalProgress(goal, progressRows, today);
        return {
          id: goal.id,
          title: goal.title,
          goal_type: goal.goal_type,
          progressPercentage: progress.progressPercentage,
          status:
            progress.status === "scheduled"
              ? ("upcoming" as const)
              : progress.status === "in_progress"
              ? ("active" as const)
              : progress.status === "completed"
              ? ("completed" as const)
              : ("failed" as const),
          daysRemaining: progress.daysRemaining,
        };
      })
    );

    return {
      todayGoals: todayGoalsWithProgress,
      weekGoals: weekGoalsWithProgress,
    };
  } catch (error) {
    console.error("[goals] 목표 요약 조회 실패", error);
    return {
      todayGoals: [],
      weekGoals: [],
    };
  }
}
