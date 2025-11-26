import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";

type Goal = {
  id: string;
  title: string;
  goal_type: string | null;
  subject: string | null;
};

/**
 * 목표 목록 조회 API
 * GET /api/goals/list
 *
 * @returns
 * 성공: { success: true, data: { goals: Goal[] } }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiUnauthorized();
    }

    const selectGoals = () =>
      supabase
        .from("student_goals")
        .select("id,title,goal_type,subject")
        .order("created_at", { ascending: false });

    let { data: goals, error } = await selectGoals().eq("student_id", user.id);

    // student_id 컬럼이 없는 경우 fallback
    if (error && error.code === "42703") {
      ({ data: goals, error } = await selectGoals());
    }

    if (error) {
      return handleApiError(error, "[api/goals/list] 목표 조회 실패");
    }

    return apiSuccess({ goals: (goals as Goal[]) || [] });
  } catch (error) {
    return handleApiError(error, "[api/goals/list] 오류");
  }
}
