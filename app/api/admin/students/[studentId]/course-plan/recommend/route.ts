import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { apiSuccess, handleApiError } from "@/lib/api";
import { generateRecommendationsAction } from "@/lib/domains/student-record/actions/coursePlan";

/**
 * 수강 계획 추천 자동 생성 (target_major 기반).
 *
 * POST /api/admin/students/[studentId]/course-plan/recommend
 *
 * 용도: seed / cross-run 스크립트에서 baseline 준비 시 수강계획 일괄 생성.
 * 내부적으로 `generateRecommendationsAction` 을 호출 — 기존 recommended plans 는
 *   repository 계층에서 wipe 후 재삽입된다 (confirmed/completed 는 유지).
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const auth = await requireAdminOrConsultant({ requireTenant: true });
    const { studentId } = await context.params;
    const tenantId = auth.tenantId!;

    const result = await generateRecommendationsAction(studentId, tenantId);
    if (!result.success) {
      return Response.json(result, { status: 400 });
    }
    return apiSuccess({ count: result.data.length, plans: result.data });
  } catch (err) {
    return handleApiError(err);
  }
}
