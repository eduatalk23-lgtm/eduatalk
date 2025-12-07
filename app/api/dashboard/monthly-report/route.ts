import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMonthlyReportData } from "@/lib/reports/monthly";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { perfTime } from "@/lib/utils/perfLog";

export const dynamic = "force-dynamic";

/**
 * 대시보드 월간 리포트 조회 API
 * GET /api/dashboard/monthly-report?monthDate=YYYY-MM-DD
 *
 * @returns
 * 성공: { success: true, data: MonthlyReport }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  const timer = perfTime("[dashboard] api - monthlyReport");
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      timer.end();
      return apiUnauthorized();
    }

    const { searchParams } = new URL(request.url);
    const monthDateParam = searchParams.get("monthDate");
    
    // monthDate가 없으면 오늘 날짜 사용
    const monthDate = monthDateParam
      ? new Date(monthDateParam + "T00:00:00")
      : new Date();

    if (Number.isNaN(monthDate.getTime())) {
      timer.end();
      return handleApiError(
        new Error("Invalid monthDate parameter"),
        "[api/dashboard/monthly-report] 잘못된 날짜 형식"
      );
    }

    const supabase = await createSupabaseServerClient();
    const monthlyReport = await getMonthlyReportData(
      supabase,
      user.userId,
      monthDate
    );

    timer.end();
    return apiSuccess(monthlyReport);
  } catch (error) {
    timer.end();
    return handleApiError(error, "[api/dashboard/monthly-report] 오류");
  }
}

