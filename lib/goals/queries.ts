import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Goal, GoalProgress } from "./calc";
import { safeQueryArray, safeQuerySingle } from "@/lib/supabase/safeQuery";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

// 모든 목표 조회
export async function getAllGoals(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Goal[]> {
  return safeQueryArray<Goal>(
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .order("created_at", { ascending: false }),
    { context: "[goals] 목표 조회" }
  );
}

// 단일 목표 조회
export async function getGoalById(
  supabase: SupabaseServerClient,
  studentId: string,
  goalId: string
): Promise<Goal | null> {
  return safeQuerySingle<Goal>(
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .eq("id", goalId)
        .eq("student_id", studentId)
        .maybeSingle(),
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .eq("id", goalId)
        .maybeSingle(),
    { context: "[goals] 목표 조회" }
  );
}

// 목표 진행률 기록 조회
export async function getGoalProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  goalId: string
): Promise<GoalProgress[]> {
  return safeQueryArray<GoalProgress>(
    () =>
      supabase
        .from("student_goal_progress")
        .select("*")
        .eq("goal_id", goalId)
        .eq("student_id", studentId)
        .order("recorded_at", { ascending: false }),
    () =>
      supabase
        .from("student_goal_progress")
        .select("*")
        .eq("goal_id", goalId)
        .order("recorded_at", { ascending: false }),
    { context: "[goals] 진행률 조회" }
  );
}

// 활성 목표 조회 (오늘 기준)
export async function getActiveGoals(
  supabase: SupabaseServerClient,
  studentId: string,
  todayDate: string
): Promise<Goal[]> {
  return safeQueryArray<Goal>(
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .eq("student_id", studentId)
        .lte("start_date", todayDate)
        .gte("end_date", todayDate)
        .order("end_date", { ascending: true }),
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .lte("start_date", todayDate)
        .gte("end_date", todayDate)
        .order("end_date", { ascending: true }),
    { context: "[goals] 활성 목표 조회" }
  );
}

// 이번 주 목표 조회
export async function getWeekGoals(
  supabase: SupabaseServerClient,
  studentId: string,
  weekStart: string,
  weekEnd: string
): Promise<Goal[]> {
  return safeQueryArray<Goal>(
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .eq("student_id", studentId)
        .lte("start_date", weekEnd)
        .gte("end_date", weekStart)
        .order("end_date", { ascending: true }),
    () =>
      supabase
        .from("student_goals")
        .select("*")
        .lte("start_date", weekEnd)
        .gte("end_date", weekStart)
        .order("end_date", { ascending: true }),
    { context: "[goals] 주간 목표 조회" }
  );
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
      .map((p: { plan_id?: string | null }) => p.plan_id)
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

    // 콘텐츠 타입별로 분류
    const bookIds: string[] = [];
    const lectureIds: string[] = [];
    const customIds: string[] = [];

    plans.forEach((plan) => {
      if (!plan.content_type || !plan.content_id) return;

      if (plan.content_type === "book") {
        bookIds.push(plan.content_id);
      } else if (plan.content_type === "lecture") {
        lectureIds.push(plan.content_id);
      } else if (plan.content_type === "custom") {
        customIds.push(plan.content_id);
      }
    });

    // 콘텐츠 정보 배치 조회 (병렬)
    const [booksResult, lecturesResult, customResult] = await Promise.all([
      bookIds.length > 0
        ? (async () => {
            const selectBooks = () =>
              supabase
                .from("books")
                .select("id,title")
                .eq("student_id", studentId)
                .in("id", bookIds);

            let { data, error } = await selectBooks();
            if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
              ({ data, error } = await selectBooks());
            }
            return error ? [] : (data as Array<{ id: string; title?: string | null }> | null) ?? [];
          })()
        : Promise.resolve([]),
      lectureIds.length > 0
        ? (async () => {
            const selectLectures = () =>
              supabase
                .from("lectures")
                .select("id,title")
                .eq("student_id", studentId)
                .in("id", lectureIds);

            let { data, error } = await selectLectures();
            if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
              ({ data, error } = await selectLectures());
            }
            return error ? [] : (data as Array<{ id: string; title?: string | null }> | null) ?? [];
          })()
        : Promise.resolve([]),
      customIds.length > 0
        ? (async () => {
            const selectCustom = () =>
              supabase
                .from("student_custom_contents")
                .select("id,title")
                .eq("student_id", studentId)
                .in("id", customIds);

            let { data, error } = await selectCustom();
            if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
              ({ data, error } = await selectCustom());
            }
            return error ? [] : (data as Array<{ id: string; title?: string | null }> | null) ?? [];
          })()
        : Promise.resolve([]),
    ]);

    // 콘텐츠 ID -> 제목 매핑 생성
    const contentTitleMap = new Map<string, string>();
    booksResult.forEach((book) => {
      contentTitleMap.set(`book:${book.id}`, book.title || "제목 없음");
    });
    lecturesResult.forEach((lecture) => {
      contentTitleMap.set(`lecture:${lecture.id}`, lecture.title || "제목 없음");
    });
    customResult.forEach((custom) => {
      contentTitleMap.set(`custom:${custom.id}`, custom.title || "제목 없음");
    });

    return plans.map((plan) => ({
      id: plan.id,
      plan_date: plan.plan_date || "",
      content_type: plan.content_type,
      content_id: plan.content_id,
      content_title:
        plan.content_type && plan.content_id
          ? contentTitleMap.get(`${plan.content_type}:${plan.content_id}`) || null
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

    // 모든 목표 ID 수집
    const allGoalIds = [
      ...activeGoals.map((g) => g.id),
      ...weekGoals.map((g) => g.id),
    ];
    const uniqueGoalIds = Array.from(new Set(allGoalIds));

    // 모든 목표의 진행률 데이터를 한 번에 조회
    const allProgressRows = await safeQueryArray<GoalProgress>(
      () =>
        supabase
          .from("student_goal_progress")
          .select("*")
          .eq("student_id", studentId)
          .in("goal_id", uniqueGoalIds)
          .order("recorded_at", { ascending: false }),
      () =>
        supabase
          .from("student_goal_progress")
          .select("*")
          .in("goal_id", uniqueGoalIds)
          .order("recorded_at", { ascending: false }),
      { context: "[goals] 목표 요약 진행률 조회" }
    );

    // 목표별로 진행률 데이터 그룹화
    const progressByGoalId = new Map<string, GoalProgress[]>();
    allProgressRows.forEach((progress) => {
      const existing = progressByGoalId.get(progress.goal_id) || [];
      existing.push(progress);
      progressByGoalId.set(progress.goal_id, existing);
    });

    // 오늘 목표 진행률 계산
    const todayGoalsWithProgress = activeGoals.map((goal) => {
      const progressRows = progressByGoalId.get(goal.id) || [];
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
    });

    // 주간 목표 진행률 계산
    const weekGoalsWithProgress = weekGoals.map((goal) => {
      const progressRows = progressByGoalId.get(goal.id) || [];
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
    });

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
