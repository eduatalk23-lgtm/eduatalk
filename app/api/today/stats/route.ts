import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { calculateTodayProgress } from "@/lib/metrics/todayProgress";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIsoDate(value: string | null): string | null {
  if (!value || !ISO_DATE_REGEX.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}


type TodayStatsResponse = {
  planDate: string;
  progress: Awaited<ReturnType<typeof calculateTodayProgress>>;
};

/**
 * 오늘의 성취도 통계 조회 API (Statistics용)
 * GET /api/today/stats?date=YYYY-MM-DD
 *
 * /api/today/progress와 동일한 로직이지만, 명확성을 위해 별도 엔드포인트로 분리
 * Suspense를 통한 비동기 로딩에 사용됨
 *
 * @returns
 * 성공: { success: true, data: TodayStatsResponse }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = today.toISOString().slice(0, 10);

    const { searchParams } = new URL(request.url);
    const requestedDateParam = normalizeIsoDate(searchParams.get("date"));
    const targetDate = requestedDateParam ?? todayDate;

    const progress = await calculateTodayProgress(
      user.userId,
      tenantContext?.tenantId || null,
      targetDate
    );

    return apiSuccess<TodayStatsResponse>({
      planDate: targetDate,
      progress,
    });
  } catch (error) {
    return handleApiError(error, "[api/today/stats] 오류");
  }
}

