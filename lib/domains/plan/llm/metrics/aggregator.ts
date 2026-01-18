/**
 * LLM 메트릭스 집계 서비스
 *
 * 저장된 메트릭스를 집계하여 통계 정보를 제공합니다.
 * 성공률, 평균 응답 시간, 비용 등의 KPI를 계산합니다.
 *
 * @module lib/domains/plan/llm/metrics/aggregator
 */

import type {
  LLMRecommendationMetrics,
  AggregatedMetrics,
  RecommendationStrategy,
  MetricsSource,
} from "./types";
import { getMetricsStore, type MetricsFilterOptions } from "./store";

/**
 * 집계 옵션
 */
export interface AggregationOptions extends MetricsFilterOptions {
  /** 집계 기간 프리셋 */
  period?: "1h" | "6h" | "24h" | "7d" | "30d";
}

/**
 * 소스별 집계 결과
 */
export interface SourceBreakdown {
  source: MetricsSource;
  metrics: AggregatedMetrics;
}

/**
 * 시간대별 집계 결과
 */
export interface TimeSeriesPoint {
  timestamp: string;
  requestCount: number;
  successRate: number;
  avgDurationMs: number;
  totalCostUSD: number;
}

/**
 * 기간 프리셋을 시작/종료 시간으로 변환
 */
function getPeriodRange(period: AggregationOptions["period"]): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();

  let startDate: Date;
  switch (period) {
    case "1h":
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "6h":
      startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case "24h":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 기본: 24시간
  }

  return { start: startDate.toISOString(), end };
}

/**
 * P95 계산 (상위 5%의 최소값)
 */
function calculateP95(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 메트릭스 배열을 집계하여 AggregatedMetrics 생성
 */
export function aggregateMetrics(
  metrics: LLMRecommendationMetrics[],
  period: { start: string; end: string }
): AggregatedMetrics {
  if (metrics.length === 0) {
    return createEmptyAggregation(period);
  }

  // 기본 통계
  const totalRequests = metrics.length;
  const successCount = metrics.filter((m) => !m.error?.occurred).length;
  const failureCount = totalRequests - successCount;
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

  // 성능 통계
  const durations = metrics.map((m) => m.durationMs);
  const avgDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95DurationMs = calculateP95(durations);
  const maxDurationMs = Math.max(...durations);

  // 토큰 및 비용 통계
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUSD = 0;

  metrics.forEach((m) => {
    if (m.tokenUsage) {
      totalInputTokens += m.tokenUsage.inputTokens;
      totalOutputTokens += m.tokenUsage.outputTokens;
    }
    if (m.cost) {
      totalCostUSD += m.cost.estimatedUSD;
    }
  });

  // 전략별 통계
  const strategyUsage: Record<RecommendationStrategy, number> = {
    cache: 0,
    recommend: 0,
    coldStart: 0,
    enhanced: 0,
  };

  metrics.forEach((m) => {
    const strategy = m.recommendation.strategy;
    if (strategy in strategyUsage) {
      strategyUsage[strategy]++;
    }
  });

  // 캐시 통계
  const cacheHits = metrics.filter((m) => m.cache?.hit).length;
  const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

  return {
    period,
    totalRequests,
    successCount,
    failureCount,
    successRate: Math.round(successRate * 100) / 100,
    avgDurationMs: Math.round(avgDurationMs),
    p95DurationMs: Math.round(p95DurationMs),
    maxDurationMs: Math.round(maxDurationMs),
    totalInputTokens,
    totalOutputTokens,
    totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    strategyUsage,
    cacheHits,
    cacheHitRate: Math.round(cacheHitRate * 100) / 100,
  };
}

/**
 * 빈 집계 결과 생성
 */
function createEmptyAggregation(period: { start: string; end: string }): AggregatedMetrics {
  return {
    period,
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 0,
    avgDurationMs: 0,
    p95DurationMs: 0,
    maxDurationMs: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUSD: 0,
    strategyUsage: {
      cache: 0,
      recommend: 0,
      coldStart: 0,
      enhanced: 0,
    },
    cacheHits: 0,
    cacheHitRate: 0,
  };
}

// ============================================
// 공개 API
// ============================================

/**
 * 메트릭스 집계 조회
 *
 * @example
 * ```typescript
 * // 최근 24시간 집계
 * const stats = getAggregatedMetrics({ period: "24h" });
 *
 * console.log(`성공률: ${stats.successRate}%`);
 * console.log(`평균 응답 시간: ${stats.avgDurationMs}ms`);
 * console.log(`전체 비용: $${stats.totalCostUSD}`);
 * ```
 */
export function getAggregatedMetrics(options: AggregationOptions = {}): AggregatedMetrics {
  const store = getMetricsStore();

  // 기간 설정
  let period: { start: string; end: string };
  if (options.period) {
    period = getPeriodRange(options.period);
  } else if (options.startTime && options.endTime) {
    period = { start: options.startTime, end: options.endTime };
  } else {
    period = getPeriodRange("24h");
  }

  // 필터 옵션 구성
  const filterOptions: MetricsFilterOptions = {
    ...options,
    startTime: period.start,
    endTime: period.end,
  };

  const metrics = store.query(filterOptions);
  return aggregateMetrics(metrics, period);
}

/**
 * 소스별 집계 조회
 *
 * @example
 * ```typescript
 * const breakdown = getMetricsBySource({ period: "24h" });
 *
 * breakdown.forEach(({ source, metrics }) => {
 *   console.log(`${source}: ${metrics.totalRequests}건, 성공률 ${metrics.successRate}%`);
 * });
 * ```
 */
export function getMetricsBySource(options: AggregationOptions = {}): SourceBreakdown[] {
  const store = getMetricsStore();

  // 기간 설정
  let period: { start: string; end: string };
  if (options.period) {
    period = getPeriodRange(options.period);
  } else if (options.startTime && options.endTime) {
    period = { start: options.startTime, end: options.endTime };
  } else {
    period = getPeriodRange("24h");
  }

  const filterOptions: MetricsFilterOptions = {
    ...options,
    startTime: period.start,
    endTime: period.end,
  };

  const metrics = store.query(filterOptions);

  // 소스별 그룹화
  const bySource = new Map<MetricsSource, LLMRecommendationMetrics[]>();

  metrics.forEach((m) => {
    const existing = bySource.get(m.source) ?? [];
    existing.push(m);
    bySource.set(m.source, existing);
  });

  // 각 소스별 집계
  const result: SourceBreakdown[] = [];

  bySource.forEach((sourceMetrics, source) => {
    result.push({
      source,
      metrics: aggregateMetrics(sourceMetrics, period),
    });
  });

  // 요청 수 기준 정렬
  return result.sort((a, b) => b.metrics.totalRequests - a.metrics.totalRequests);
}

/**
 * 시간대별 추이 조회
 *
 * @example
 * ```typescript
 * const timeSeries = getMetricsTimeSeries({
 *   period: "24h",
 *   intervalMinutes: 60, // 1시간 간격
 * });
 *
 * timeSeries.forEach((point) => {
 *   console.log(`${point.timestamp}: ${point.requestCount}건`);
 * });
 * ```
 */
export function getMetricsTimeSeries(
  options: AggregationOptions & { intervalMinutes?: number } = {}
): TimeSeriesPoint[] {
  const store = getMetricsStore();
  const intervalMinutes = options.intervalMinutes ?? 60;

  // 기간 설정
  let period: { start: string; end: string };
  if (options.period) {
    period = getPeriodRange(options.period);
  } else if (options.startTime && options.endTime) {
    period = { start: options.startTime, end: options.endTime };
  } else {
    period = getPeriodRange("24h");
  }

  const filterOptions: MetricsFilterOptions = {
    ...options,
    startTime: period.start,
    endTime: period.end,
  };

  const metrics = store.query(filterOptions);

  // 시간대별 그룹화
  const intervalMs = intervalMinutes * 60 * 1000;
  const startTs = new Date(period.start).getTime();
  const endTs = new Date(period.end).getTime();

  const buckets = new Map<number, LLMRecommendationMetrics[]>();

  // 빈 버킷 초기화
  for (let ts = startTs; ts < endTs; ts += intervalMs) {
    buckets.set(ts, []);
  }

  // 메트릭스를 버킷에 배치
  metrics.forEach((m) => {
    const ts = new Date(m.timestamp).getTime();
    const bucketTs = startTs + Math.floor((ts - startTs) / intervalMs) * intervalMs;

    if (buckets.has(bucketTs)) {
      buckets.get(bucketTs)!.push(m);
    }
  });

  // 각 버킷 집계
  const result: TimeSeriesPoint[] = [];

  buckets.forEach((bucketMetrics, bucketTs) => {
    const requestCount = bucketMetrics.length;
    const successCount = bucketMetrics.filter((m) => !m.error?.occurred).length;
    const successRate = requestCount > 0 ? (successCount / requestCount) * 100 : 0;

    const durations = bucketMetrics.map((m) => m.durationMs);
    const avgDurationMs =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const totalCostUSD = bucketMetrics.reduce((sum, m) => sum + (m.cost?.estimatedUSD ?? 0), 0);

    result.push({
      timestamp: new Date(bucketTs).toISOString(),
      requestCount,
      successRate: Math.round(successRate * 100) / 100,
      avgDurationMs: Math.round(avgDurationMs),
      totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    });
  });

  return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * 에러 통계 조회
 */
export function getErrorStats(
  options: AggregationOptions = {}
): {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByStage: Record<string, number>;
  recentErrors: Array<{
    timestamp: string;
    source: MetricsSource;
    type: string;
    message: string;
    stage?: string;
  }>;
} {
  const store = getMetricsStore();

  // 기간 설정
  let period: { start: string; end: string };
  if (options.period) {
    period = getPeriodRange(options.period);
  } else {
    period = getPeriodRange("24h");
  }

  const filterOptions: MetricsFilterOptions = {
    ...options,
    startTime: period.start,
    endTime: period.end,
    errorsOnly: true,
  };

  const errorMetrics = store.query(filterOptions);

  const errorsByType: Record<string, number> = {};
  const errorsByStage: Record<string, number> = {};

  errorMetrics.forEach((m) => {
    const type = m.error?.type ?? "unknown";
    const stage = m.error?.stage ?? "unknown";

    errorsByType[type] = (errorsByType[type] ?? 0) + 1;
    errorsByStage[stage] = (errorsByStage[stage] ?? 0) + 1;
  });

  const recentErrors = errorMetrics
    .slice(-10)
    .reverse()
    .map((m) => ({
      timestamp: m.timestamp,
      source: m.source,
      type: m.error?.type ?? "unknown",
      message: m.error?.message ?? "",
      stage: m.error?.stage,
    }));

  return {
    totalErrors: errorMetrics.length,
    errorsByType,
    errorsByStage,
    recentErrors,
  };
}

/**
 * 비용 분석 조회
 */
export function getCostAnalysis(
  options: AggregationOptions = {}
): {
  totalCostUSD: number;
  avgCostPerRequest: number;
  costBySource: Record<MetricsSource, number>;
  costByModelTier: Record<string, number>;
  projectedMonthlyCost: number;
} {
  const store = getMetricsStore();

  // 기간 설정
  let period: { start: string; end: string };
  if (options.period) {
    period = getPeriodRange(options.period);
  } else {
    period = getPeriodRange("24h");
  }

  const filterOptions: MetricsFilterOptions = {
    ...options,
    startTime: period.start,
    endTime: period.end,
  };

  const metrics = store.query(filterOptions);

  let totalCostUSD = 0;
  const costBySource: Record<string, number> = {};
  const costByModelTier: Record<string, number> = {};

  metrics.forEach((m) => {
    const cost = m.cost?.estimatedUSD ?? 0;
    totalCostUSD += cost;

    costBySource[m.source] = (costBySource[m.source] ?? 0) + cost;

    const tier = m.cost?.modelTier ?? "unknown";
    costByModelTier[tier] = (costByModelTier[tier] ?? 0) + cost;
  });

  const avgCostPerRequest = metrics.length > 0 ? totalCostUSD / metrics.length : 0;

  // 월간 비용 추정 (기간 기준)
  const periodMs = new Date(period.end).getTime() - new Date(period.start).getTime();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const projectedMonthlyCost = periodMs > 0 ? (totalCostUSD / periodMs) * monthMs : 0;

  return {
    totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    avgCostPerRequest: Math.round(avgCostPerRequest * 100000) / 100000,
    costBySource: costBySource as Record<MetricsSource, number>,
    costByModelTier,
    projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
  };
}
