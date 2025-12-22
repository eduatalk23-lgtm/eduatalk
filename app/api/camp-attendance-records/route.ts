import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import {
  getCampAttendanceRecordsByDate,
  getCampAttendanceRecordsWithStudents,
  type AttendanceRecordWithStudent,
} from "@/lib/data/campAttendance";

export const dynamic = "force-dynamic";

/**
 * 캠프 출석 기록 조회 API
 * GET /api/camp-attendance-records?templateId=template-123&date=2024-01-15
 * GET /api/camp-attendance-records?templateId=template-123&startDate=2024-01-01&endDate=2024-01-31
 *
 * @returns
 * 성공: { success: true, data: AttendanceRecordWithStudent[] }
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
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!templateId) {
      return apiUnauthorized();
    }

    let records: AttendanceRecordWithStudent[];

    // 날짜별 조회 (단일 날짜)
    if (date) {
      records = await getCampAttendanceRecordsByDate(templateId, date);
    }
    // 기간별 조회 (시작일 ~ 종료일)
    else if (startDate && endDate) {
      records = await getCampAttendanceRecordsWithStudents(
        templateId,
        startDate,
        endDate
      );
    } else {
      return apiUnauthorized();
    }

    return apiSuccess<AttendanceRecordWithStudent[]>(records);
  } catch (error) {
    return handleApiError(error, "[api/camp-attendance-records] 오류");
  }
}

