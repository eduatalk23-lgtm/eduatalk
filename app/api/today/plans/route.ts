import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { getTodayPlans, type TodayPlansResponse } from "@/lib/data/todayPlans";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIsoDate(value: string | null): string | null {
  if (!value || !ISO_DATE_REGEX.test(value)) {
    return null;
  }

  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : value;
}

export const dynamic = "force-dynamic";

/**
 * 오늘의 플랜 조회 API
 * GET /api/today/plans?date=YYYY-MM-DD&camp=true&includeProgress=true
 *
 * @returns
 * 성공: { success: true, data: TodayPlansResponse }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: Request) {
  console.time("[todayPlans] total");
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
    const isCampMode = searchParams.get("camp") === "true";
    const includeProgress = searchParams.get("includeProgress") !== "false"; // Default: true
    const noCache = searchParams.get("noCache") === "true"; // Allow cache bypass
    const useCache = !noCache; // Default: true (use cache)
    const cacheTtlSeconds = parseInt(searchParams.get("cacheTtl") || "120", 10); // Default: 120 seconds

    // Call the shared getTodayPlans function
    // This function contains all the DB queries, enrich logic, and todayProgress calculation
    const data = await getTodayPlans({
      studentId: user.userId,
      tenantId: tenantContext?.tenantId || null,
      date: targetDate,
      camp: isCampMode,
      includeProgress,
      narrowQueries: true, // Always use narrow queries for API endpoint
      useCache,
      cacheTtlSeconds,
    });

    console.timeEnd("[todayPlans] total");
    return apiSuccess<TodayPlansResponse>(data);
  } catch (error) {
    console.timeEnd("[todayPlans] total");
    return handleApiError(error, "[api/today/plans] 오류");
  }
}
