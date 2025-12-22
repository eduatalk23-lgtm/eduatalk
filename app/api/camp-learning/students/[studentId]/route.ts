import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getParticipantLearningStats } from "@/lib/data/campLearningStats";
import { getCampTemplate } from "@/lib/data/campTemplates";
import type { ParticipantLearningStats } from "@/lib/domains/camp/types";


/**
 * 학생별 학습 통계 조회 API
 * GET /api/camp-learning/students/student-123?templateId=template-123
 *
 * @returns
 * 성공: { success: true, data: ParticipantLearningStats }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "consultant")) {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return apiUnauthorized();
    }

    const { studentId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");

    if (!templateId || !studentId) {
      return apiUnauthorized();
    }

    // 템플릿 정보 조회 (기간 정보 확인)
    const template = await getCampTemplate(templateId);
    if (!template || !template.camp_start_date || !template.camp_end_date) {
      return apiSuccess<ParticipantLearningStats | null>(null);
    }

    const stats = await getParticipantLearningStats(
      templateId,
      studentId,
      template.camp_start_date,
      template.camp_end_date
    );

    return apiSuccess<ParticipantLearningStats | null>(stats);
  } catch (error) {
    return handleApiError(error, "[api/camp-learning/students] 오류");
  }
}

