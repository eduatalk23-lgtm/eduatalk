/**
 * LLM 메트릭스 모듈
 *
 * 추천 시스템의 성능, 비용, 품질 추적을 위한 메트릭스 시스템
 *
 * @example
 * ```typescript
 * import {
 *   MetricsBuilder,
 *   logRecommendationSuccess,
 *   logRecommendationError,
 * } from "@/lib/domains/plan/llm/metrics";
 *
 * // 상세 메트릭스 로깅
 * MetricsBuilder.create("unifiedContentRecommendation")
 *   .setContext({ studentId, tenantId })
 *   .setTokenUsage({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 })
 *   .setCost({ estimatedUSD: 0.002, modelTier: "fast" })
 *   .setRecommendation({ count: 5, strategy: "coldStart", usedFallback: false })
 *   .log();
 *
 * // 간단한 성공 로깅
 * logRecommendationSuccess("recommendContent", {
 *   strategy: "recommend",
 *   count: 5,
 *   durationMs: 1200,
 *   tokenUsage: { inputTokens: 800, outputTokens: 400, totalTokens: 1200 },
 *   costUSD: 0.001,
 *   modelTier: "fast",
 * });
 * ```
 *
 * @module lib/domains/plan/llm/metrics
 */

// 타입 export
export type {
  RecommendationStrategy,
  MetricsSource,
  TokenUsage,
  CostInfo,
  WebSearchMetrics,
  CacheMetrics,
  ErrorMetrics,
  RecommendationResultMetrics,
  LLMRecommendationMetrics,
  AggregatedMetrics,
} from "./types";

// 로거 export
export {
  MetricsBuilder,
  logLLMMetrics,
  logRecommendationSuccess,
  logRecommendationFallback,
  logRecommendationError,
  logCacheHit,
} from "./logger";
