/**
 * LLM 메트릭스 로거
 *
 * 추천 시스템의 성능, 비용, 품질 메트릭스를 로깅합니다.
 * 개발 환경에서는 콘솔 출력, 프로덕션에서는 JSON 형식으로 출력됩니다.
 *
 * @module lib/domains/plan/llm/metrics/logger
 */

import type {
  LLMRecommendationMetrics,
  MetricsSource,
  RecommendationStrategy,
  TokenUsage,
  CostInfo,
  WebSearchMetrics,
  CacheMetrics,
  ErrorMetrics,
  RecommendationResultMetrics,
} from "./types";
import { getMetricsStore } from "./store";

const isDev = process.env.NODE_ENV === "development";

/**
 * 유니크 메트릭스 ID 생성
 */
function generateMetricsId(): string {
  return `llm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 메트릭스 빌더 클래스
 *
 * 플루언트 API로 메트릭스를 구성하고 로깅합니다.
 *
 * @example
 * ```typescript
 * await MetricsBuilder.create("unifiedContentRecommendation")
 *   .setContext({ studentId, tenantId })
 *   .setDuration(durationMs)
 *   .setTokenUsage(usage)
 *   .setCost({ estimatedUSD: 0.001, modelTier: "fast" })
 *   .setRecommendation({ count: 5, strategy: "coldStart", usedFallback: false })
 *   .log();
 * ```
 */
export class MetricsBuilder {
  private metrics: Partial<LLMRecommendationMetrics>;
  private startTime: number;

  private constructor(source: MetricsSource) {
    this.startTime = performance.now();
    this.metrics = {
      id: generateMetricsId(),
      timestamp: new Date().toISOString(),
      source,
      durationMs: 0,
      recommendation: {
        count: 0,
        strategy: "coldStart",
        usedFallback: false,
      },
    };
  }

  /**
   * 메트릭스 빌더 생성
   */
  static create(source: MetricsSource): MetricsBuilder {
    return new MetricsBuilder(source);
  }

  /**
   * 컨텍스트 정보 설정
   */
  setContext(context: {
    tenantId?: string;
    studentId?: string;
    userId?: string;
    correlationId?: string;
  }): this {
    Object.assign(this.metrics, context);
    return this;
  }

  /**
   * 처리 시간 설정 (자동 계산 또는 수동 설정)
   */
  setDuration(durationMs?: number): this {
    this.metrics.durationMs = durationMs ?? Math.round(performance.now() - this.startTime);
    return this;
  }

  /**
   * LLM API 호출 시간 설정
   */
  setLLMCallDuration(durationMs: number): this {
    this.metrics.llmCallDurationMs = durationMs;
    return this;
  }

  /**
   * 토큰 사용량 설정
   */
  setTokenUsage(usage: TokenUsage): this {
    this.metrics.tokenUsage = usage;
    return this;
  }

  /**
   * 비용 정보 설정
   */
  setCost(cost: CostInfo): this {
    this.metrics.cost = cost;
    return this;
  }

  /**
   * 추천 결과 메트릭스 설정
   */
  setRecommendation(recommendation: RecommendationResultMetrics): this {
    this.metrics.recommendation = recommendation;
    return this;
  }

  /**
   * 웹 검색 메트릭스 설정
   */
  setWebSearch(webSearch: WebSearchMetrics): this {
    this.metrics.webSearch = webSearch;
    return this;
  }

  /**
   * 캐시 메트릭스 설정
   */
  setCache(cache: CacheMetrics): this {
    this.metrics.cache = cache;
    return this;
  }

  /**
   * 에러 메트릭스 설정
   */
  setError(error: ErrorMetrics): this {
    this.metrics.error = error;
    return this;
  }

  /**
   * 요청 파라미터 설정
   */
  setRequestParams(params: LLMRecommendationMetrics["requestParams"]): this {
    this.metrics.requestParams = params;
    return this;
  }

  /**
   * 메트릭스 로깅 (자동으로 duration 계산)
   */
  log(): LLMRecommendationMetrics {
    // duration이 설정되지 않았으면 자동 계산
    if (this.metrics.durationMs === 0) {
      this.metrics.durationMs = Math.round(performance.now() - this.startTime);
    }

    const finalMetrics = this.metrics as LLMRecommendationMetrics;

    // 로깅
    logLLMMetrics(finalMetrics);

    return finalMetrics;
  }

  /**
   * 현재 메트릭스 객체 반환 (로깅 없이)
   */
  build(): LLMRecommendationMetrics {
    if (this.metrics.durationMs === 0) {
      this.metrics.durationMs = Math.round(performance.now() - this.startTime);
    }
    return this.metrics as LLMRecommendationMetrics;
  }
}

/**
 * LLM 메트릭스 로깅
 */
export function logLLMMetrics(metrics: LLMRecommendationMetrics): void {
  // 저장소에 저장 (집계용)
  getMetricsStore().add(metrics);

  const logEntry = {
    type: "llm_metrics",
    ...metrics,
  };

  if (isDev) {
    // 개발 환경: 읽기 쉬운 형식
    const summary = formatMetricsSummary(metrics);
    console.log(`[LLM Metrics] ${summary}`);

    // 상세 정보는 debug 레벨
    console.debug(JSON.stringify(logEntry, null, 2));
  } else {
    // 프로덕션: JSON 형식 (로그 수집기용)
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * 메트릭스 요약 문자열 생성 (개발용)
 */
function formatMetricsSummary(metrics: LLMRecommendationMetrics): string {
  const parts: string[] = [
    `source=${metrics.source}`,
    `duration=${metrics.durationMs}ms`,
    `strategy=${metrics.recommendation.strategy}`,
    `count=${metrics.recommendation.count}`,
  ];

  if (metrics.tokenUsage) {
    parts.push(`tokens=${metrics.tokenUsage.totalTokens}`);
  }

  if (metrics.cost) {
    parts.push(`cost=$${metrics.cost.estimatedUSD.toFixed(4)}`);
  }

  if (metrics.cache?.hit) {
    parts.push("cache=HIT");
  }

  if (metrics.error?.occurred) {
    parts.push(`error=${metrics.error.type || "unknown"}`);
  }

  if (metrics.recommendation.usedFallback) {
    parts.push(`fallback=${metrics.recommendation.fallbackReason || "yes"}`);
  }

  return parts.join(" | ");
}

// ============================================
// 편의 함수들
// ============================================

/**
 * 간단한 성공 메트릭스 로깅
 */
export function logRecommendationSuccess(
  source: MetricsSource,
  options: {
    strategy: RecommendationStrategy;
    count: number;
    durationMs: number;
    tokenUsage?: TokenUsage;
    costUSD?: number;
    modelTier?: string;
    studentId?: string;
    tenantId?: string;
    cacheHit?: boolean;
    webSearchResults?: number;
  }
): void {
  const builder = MetricsBuilder.create(source)
    .setContext({
      studentId: options.studentId,
      tenantId: options.tenantId,
    })
    .setDuration(options.durationMs)
    .setRecommendation({
      count: options.count,
      strategy: options.strategy,
      usedFallback: false,
    });

  if (options.tokenUsage) {
    builder.setTokenUsage(options.tokenUsage);
  }

  if (options.costUSD !== undefined && options.modelTier) {
    builder.setCost({
      estimatedUSD: options.costUSD,
      modelTier: options.modelTier,
    });
  }

  if (options.cacheHit !== undefined) {
    builder.setCache({ hit: options.cacheHit });
  }

  if (options.webSearchResults !== undefined) {
    builder.setWebSearch({
      enabled: true,
      queriesCount: 1,
      resultsCount: options.webSearchResults,
    });
  }

  builder.log();
}

/**
 * 폴백 메트릭스 로깅
 */
export function logRecommendationFallback(
  source: MetricsSource,
  options: {
    originalStrategy: RecommendationStrategy;
    fallbackStrategy: RecommendationStrategy;
    fallbackReason: string;
    count: number;
    durationMs: number;
    studentId?: string;
    tenantId?: string;
  }
): void {
  MetricsBuilder.create(source)
    .setContext({
      studentId: options.studentId,
      tenantId: options.tenantId,
    })
    .setDuration(options.durationMs)
    .setRecommendation({
      count: options.count,
      strategy: options.fallbackStrategy,
      usedFallback: true,
      fallbackReason: `${options.originalStrategy} → ${options.fallbackStrategy}: ${options.fallbackReason}`,
    })
    .log();
}

/**
 * 에러 메트릭스 로깅
 */
export function logRecommendationError(
  source: MetricsSource,
  error: Error | string,
  options: {
    stage?: string;
    strategy?: RecommendationStrategy;
    durationMs?: number;
    studentId?: string;
    tenantId?: string;
  } = {}
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorType = error instanceof Error ? error.name : "UnknownError";

  MetricsBuilder.create(source)
    .setContext({
      studentId: options.studentId,
      tenantId: options.tenantId,
    })
    .setDuration(options.durationMs)
    .setRecommendation({
      count: 0,
      strategy: options.strategy || "coldStart",
      usedFallback: false,
    })
    .setError({
      occurred: true,
      type: errorType,
      message: errorMessage,
      stage: options.stage,
    })
    .log();
}

/**
 * 캐시 히트 메트릭스 로깅
 */
export function logCacheHit(
  source: MetricsSource,
  options: {
    count: number;
    cacheKey?: string;
    studentId?: string;
    tenantId?: string;
  }
): void {
  MetricsBuilder.create(source)
    .setContext({
      studentId: options.studentId,
      tenantId: options.tenantId,
    })
    .setDuration(0) // 캐시 히트는 거의 즉시
    .setRecommendation({
      count: options.count,
      strategy: "cache",
      usedFallback: false,
    })
    .setCache({
      hit: true,
      key: options.cacheKey,
    })
    .log();
}
