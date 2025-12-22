import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { calculateCampAttendanceStats } from "@/lib/domains/camp/attendance";
import { calculateCampLearningStats } from "@/lib/domains/camp/learningStats";
import type { CampAttendanceStats, CampLearningStats } from "@/lib/domains/camp/types";


/**
 * 캠프 통계 조회 API
 * GET /api/camp-stats?templateId=template-123
 *
 * @returns
 * 성공: { success: true, data: { attendance: CampAttendanceStats | null, learning: CampLearningStats | null } }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "consultant")) {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return apiUnauthorized();
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return apiUnauthorized();
    }

    const [attendance, learning] = await Promise.all([
      calculateCampAttendanceStats(templateId),
      calculateCampLearningStats(templateId),
    ]);

    return apiSuccess<{
      attendance: CampAttendanceStats | null;
      learning: CampLearningStats | null;
    }>({
      attendance,
      learning,
    });
  } catch (error) {
    return handleApiError(error, "[api/camp-stats] 오류");
  }
}

