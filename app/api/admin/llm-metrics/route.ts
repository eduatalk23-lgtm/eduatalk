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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    // DB 소스 사용 가능 여부 확인 (프로덕션 우선)
    const supabase = createSupabaseAdminClient();
    const useDb = !!supabase && process.env.NODE_ENV !== "development";

    const response: Record<string, unknown> = {
      period,
      generatedAt: new Date().toISOString(),
      source: useDb ? "database" : "in-memory",
    };

    if (useDb) {
      // DB 기반 조회 (프로덕션)
      const periodMs = { "1h": 3600_000, "6h": 21600_000, "24h": 86400_000, "7d": 604800_000, "30d": 2592000_000 };
      const since = new Date(Date.now() - (periodMs[period] ?? 86400_000)).toISOString();

      if (view === "summary" || view === "all") {
        const { data } = await supabase
          .from("llm_metrics_logs" as never)
          .select("duration_ms, cost_usd, error_occurred, rec_strategy, cache_hit, input_tokens, output_tokens" as never)
          .gte("timestamp" as never, since as never);

        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const total = rows.length;
        const errors = rows.filter((r) => r.error_occurred).length;
        const durations = rows.map((r) => Number(r.duration_ms) || 0).sort((a, b) => a - b);
        const p95Idx = Math.floor(total * 0.95);

        response.summary = {
          totalRequests: total,
          successCount: total - errors,
          failureCount: errors,
          successRate: total > 0 ? Math.round(((total - errors) / total) * 100) : 0,
          avgDurationMs: total > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / total) : 0,
          p95DurationMs: durations[p95Idx] ?? 0,
          maxDurationMs: durations[total - 1] ?? 0,
          totalInputTokens: rows.reduce((s, r) => s + (Number(r.input_tokens) || 0), 0),
          totalOutputTokens: rows.reduce((s, r) => s + (Number(r.output_tokens) || 0), 0),
          totalCostUSD: rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0),
          cacheHits: rows.filter((r) => r.cache_hit).length,
          cacheHitRate: total > 0 ? Math.round((rows.filter((r) => r.cache_hit).length / total) * 100) : 0,
        };
      }

      if (view === "errors" || view === "all") {
        const { data } = await supabase
          .from("llm_metrics_logs" as never)
          .select("error_type, error_message, error_stage, source, timestamp" as never)
          .gte("timestamp" as never, since as never)
          .eq("error_occurred" as never, true as never)
          .order("timestamp" as never, { ascending: false } as never)
          .limit(50);

        response.errors = data ?? [];
      }

      if (view === "costs" || view === "all") {
        const { data } = await supabase
          .from("llm_metrics_logs" as never)
          .select("source, model_tier, provider, cost_usd, input_tokens, output_tokens" as never)
          .gte("timestamp" as never, since as never);

        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const bySource: Record<string, { count: number; totalCost: number }> = {};
        for (const r of rows) {
          const src = String(r.source);
          if (!bySource[src]) bySource[src] = { count: 0, totalCost: 0 };
          bySource[src].count++;
          bySource[src].totalCost += Number(r.cost_usd) || 0;
        }
        response.costs = {
          totalCostUSD: rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0),
          bySource,
        };
      }

      // sources, timeseries는 인메모리 폴백 (DB 집계 복잡도 높음)
      if (view === "sources" || view === "all") {
        response.bySource = getMetricsBySource(options);
      }
      if (view === "timeseries" || view === "all") {
        response.timeseries = getMetricsTimeSeries({ ...options, intervalMinutes });
      }
    } else {
      // 인메모리 기반 (개발 환경)
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
    }

    return apiSuccess(response);
  } catch (error) {
    return handleApiError(error);
  }
}
