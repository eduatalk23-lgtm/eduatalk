/**
 * 메트릭스 집계 서비스 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getMetricsStore,
  resetMetricsStore,
  configureMetricsStore,
  getAggregatedMetrics,
  getMetricsBySource,
  getErrorStats,
  getCostAnalysis,
  aggregateMetrics,
  type LLMRecommendationMetrics,
} from "../index";

// 테스트용 메트릭스 생성 헬퍼
function createTestMetrics(
  overrides: Partial<LLMRecommendationMetrics> = {}
): LLMRecommendationMetrics {
  return {
    id: `test-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    source: "unifiedContentRecommendation",
    durationMs: 100,
    recommendation: {
      count: 5,
      strategy: "coldStart",
      usedFallback: false,
    },
    ...overrides,
  };
}

describe("MetricsStore", () => {
  beforeEach(() => {
    resetMetricsStore();
    configureMetricsStore({ enabled: true, maxSize: 100 });
  });

  describe("add and query", () => {
    it("should store and retrieve metrics", () => {
      const store = getMetricsStore();
      const metrics = createTestMetrics();

      store.add(metrics);

      expect(store.size()).toBe(1);
      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0].id).toBe(metrics.id);
    });

    it("should respect maxSize limit (ring buffer)", () => {
      configureMetricsStore({ maxSize: 5 });
      const store = getMetricsStore();

      // 10개 추가
      for (let i = 0; i < 10; i++) {
        store.add(createTestMetrics({ durationMs: i * 100 }));
      }

      expect(store.size()).toBe(5);
      // 가장 최근 5개만 유지
      const all = store.getAll();
      expect(all[0].durationMs).toBe(500);
      expect(all[4].durationMs).toBe(900);
    });

    it("should filter by source", () => {
      const store = getMetricsStore();

      store.add(createTestMetrics({ source: "coldStartPipeline" }));
      store.add(createTestMetrics({ source: "unifiedContentRecommendation" }));
      store.add(createTestMetrics({ source: "coldStartPipeline" }));

      const result = store.query({ source: "coldStartPipeline" });
      expect(result).toHaveLength(2);
    });

    it("should filter errors only", () => {
      const store = getMetricsStore();

      store.add(createTestMetrics());
      store.add(
        createTestMetrics({
          error: { occurred: true, type: "TestError", message: "test" },
        })
      );

      const result = store.query({ errorsOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0].error?.occurred).toBe(true);
    });
  });
});

describe("aggregateMetrics", () => {
  const period = {
    start: new Date(Date.now() - 3600000).toISOString(),
    end: new Date().toISOString(),
  };

  it("should return empty aggregation for empty array", () => {
    const result = aggregateMetrics([], period);

    expect(result.totalRequests).toBe(0);
    expect(result.successRate).toBe(0);
    expect(result.avgDurationMs).toBe(0);
  });

  it("should calculate success rate correctly", () => {
    const metrics = [
      createTestMetrics(),
      createTestMetrics(),
      createTestMetrics({ error: { occurred: true, type: "Error", message: "fail" } }),
    ];

    const result = aggregateMetrics(metrics, period);

    expect(result.totalRequests).toBe(3);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.successRate).toBeCloseTo(66.67, 1);
  });

  it("should calculate duration statistics", () => {
    const metrics = [
      createTestMetrics({ durationMs: 100 }),
      createTestMetrics({ durationMs: 200 }),
      createTestMetrics({ durationMs: 300 }),
      createTestMetrics({ durationMs: 1000 }), // P95 후보
    ];

    const result = aggregateMetrics(metrics, period);

    expect(result.avgDurationMs).toBe(400);
    expect(result.maxDurationMs).toBe(1000);
    expect(result.p95DurationMs).toBe(1000);
  });

  it("should aggregate token usage and cost", () => {
    const metrics = [
      createTestMetrics({
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        cost: { estimatedUSD: 0.001, modelTier: "fast" },
      }),
      createTestMetrics({
        tokenUsage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
        cost: { estimatedUSD: 0.002, modelTier: "fast" },
      }),
    ];

    const result = aggregateMetrics(metrics, period);

    expect(result.totalInputTokens).toBe(300);
    expect(result.totalOutputTokens).toBe(150);
    expect(result.totalCostUSD).toBeCloseTo(0.003, 4);
  });

  it("should count strategy usage", () => {
    const metrics = [
      createTestMetrics({ recommendation: { count: 5, strategy: "cache", usedFallback: false } }),
      createTestMetrics({ recommendation: { count: 5, strategy: "coldStart", usedFallback: false } }),
      createTestMetrics({ recommendation: { count: 5, strategy: "coldStart", usedFallback: false } }),
      createTestMetrics({ recommendation: { count: 5, strategy: "recommend", usedFallback: false } }),
    ];

    const result = aggregateMetrics(metrics, period);

    expect(result.strategyUsage.cache).toBe(1);
    expect(result.strategyUsage.coldStart).toBe(2);
    expect(result.strategyUsage.recommend).toBe(1);
    expect(result.strategyUsage.enhanced).toBe(0);
  });

  it("should calculate cache hit rate", () => {
    const metrics = [
      createTestMetrics({ cache: { hit: true } }),
      createTestMetrics({ cache: { hit: true } }),
      createTestMetrics({ cache: { hit: false } }),
      createTestMetrics(), // no cache info
    ];

    const result = aggregateMetrics(metrics, period);

    expect(result.cacheHits).toBe(2);
    expect(result.cacheHitRate).toBe(50);
  });
});

describe("getAggregatedMetrics", () => {
  beforeEach(() => {
    resetMetricsStore();
    configureMetricsStore({ enabled: true });
  });

  it("should aggregate metrics from store", () => {
    const store = getMetricsStore();

    store.add(createTestMetrics({ durationMs: 100 }));
    store.add(createTestMetrics({ durationMs: 200 }));
    store.add(createTestMetrics({ durationMs: 300 }));

    const result = getAggregatedMetrics({ period: "1h" });

    expect(result.totalRequests).toBe(3);
    expect(result.avgDurationMs).toBe(200);
  });
});

describe("getMetricsBySource", () => {
  beforeEach(() => {
    resetMetricsStore();
    configureMetricsStore({ enabled: true });
  });

  it("should group metrics by source", () => {
    const store = getMetricsStore();

    store.add(createTestMetrics({ source: "coldStartPipeline" }));
    store.add(createTestMetrics({ source: "coldStartPipeline" }));
    store.add(createTestMetrics({ source: "unifiedContentRecommendation" }));

    const result = getMetricsBySource({ period: "1h" });

    expect(result).toHaveLength(2);

    const coldStart = result.find((r) => r.source === "coldStartPipeline");
    const unified = result.find((r) => r.source === "unifiedContentRecommendation");

    expect(coldStart?.metrics.totalRequests).toBe(2);
    expect(unified?.metrics.totalRequests).toBe(1);
  });
});

describe("getErrorStats", () => {
  beforeEach(() => {
    resetMetricsStore();
    configureMetricsStore({ enabled: true });
  });

  it("should aggregate error statistics", () => {
    const store = getMetricsStore();

    store.add(createTestMetrics());
    store.add(
      createTestMetrics({
        error: { occurred: true, type: "ValidationError", message: "invalid", stage: "validation" },
      })
    );
    store.add(
      createTestMetrics({
        error: { occurred: true, type: "APIError", message: "timeout", stage: "search" },
      })
    );

    const result = getErrorStats({ period: "1h" });

    expect(result.totalErrors).toBe(2);
    expect(result.errorsByType["ValidationError"]).toBe(1);
    expect(result.errorsByType["APIError"]).toBe(1);
    expect(result.errorsByStage["validation"]).toBe(1);
    expect(result.errorsByStage["search"]).toBe(1);
    expect(result.recentErrors).toHaveLength(2);
  });
});

describe("getCostAnalysis", () => {
  beforeEach(() => {
    resetMetricsStore();
    configureMetricsStore({ enabled: true });
  });

  it("should analyze costs", () => {
    const store = getMetricsStore();

    store.add(
      createTestMetrics({
        source: "coldStartPipeline",
        cost: { estimatedUSD: 0.001, modelTier: "fast" },
      })
    );
    store.add(
      createTestMetrics({
        source: "unifiedContentRecommendation",
        cost: { estimatedUSD: 0.002, modelTier: "standard" },
      })
    );

    const result = getCostAnalysis({ period: "1h" });

    expect(result.totalCostUSD).toBeCloseTo(0.003, 4);
    expect(result.avgCostPerRequest).toBeCloseTo(0.0015, 5);
    expect(result.costBySource["coldStartPipeline"]).toBeCloseTo(0.001, 4);
    expect(result.costByModelTier["fast"]).toBeCloseTo(0.001, 4);
    expect(result.costByModelTier["standard"]).toBeCloseTo(0.002, 4);
  });
});
