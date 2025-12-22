import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getCampDatePlans } from "@/lib/data/campLearning";
import type { DatePlanDetail } from "@/lib/types/camp/learning";


/**
 * 날짜별 플랜 조회 API
 * GET /api/camp-learning/date/2024-01-15?templateId=template-123&studentIds=student-1,student-2
 *
 * @returns
 * 성공: { success: true, data: DatePlanDetail }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
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

    const { date } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("templateId");
    const studentIdsParam = searchParams.get("studentIds");

    if (!templateId || !date) {
      return apiUnauthorized();
    }

    // 학생 ID 필터 파싱
    const studentIds = studentIdsParam
      ? studentIdsParam.split(",").filter((id) => id.trim().length > 0)
      : undefined;

    const planDetail = await getCampDatePlans(templateId, date, studentIds);

    return apiSuccess<DatePlanDetail>(planDetail);
  } catch (error) {
    return handleApiError(error, "[api/camp-learning/date] 오류");
  }
}

