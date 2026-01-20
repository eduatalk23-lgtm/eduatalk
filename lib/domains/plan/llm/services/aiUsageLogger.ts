/**
 * AI 사용량 로깅 서비스
 *
 * AI API 호출 시 사용량과 비용을 DB에 기록합니다.
 * 비동기로 동작하여 메인 플로우에 영향을 주지 않습니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ModelTier } from "../types";

// ============================================
// 타입 정의
// ============================================

// P3-4: AI 액션 타입 확장
export type AIActionType =
  | "generate_plan"
  | "stream_plan"
  | "preview_plan"
  | "recommend_content"
  | "optimize_plan"
  | "regenerate_partial"
  | "search_content"
  // P3-4: 새로운 파이프라인 액션 타입
  | "generate_hybrid_plan"
  | "generate_unified_plan"
  | "batch_generate_plan"
  | "cold_start_recommendation"
  | "web_search_content";

export type PlanningMode = "strategy" | "schedule" | "hybrid" | "unified";

// P3-4: 파이프라인 식별자
export type PipelineType =
  | "hybrid_complete"
  | "unified"
  | "batch"
  | "cold_start"
  | "legacy";

export interface AIUsageLogEntry {
  tenantId: string;
  studentId?: string | null;
  userId: string;
  actionType: AIActionType;
  planningMode?: PlanningMode | null;
  modelTier: ModelTier;
  modelId?: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  webSearchEnabled?: boolean;
  webSearchResultsCount?: number;
  success: boolean;
  errorMessage?: string | null;
  requestDurationMs?: number | null;
  metadata?: Record<string, unknown>;
  // P3-4: 확장 필드
  pipelineType?: PipelineType | null;
  batchId?: string | null;
  planGroupId?: string | null;
  plannerId?: string | null;
  contentIds?: string[] | null;
  isFallback?: boolean;
  fallbackReason?: string | null;
  cacheHit?: boolean;
  retryCount?: number;
}

// P3-4: 배치 작업 요약 타입
export interface BatchUsageSummary {
  batchId: string;
  totalStudents: number;
  successfulStudents: number;
  failedStudents: number;
  totalTokens: number;
  totalCostUsd: number;
  averageTokensPerStudent: number;
  averageCostPerStudent: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface UsageSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byActionType: Record<string, {
    count: number;
    tokens: number;
    cost: number;
  }>;
  byModelTier: Record<string, {
    count: number;
    tokens: number;
    cost: number;
  }>;
}

// ============================================
// 로깅 함수
// ============================================

/**
 * AI 사용량을 DB에 기록합니다.
 * 비동기로 실행되며, 실패해도 메인 플로우에 영향을 주지 않습니다.
 *
 * P3-4: 확장 필드 지원 (pipelineType, batchId, planGroupId 등)
 */
export async function logAIUsage(entry: AIUsageLogEntry): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    // P3-4: 확장 필드를 metadata에 병합
    const extendedMetadata = {
      ...(entry.metadata || {}),
      // 확장 필드들 (DB 스키마에 컬럼이 없으면 metadata에 저장)
      ...(entry.pipelineType && { pipeline_type: entry.pipelineType }),
      ...(entry.batchId && { batch_id: entry.batchId }),
      ...(entry.planGroupId && { plan_group_id: entry.planGroupId }),
      ...(entry.plannerId && { planner_id: entry.plannerId }),
      ...(entry.contentIds && { content_ids: entry.contentIds }),
      ...(entry.isFallback !== undefined && { is_fallback: entry.isFallback }),
      ...(entry.fallbackReason && { fallback_reason: entry.fallbackReason }),
      ...(entry.cacheHit !== undefined && { cache_hit: entry.cacheHit }),
      ...(entry.retryCount !== undefined && { retry_count: entry.retryCount }),
    };

    const { error } = await supabase.from("ai_usage_logs").insert({
      tenant_id: entry.tenantId,
      student_id: entry.studentId || null,
      user_id: entry.userId,
      action_type: entry.actionType,
      planning_mode: entry.planningMode || null,
      model_tier: entry.modelTier,
      model_id: entry.modelId || null,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      estimated_cost_usd: entry.estimatedCostUsd,
      web_search_enabled: entry.webSearchEnabled ?? false,
      web_search_results_count: entry.webSearchResultsCount ?? 0,
      success: entry.success,
      error_message: entry.errorMessage || null,
      request_duration_ms: entry.requestDurationMs || null,
      metadata: extendedMetadata,
    });

    if (error) {
      // 로깅 실패는 콘솔에만 출력하고 에러를 던지지 않음
      console.warn("[aiUsageLogger] Failed to log AI usage:", error.message);
    }
  } catch (err) {
    // 예외도 무시 (비동기 로깅 실패가 메인 플로우에 영향 주지 않음)
    console.warn("[aiUsageLogger] Unexpected error:", err);
  }
}

/**
 * 비동기로 AI 사용량을 기록합니다 (fire-and-forget).
 * 호출 후 바로 반환되며, 로깅은 백그라운드에서 수행됩니다.
 */
export function logAIUsageAsync(entry: AIUsageLogEntry): void {
  // Promise를 반환하지 않고 fire-and-forget으로 실행
  logAIUsage(entry).catch(() => {
    // 에러 무시 (이미 내부에서 처리됨)
  });
}

// ============================================
// 조회 함수
// ============================================

/**
 * 테넌트별 AI 사용량 요약을 조회합니다.
 */
export async function getUsageSummary(
  tenantId: string,
  dateRange?: { start: string; end: string }
): Promise<UsageSummary | null> {
  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("ai_usage_logs")
      .select("*")
      .eq("tenant_id", tenantId);

    if (dateRange) {
      query = query
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error("[aiUsageLogger] Failed to get usage summary:", error?.message);
      return null;
    }

    // 요약 계산
    const summary: UsageSummary = {
      totalRequests: data.length,
      successfulRequests: data.filter((d) => d.success).length,
      failedRequests: data.filter((d) => !d.success).length,
      totalInputTokens: data.reduce((sum, d) => sum + (d.input_tokens || 0), 0),
      totalOutputTokens: data.reduce((sum, d) => sum + (d.output_tokens || 0), 0),
      totalCostUsd: data.reduce((sum, d) => sum + parseFloat(d.estimated_cost_usd || "0"), 0),
      byActionType: {},
      byModelTier: {},
    };

    // 액션 타입별 집계
    for (const log of data) {
      const actionType = log.action_type || "unknown";
      if (!summary.byActionType[actionType]) {
        summary.byActionType[actionType] = { count: 0, tokens: 0, cost: 0 };
      }
      summary.byActionType[actionType].count++;
      summary.byActionType[actionType].tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      summary.byActionType[actionType].cost += parseFloat(log.estimated_cost_usd || "0");
    }

    // 모델 티어별 집계
    for (const log of data) {
      const modelTier = log.model_tier || "unknown";
      if (!summary.byModelTier[modelTier]) {
        summary.byModelTier[modelTier] = { count: 0, tokens: 0, cost: 0 };
      }
      summary.byModelTier[modelTier].count++;
      summary.byModelTier[modelTier].tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      summary.byModelTier[modelTier].cost += parseFloat(log.estimated_cost_usd || "0");
    }

    return summary;
  } catch (err) {
    console.error("[aiUsageLogger] Unexpected error in getUsageSummary:", err);
    return null;
  }
}

/**
 * 최근 N개의 AI 사용 로그를 조회합니다.
 */
export async function getRecentLogs(
  tenantId: string,
  limit: number = 50
): Promise<AIUsageLogEntry[]> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[aiUsageLogger] Failed to get recent logs:", error?.message);
      return [];
    }

    return data.map((d) => ({
      tenantId: d.tenant_id,
      studentId: d.student_id,
      userId: d.user_id,
      actionType: d.action_type as AIActionType,
      planningMode: d.planning_mode as PlanningMode | null,
      modelTier: d.model_tier as ModelTier,
      modelId: d.model_id,
      inputTokens: d.input_tokens,
      outputTokens: d.output_tokens,
      estimatedCostUsd: parseFloat(d.estimated_cost_usd || "0"),
      webSearchEnabled: d.web_search_enabled,
      webSearchResultsCount: d.web_search_results_count,
      success: d.success,
      errorMessage: d.error_message,
      requestDurationMs: d.request_duration_ms,
      metadata: d.metadata as Record<string, unknown>,
    }));
  } catch (err) {
    console.error("[aiUsageLogger] Unexpected error in getRecentLogs:", err);
    return [];
  }
}

/**
 * 일별 사용량 통계를 조회합니다.
 */
export async function getDailyStats(
  tenantId: string,
  days: number = 30
): Promise<Array<{ date: string; requests: number; tokens: number; cost: number }>> {
  try {
    const supabase = await createSupabaseServerClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select("created_at, input_tokens, output_tokens, estimated_cost_usd")
      .eq("tenant_id", tenantId)
      .gte("created_at", startDate.toISOString());

    if (error || !data) {
      return [];
    }

    // 일별 집계
    const dailyMap = new Map<string, { requests: number; tokens: number; cost: number }>();

    for (const log of data) {
      const date = new Date(log.created_at).toISOString().split("T")[0];
      const existing = dailyMap.get(date) || { requests: 0, tokens: 0, cost: 0 };
      existing.requests++;
      existing.tokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      existing.cost += parseFloat(log.estimated_cost_usd || "0");
      dailyMap.set(date, existing);
    }

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error("[aiUsageLogger] Unexpected error in getDailyStats:", err);
    return [];
  }
}

// ============================================
// P3-4: 배치 작업 로깅 헬퍼
// ============================================

/**
 * 배치 작업의 사용량 요약을 조회합니다.
 */
export async function getBatchUsageSummary(
  tenantId: string,
  batchId: string
): Promise<BatchUsageSummary | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .contains("metadata", { batch_id: batchId });

    if (error || !data || data.length === 0) {
      return null;
    }

    const studentIds = new Set<string>();
    const successfulStudentIds = new Set<string>();
    const failedStudentIds = new Set<string>();
    let totalTokens = 0;
    let totalCost = 0;
    let earliestTime: string | null = null;
    let latestTime: string | null = null;

    for (const log of data) {
      const studentId = log.student_id;
      if (studentId) {
        studentIds.add(studentId);
        if (log.success) {
          successfulStudentIds.add(studentId);
        } else {
          failedStudentIds.add(studentId);
        }
      }
      totalTokens += (log.input_tokens || 0) + (log.output_tokens || 0);
      totalCost += parseFloat(log.estimated_cost_usd || "0");

      if (!earliestTime || log.created_at < earliestTime) {
        earliestTime = log.created_at;
      }
      if (!latestTime || log.created_at > latestTime) {
        latestTime = log.created_at;
      }
    }

    const totalStudents = studentIds.size;
    const durationMs = earliestTime && latestTime
      ? new Date(latestTime).getTime() - new Date(earliestTime).getTime()
      : undefined;

    return {
      batchId,
      totalStudents,
      successfulStudents: successfulStudentIds.size,
      failedStudents: failedStudentIds.size,
      totalTokens,
      totalCostUsd: totalCost,
      averageTokensPerStudent: totalStudents > 0 ? totalTokens / totalStudents : 0,
      averageCostPerStudent: totalStudents > 0 ? totalCost / totalStudents : 0,
      startedAt: earliestTime || new Date().toISOString(),
      completedAt: latestTime || undefined,
      durationMs,
    };
  } catch (err) {
    console.error("[aiUsageLogger] Unexpected error in getBatchUsageSummary:", err);
    return null;
  }
}

/**
 * 파이프라인별 사용량 통계를 조회합니다.
 */
export async function getUsageByPipeline(
  tenantId: string,
  dateRange?: { start: string; end: string }
): Promise<Record<string, { count: number; tokens: number; cost: number; avgDurationMs: number }>> {
  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("ai_usage_logs")
      .select("metadata, input_tokens, output_tokens, estimated_cost_usd, request_duration_ms")
      .eq("tenant_id", tenantId);

    if (dateRange) {
      query = query
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {};
    }

    const pipelineStats: Record<string, {
      count: number;
      tokens: number;
      cost: number;
      totalDurationMs: number;
      durationCount: number;
    }> = {};

    for (const log of data) {
      const metadata = log.metadata as Record<string, unknown> | null;
      const pipelineType = (metadata?.pipeline_type as string) || "legacy";

      if (!pipelineStats[pipelineType]) {
        pipelineStats[pipelineType] = {
          count: 0,
          tokens: 0,
          cost: 0,
          totalDurationMs: 0,
          durationCount: 0,
        };
      }

      pipelineStats[pipelineType].count++;
      pipelineStats[pipelineType].tokens +=
        (log.input_tokens || 0) + (log.output_tokens || 0);
      pipelineStats[pipelineType].cost +=
        parseFloat(log.estimated_cost_usd || "0");

      if (log.request_duration_ms) {
        pipelineStats[pipelineType].totalDurationMs += log.request_duration_ms;
        pipelineStats[pipelineType].durationCount++;
      }
    }

    // 평균 계산
    const result: Record<string, { count: number; tokens: number; cost: number; avgDurationMs: number }> = {};
    for (const [pipeline, stats] of Object.entries(pipelineStats)) {
      result[pipeline] = {
        count: stats.count,
        tokens: stats.tokens,
        cost: stats.cost,
        avgDurationMs: stats.durationCount > 0
          ? Math.round(stats.totalDurationMs / stats.durationCount)
          : 0,
      };
    }

    return result;
  } catch (err) {
    console.error("[aiUsageLogger] Unexpected error in getUsageByPipeline:", err);
    return {};
  }
}

/**
 * 콘솔에 사용량 요약을 출력합니다 (디버깅용).
 */
export function logUsageSummaryToConsole(
  action: string,
  entry: Partial<AIUsageLogEntry>
): void {
  const tokens = (entry.inputTokens || 0) + (entry.outputTokens || 0);
  const cost = entry.estimatedCostUsd || 0;
  const duration = entry.requestDurationMs || 0;

  console.log(
    `[AI Usage] ${action} | ` +
    `Tokens: ${tokens.toLocaleString()} (in: ${(entry.inputTokens || 0).toLocaleString()}, out: ${(entry.outputTokens || 0).toLocaleString()}) | ` +
    `Cost: $${cost.toFixed(6)} | ` +
    `Duration: ${duration}ms | ` +
    `Model: ${entry.modelId || entry.modelTier || "unknown"} | ` +
    `Success: ${entry.success ?? "N/A"}`
  );
}
