import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getGoalsForStudent } from "@/lib/data/studentGoals";

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
    const user = await getCurrentUser();

    if (!user || user.role !== "student") {
      return apiUnauthorized();
    }

    const goals = await getGoalsForStudent({
      studentId: user.userId,
      tenantId: user.tenantId,
    });

    // API 응답 형식에 맞게 변환
    const responseGoals: Goal[] = goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      goal_type: goal.goal_type,
      subject: goal.subject ?? null,
    }));

    return apiSuccess({ goals: responseGoals });
  } catch (error) {
    return handleApiError(error, "[api/goals/list] 오류");
  }
}
