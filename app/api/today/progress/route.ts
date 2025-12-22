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


type TodayProgressResponse = {
  planDate: string;
  progress: Awaited<ReturnType<typeof calculateTodayProgress>>;
};

/**
 * 오늘의 성취도 조회 API
 * GET /api/today/progress?date=YYYY-MM-DD
 *
 * @returns
 * 성공: { success: true, data: TodayProgressResponse }
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

    return apiSuccess<TodayProgressResponse>({
      planDate: targetDate,
      progress,
    });
  } catch (error) {
    return handleApiError(error, "[api/today/progress] 오류");
  }
}
