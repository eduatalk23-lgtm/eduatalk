import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import {
  createTypedQuery,
  createTypedSingleQuery,
  createTypedConditionalQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

export type Goal = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  goal_type: "range" | "exam" | "weekly" | "monthly";
  title: string;
  description?: string | null;
  subject?: string | null;
  content_id?: string | null;
  start_date: string;
  end_date: string;
  expected_amount?: number | null;
  target_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type GoalProgress = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  goal_id: string;
  plan_id?: string | null;
  session_id?: string | null;
  progress_amount: number;
  created_at?: string | null;
};

export type GoalFilters = {
  studentId: string;
  tenantId?: string | null;
  goalType?: "range" | "exam" | "weekly" | "monthly";
  dateRange?: {
    start: string;
    end: string;
  };
  isActive?: boolean; // 현재 날짜가 start_date와 end_date 사이에 있는 목표
};

/**
 * 학생의 목표 목록 조회
 */
export async function getGoalsForStudent(
  filters: GoalFilters
): Promise<Goal[]> {
  const supabase = await createSupabaseServerClient();

  return await createTypedConditionalQuery<Goal[]>(
    async () => {
      let query = supabase
        .from("student_goals")
        .select(
          "id,tenant_id,student_id,goal_type,title,description,subject,content_id,start_date,end_date,expected_amount,target_score,created_at,updated_at"
        )
        .eq("student_id", filters.studentId);

      if (filters.tenantId) {
        query = query.eq("tenant_id", filters.tenantId);
      }

      if (filters.goalType) {
        query = query.eq("goal_type", filters.goalType);
      }

      if (filters.dateRange) {
        query = query
          .gte("start_date", filters.dateRange.start)
          .lte("end_date", filters.dateRange.end);
      }

      if (filters.isActive !== undefined) {
        const today = new Date().toISOString().slice(0, 10);
        if (filters.isActive) {
          query = query.lte("start_date", today).gte("end_date", today);
        } else {
          query = query.or(`start_date.gt.${today},end_date.lt.${today}`);
        }
      }

      const queryResult = await query.order("created_at", { ascending: false });
      return {
        data: queryResult.data as Goal[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/studentGoals] getGoalsForStudent",
      defaultValue: [],
      fallbackQuery: async () => {
        // fallback: tenant_id 컬럼이 없는 경우
        let fallbackQuery = supabase
          .from("student_goals")
          .select("*")
          .eq("student_id", filters.studentId);

        if (filters.goalType) {
          fallbackQuery = fallbackQuery.eq("goal_type", filters.goalType);
        }

        if (filters.dateRange) {
          fallbackQuery = fallbackQuery
            .gte("start_date", filters.dateRange.start)
            .lte("end_date", filters.dateRange.end);
        }

        const queryResult = await fallbackQuery.order("created_at", { ascending: false });
        return {
          data: queryResult.data as Goal[] | null,
          error: queryResult.error,
        };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  ) ?? [];
}

/**
 * 목표 ID로 목표 조회
 */
export async function getGoalById(
  goalId: string,
  studentId: string,
  tenantId?: string | null
): Promise<Goal | null> {
  const supabase = await createSupabaseServerClient();

  return await createTypedConditionalQuery<Goal>(
    async () => {
      let query = supabase
        .from("student_goals")
        .select(
          "id,tenant_id,student_id,goal_type,title,description,subject,content_id,start_date,end_date,expected_amount,target_score,created_at,updated_at"
        )
        .eq("id", goalId)
        .eq("student_id", studentId);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const queryResult = await query;
      return {
        data: extractJoinResult(queryResult.data),
        error: queryResult.error,
      };
    },
    {
      context: "[data/studentGoals] getGoalById",
      defaultValue: null,
      fallbackQuery: async () => {
        const queryResult = await supabase
          .from("student_goals")
          .select(
            "id,tenant_id,student_id,goal_type,title,description,subject,content_id,start_date,end_date,expected_amount,target_score,created_at,updated_at"
          )
          .eq("id", goalId)
          .eq("student_id", studentId);
        return {
          data: extractJoinResult(queryResult.data),
          error: queryResult.error,
        };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );
}

/**
 * 목표 생성
 */
export async function createGoal(
  goal: {
    tenant_id?: string | null;
    student_id: string;
    goal_type: "range" | "exam" | "weekly" | "monthly";
    title: string;
    description?: string | null;
    subject?: string | null;
    content_id?: string | null;
    start_date: string;
    end_date: string;
    expected_amount?: number | null;
    target_score?: number | null;
  }
): Promise<{ success: boolean; goalId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: goal.tenant_id || null,
    student_id: goal.student_id,
    goal_type: goal.goal_type,
    title: goal.title,
    description: goal.description || null,
    subject: goal.subject || null,
    content_id: goal.content_id || null,
    start_date: goal.start_date,
    end_date: goal.end_date,
    expected_amount: goal.expected_amount || null,
    target_score: goal.target_score || null,
  };

  const result = await createTypedConditionalQuery<{ id: string }>(
    async () => {
      const queryResult = await supabase
        .from("student_goals")
        .insert(payload)
        .select("id")
        .single();

      return {
        data: extractJoinResult(queryResult.data),
        error: queryResult.error,
      };
    },
    {
      context: "[data/studentGoals] createGoal",
      defaultValue: null,
      fallbackQuery: async () => {
        // fallback: tenant_id, student_id 컬럼이 없는 경우
        const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
        const queryResult = await supabase
          .from("student_goals")
          .insert(fallbackPayload)
          .select("id")
          .single();
        return {
          data: extractJoinResult(queryResult.data),
          error: queryResult.error,
        };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  if (!result) {
    return { success: false, error: "목표 생성 실패" };
  }

  return { success: true, goalId: result.id };
}

/**
 * 목표 업데이트
 */
export async function updateGoal(
  goalId: string,
  studentId: string,
  updates: {
    goal_type?: "range" | "exam" | "weekly" | "monthly";
    title?: string;
    description?: string | null;
    subject?: string | null;
    content_id?: string | null;
    start_date?: string;
    end_date?: string;
    expected_amount?: number | null;
    target_score?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, string | number | null> = {};
  if (updates.goal_type !== undefined) payload.goal_type = updates.goal_type;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.subject !== undefined) payload.subject = updates.subject;
  if (updates.content_id !== undefined) payload.content_id = updates.content_id;
  if (updates.start_date !== undefined) payload.start_date = updates.start_date;
  if (updates.end_date !== undefined) payload.end_date = updates.end_date;
  if (updates.expected_amount !== undefined) payload.expected_amount = updates.expected_amount;
  if (updates.target_score !== undefined) payload.target_score = updates.target_score;

  await createTypedConditionalQuery<null>(
    async () => {
      const queryResult = await supabase
        .from("student_goals")
        .update(payload)
        .eq("id", goalId)
        .eq("student_id", studentId);
      return { data: null, error: queryResult.error };
    },
    {
      context: "[data/studentGoals] updateGoal",
      defaultValue: null,
      fallbackQuery: async () => {
        const queryResult = await supabase
          .from("student_goals")
          .update(payload)
          .eq("id", goalId);
        return { data: null, error: queryResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  return { success: true };
}

/**
 * 목표 삭제
 */
export async function deleteGoal(
  goalId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  await createTypedConditionalQuery<null>(
    async () => {
      const queryResult = await supabase
        .from("student_goals")
        .delete()
        .eq("id", goalId)
        .eq("student_id", studentId);
      return { data: null, error: queryResult.error };
    },
    {
      context: "[data/studentGoals] deleteGoal",
      defaultValue: null,
      fallbackQuery: async () => {
        const queryResult = await supabase
          .from("student_goals")
          .delete()
          .eq("id", goalId);
        return { data: null, error: queryResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  return { success: true };
}

/**
 * 목표 진행률 기록
 */
export async function recordGoalProgress(
  progress: {
    tenant_id?: string | null;
    student_id: string;
    goal_id: string;
    plan_id?: string | null;
    session_id?: string | null;
    progress_amount: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: progress.tenant_id || null,
    student_id: progress.student_id,
    goal_id: progress.goal_id,
    plan_id: progress.plan_id || null,
    session_id: progress.session_id || null,
    progress_amount: progress.progress_amount,
  };

  await createTypedConditionalQuery<null>(
    async () => {
      const queryResult = await supabase
        .from("student_goal_progress")
        .insert(payload)
        .eq("student_id", progress.student_id);
      return { data: null, error: queryResult.error };
    },
    {
      context: "[data/studentGoals] recordGoalProgress",
      defaultValue: null,
      fallbackQuery: async () => {
        // fallback: tenant_id, student_id 컬럼이 없는 경우
        const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
        const queryResult = await supabase
          .from("student_goal_progress")
          .insert(fallbackPayload);
        return { data: null, error: queryResult.error };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  );

  return { success: true };
}

/**
 * 목표의 진행률 목록 조회
 */
export async function getGoalProgressList(
  goalId: string,
  studentId: string,
  tenantId?: string | null
): Promise<GoalProgress[]> {
  const supabase = await createSupabaseServerClient();

  return await createTypedConditionalQuery<GoalProgress[]>(
    async () => {
      let query = supabase
        .from("student_goal_progress")
        .select(
          "id,tenant_id,student_id,goal_id,plan_id,session_id,progress_amount,created_at"
        )
        .eq("goal_id", goalId)
        .eq("student_id", studentId);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const queryResult = await query.order("created_at", { ascending: false });
      return {
        data: queryResult.data as GoalProgress[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/studentGoals] getGoalProgressList",
      defaultValue: [],
      fallbackQuery: async () => {
        const queryResult = await supabase
          .from("student_goal_progress")
          .select(
            "id,tenant_id,student_id,goal_id,plan_id,session_id,progress_amount,created_at"
          )
          .eq("goal_id", goalId)
          .eq("student_id", studentId)
          .order("created_at", { ascending: false });
        return {
          data: queryResult.data as GoalProgress[] | null,
          error: queryResult.error,
        };
      },
      shouldFallback: (error) => ErrorCodeCheckers.isColumnNotFound(error),
    }
  ) ?? [];
}

