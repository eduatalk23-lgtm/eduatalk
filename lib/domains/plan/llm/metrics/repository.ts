/**
 * LLM 메트릭스 DB 영속화
 *
 * fire-and-forget 패턴: LLM 응답 경로를 절대 블로킹하지 않음.
 * 에러 시 console.warn만 출력하고 무시.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LLMRecommendationMetrics } from "./types";

interface LLMMetricsRow {
  id: string;
  timestamp: string;
  source: string;
  tenant_id: string | null;
  student_id: string | null;
  user_id: string | null;
  correlation_id: string | null;
  duration_ms: number;
  llm_call_duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  model_tier: string | null;
  provider: string | null;
  rec_count: number;
  rec_strategy: string;
  used_fallback: boolean;
  fallback_reason: string | null;
  cache_hit: boolean | null;
  error_occurred: boolean;
  error_type: string | null;
  error_message: string | null;
  error_stage: string | null;
  request_params: Record<string, unknown> | null;
}

function toRow(m: LLMRecommendationMetrics): LLMMetricsRow {
  return {
    id: m.id,
    timestamp: m.timestamp,
    source: m.source,
    tenant_id: m.tenantId ?? null,
    student_id: m.studentId ?? null,
    user_id: m.userId ?? null,
    correlation_id: m.correlationId ?? null,
    duration_ms: m.durationMs,
    llm_call_duration_ms: m.llmCallDurationMs ?? null,
    input_tokens: m.tokenUsage?.inputTokens ?? null,
    output_tokens: m.tokenUsage?.outputTokens ?? null,
    total_tokens: m.tokenUsage?.totalTokens ?? null,
    cost_usd: m.cost?.estimatedUSD ?? null,
    model_tier: m.cost?.modelTier ?? null,
    provider: m.cost?.provider ?? null,
    rec_count: m.recommendation.count,
    rec_strategy: m.recommendation.strategy,
    used_fallback: m.recommendation.usedFallback,
    fallback_reason: m.recommendation.fallbackReason ?? null,
    cache_hit: m.cache?.hit ?? null,
    error_occurred: m.error?.occurred ?? false,
    error_type: m.error?.type ?? null,
    error_message: m.error?.message ?? null,
    error_stage: m.error?.stage ?? null,
    request_params: m.requestParams
      ? (m.requestParams as Record<string, unknown>)
      : null,
  };
}

/**
 * 메트릭스를 DB에 비동기 저장 (fire-and-forget).
 * 이 함수는 Promise를 반환하지 않으며, 호출자를 블로킹하지 않음.
 */
export function persistMetrics(metrics: LLMRecommendationMetrics): void {
  (async () => {
    try {
      const supabase = createSupabaseAdminClient();
      if (!supabase) return;

      const row = toRow(metrics);
      const { error } = await supabase
        .from("llm_metrics_logs" as never)
        .insert(row as never);

      if (error) {
        console.warn("[llm-metrics] DB persist failed:", error.message);
      }
    } catch (err) {
      console.warn(
        "[llm-metrics] DB persist error:",
        err instanceof Error ? err.message : err,
      );
    }
  })();
}
