import { NextRequest } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import {
  getAggregatedMetrics,
  getMetricsBySource,
  getMetricsTimeSeries,
  getErrorStats,
  getCostAnalysis,
  type AggregationOptions,
} from "@/lib/domains/plan/llm/metrics";

/**
 * LLM 메트릭스 조회 API (관리자용)
 *
 * GET /api/admin/llm-metrics
 *
 * Query Parameters:
 * - period: "1h" | "6h" | "24h" | "7d" | "30d" (기본: "24h")
 * - view: "summary" | "sources" | "timeseries" | "errors" | "costs" | "all" (기본: "summary")
 * - intervalMinutes: number (timeseries용, 기본: 60)
 *
 * @returns
 * 성공: { success: true, data: MetricsResponse }
 * 에러: { success: false, error: { code, message } }
 */
export async function GET(request: NextRequest) {
  try {
    // 관리자/컨설턴트 권한 체크
    const authResult = await requireAdminOrConsultant();
    if (!authResult) {
      return apiUnauthorized("관리자 또는 컨설턴트 권한이 필요합니다.");
    }

    const searchParams = request.nextUrl.searchParams;

    // 쿼리 파라미터 파싱
    const period = (searchParams.get("period") || "24h") as AggregationOptions["period"];
    const view = searchParams.get("view") || "summary";
    const intervalMinutes = parseInt(searchParams.get("intervalMinutes") || "60", 10);

    // 유효성 검사
    const validPeriods = ["1h", "6h", "24h", "7d", "30d"] as const;
    if (!validPeriods.includes(period as typeof validPeriods[number])) {
      return apiSuccess({
        error: `Invalid period. Valid values: ${validPeriods.join(", ")}`,
      });
    }

    const validViews = ["summary", "sources", "timeseries", "errors", "costs", "all"];
    if (!validViews.includes(view)) {
      return apiSuccess({
        error: `Invalid view. Valid values: ${validViews.join(", ")}`,
      });
    }

    const options: AggregationOptions = { period };

    // 뷰에 따른 데이터 수집
    const response: Record<string, unknown> = {
      period,
      generatedAt: new Date().toISOString(),
    };

    if (view === "summary" || view === "all") {
      response.summary = getAggregatedMetrics(options);
    }

    if (view === "sources" || view === "all") {
      response.bySource = getMetricsBySource(options);
    }

    if (view === "timeseries" || view === "all") {
      response.timeseries = getMetricsTimeSeries({ ...options, intervalMinutes });
    }

    if (view === "errors" || view === "all") {
      response.errors = getErrorStats(options);
    }

    if (view === "costs" || view === "all") {
      response.costs = getCostAnalysis(options);
    }

    return apiSuccess(response);
  } catch (error) {
    return handleApiError(error);
  }
}
