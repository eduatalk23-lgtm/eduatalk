import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getCampLearningRecords } from "@/lib/data/campLearning";
import type { PlanWithStudent } from "@/lib/types/camp/learning";


/**
 * 캠프 학습 기록 조회 API
 * GET /api/camp-learning/records?templateId=template-123&startDate=2024-01-01&endDate=2024-01-31
 *
 * @returns
 * 성공: { success: true, data: PlanWithStudent[] }
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!templateId || !startDate || !endDate) {
      return apiUnauthorized();
    }

    const records = await getCampLearningRecords(
      templateId,
      startDate,
      endDate
    );

    return apiSuccess<PlanWithStudent[]>(records);
  } catch (error) {
    return handleApiError(error, "[api/camp-learning/records] 오류");
  }
}

