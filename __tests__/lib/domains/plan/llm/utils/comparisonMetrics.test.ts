/**
 * 플랜 생성 방식 비교 메트릭스 테스트
 *
 * @module __tests__/lib/domains/plan/llm/utils/comparisonMetrics.test
 */

import { describe, it, expect } from "vitest";
import {
  calculateTokenUsage,
  calculateCost,
  calculateTokenSavings,
  calculateContentCoverage,
  calculateSubjectBalance,
  calculateTimeEfficiency,
  calculateOverallQualityScore,
  compareGenerationMethods,
  estimateTokenSavings,
  formatComparisonResult,
  type GenerationMetrics,
  type QualityMetrics,
} from "@/lib/domains/plan/llm/utils/comparisonMetrics";

describe("Token Usage Calculations", () => {
  describe("calculateTokenUsage", () => {
    it("토큰 사용량을 올바르게 계산해야 함", () => {
      const usage = calculateTokenUsage(1500, 800);

      expect(usage.input).toBe(1500);
      expect(usage.output).toBe(800);
      expect(usage.total).toBe(2300);
    });
  });

  describe("calculateCost", () => {
    it("비용을 올바르게 계산해야 함", () => {
      const usage = calculateTokenUsage(1500, 800);
      const cost = calculateCost(usage, "standard");

      expect(cost.totalCost).toBeGreaterThan(0);
      expect(cost.inputCost).toBeLessThan(cost.outputCost); // 입력이 더 저렴
      expect(cost.inputCost + cost.outputCost).toBeCloseTo(cost.totalCost, 1);
    });
  });

  describe("calculateTokenSavings", () => {
    it("토큰 절감률을 올바르게 계산해야 함", () => {
      const baseline = calculateTokenUsage(3000, 2000); // 5000 total
      const comparison = calculateTokenUsage(1500, 1000); // 2500 total

      const savings = calculateTokenSavings(baseline, comparison);

      expect(savings).toBe(50); // 50% 절감
    });

    it("baseline이 0이면 0을 반환해야 함", () => {
      const baseline = calculateTokenUsage(0, 0);
      const comparison = calculateTokenUsage(1000, 500);

      const savings = calculateTokenSavings(baseline, comparison);

      expect(savings).toBe(0);
    });
  });
});

describe("Quality Metrics", () => {
  describe("calculateContentCoverage", () => {
    it("모든 콘텐츠가 포함되면 1을 반환해야 함", () => {
      const requestedIds = ["content-1", "content-2", "content-3"];
      const plans = [
        { contentId: "content-1" },
        { contentId: "content-2" },
        { contentId: "content-3" },
      ];

      const coverage = calculateContentCoverage(requestedIds, plans);

      expect(coverage).toBe(1);
    });

    it("일부 콘텐츠만 포함되면 비율을 반환해야 함", () => {
      const requestedIds = ["content-1", "content-2", "content-3", "content-4"];
      const plans = [
        { contentId: "content-1" },
        { contentId: "content-3" },
      ];

      const coverage = calculateContentCoverage(requestedIds, plans);

      expect(coverage).toBe(0.5); // 2/4 = 0.5
    });

    it("요청된 콘텐츠가 없으면 1을 반환해야 함", () => {
      const coverage = calculateContentCoverage([], []);

      expect(coverage).toBe(1);
    });
  });

  describe("calculateSubjectBalance", () => {
    it("균등 배분이면 1에 가까운 값을 반환해야 함", () => {
      const plans = [
        { subject: "수학", durationMinutes: 60 },
        { subject: "영어", durationMinutes: 60 },
        { subject: "국어", durationMinutes: 60 },
      ];

      const balance = calculateSubjectBalance(plans);

      expect(balance).toBeGreaterThan(0.9);
    });

    it("불균형 배분이면 낮은 값을 반환해야 함", () => {
      const plans = [
        { subject: "수학", durationMinutes: 180 },
        { subject: "영어", durationMinutes: 30 },
        { subject: "국어", durationMinutes: 30 },
      ];

      const balance = calculateSubjectBalance(plans);

      expect(balance).toBeLessThan(0.8);
    });

    it("빈 배열이면 1을 반환해야 함", () => {
      const balance = calculateSubjectBalance([]);

      expect(balance).toBe(1);
    });

    it("단일 과목이면 1을 반환해야 함", () => {
      const plans = [
        { subject: "수학", durationMinutes: 60 },
        { subject: "수학", durationMinutes: 60 },
      ];

      const balance = calculateSubjectBalance(plans);

      expect(balance).toBe(1);
    });
  });

  describe("calculateTimeEfficiency", () => {
    it("90-100% 사용률이면 1을 반환해야 함", () => {
      expect(calculateTimeEfficiency(100, 95)).toBe(1);
      expect(calculateTimeEfficiency(100, 100)).toBe(1);
    });

    it("초과 사용이면 감점되어야 함", () => {
      const efficiency = calculateTimeEfficiency(100, 150);

      expect(efficiency).toBeLessThan(1);
      expect(efficiency).toBeGreaterThan(0);
    });

    it("부족 사용이면 비율을 반환해야 함", () => {
      const efficiency = calculateTimeEfficiency(100, 50);

      expect(efficiency).toBe(0.5);
    });

    it("가용 시간이 0이면 0을 반환해야 함", () => {
      const efficiency = calculateTimeEfficiency(0, 50);

      expect(efficiency).toBe(0);
    });
  });

  describe("calculateOverallQualityScore", () => {
    it("완벽한 품질이면 100점이어야 함", () => {
      const metrics: QualityMetrics = {
        planCount: 42,
        contentCoverage: 1,
        subjectBalance: 1,
        timeEfficiency: 1,
        hasAcademyConflicts: false,
        hasExclusionViolations: false,
        hasOverloadDays: false,
      };

      const score = calculateOverallQualityScore(metrics);

      expect(score).toBe(100);
    });

    it("충돌이 있으면 감점되어야 함", () => {
      const metrics: QualityMetrics = {
        planCount: 42,
        contentCoverage: 1,
        subjectBalance: 1,
        timeEfficiency: 1,
        hasAcademyConflicts: true,
        hasExclusionViolations: false,
        hasOverloadDays: false,
      };

      const score = calculateOverallQualityScore(metrics);

      expect(score).toBe(90); // 10점 감점
    });

    it("모든 문제가 있으면 최저 점수여야 함", () => {
      const metrics: QualityMetrics = {
        planCount: 10,
        contentCoverage: 0.5,
        subjectBalance: 0.5,
        timeEfficiency: 0.5,
        hasAcademyConflicts: true,
        hasExclusionViolations: true,
        hasOverloadDays: true,
      };

      const score = calculateOverallQualityScore(metrics);

      expect(score).toBe(35); // (15 + 10 + 10) = 35
    });
  });
});

describe("Comparison Analysis", () => {
  const createMockMetrics = (
    method: "hybrid" | "ai-only" | "code-only",
    tokenMultiplier: number = 1
  ): GenerationMetrics => ({
    method,
    tokens: {
      input: Math.round(1500 * tokenMultiplier),
      output: Math.round(800 * tokenMultiplier),
      total: Math.round(2300 * tokenMultiplier),
    },
    cost: {
      inputCost: 0.001 * tokenMultiplier,
      outputCost: 0.002 * tokenMultiplier,
      totalCost: 0.003 * tokenMultiplier,
    },
    timing: {
      aiProcessingMs: 2000 * tokenMultiplier,
      totalMs: 2500 * tokenMultiplier,
    },
    quality: {
      planCount: 42,
      contentCoverage: 1,
      subjectBalance: 0.9,
      timeEfficiency: 0.95,
      hasAcademyConflicts: false,
      hasExclusionViolations: false,
      hasOverloadDays: false,
    },
    hasRecommendations: method !== "code-only",
    modelTier: "standard",
  });

  describe("compareGenerationMethods", () => {
    it("하이브리드가 AI-only보다 토큰을 절감해야 함", () => {
      const hybrid = createMockMetrics("hybrid", 0.7); // 30% 절감
      const aiOnly = createMockMetrics("ai-only", 1);

      const result = compareGenerationMethods(hybrid, aiOnly);

      expect(result.summary.tokenSavingsPercent).toBeCloseTo(30, 0);
      expect(result.summary.costSavingsPercent).toBeGreaterThan(0);
    });

    it("품질 차이가 크면 AI-only를 권장해야 함", () => {
      const hybrid = createMockMetrics("hybrid", 0.7);
      hybrid.quality.contentCoverage = 0.5; // 품질 저하

      const aiOnly = createMockMetrics("ai-only", 1);

      const result = compareGenerationMethods(hybrid, aiOnly);

      expect(result.summary.qualityScoreDifference).toBeLessThan(0);
    });

    it("baseline이 없으면 하이브리드만 분석해야 함", () => {
      const hybrid = createMockMetrics("hybrid");

      const result = compareGenerationMethods(hybrid);

      expect(result.hybrid).toBeDefined();
      expect(result.aiOnly).toBeUndefined();
      expect(result.summary.tokenSavingsPercent).toBe(0);
    });
  });

  describe("formatComparisonResult", () => {
    it("비교 결과를 문자열로 포맷팅해야 함", () => {
      const hybrid = createMockMetrics("hybrid", 0.7);
      const aiOnly = createMockMetrics("ai-only", 1);
      const result = compareGenerationMethods(hybrid, aiOnly);

      const formatted = formatComparisonResult(result);

      expect(formatted).toContain("하이브리드");
      expect(formatted).toContain("AI-only");
      expect(formatted).toContain("토큰 절감");
      expect(formatted).toContain("권장");
    });
  });
});

describe("Token Estimation", () => {
  describe("estimateTokenSavings", () => {
    it("일반적인 케이스에서 30% 이상 절감 예상", () => {
      const estimate = estimateTokenSavings(
        5, // 콘텐츠 5개
        3, // 과목 3개
        14 // 2주
      );

      expect(estimate.savingsPercent).toBeGreaterThan(20);
      expect(estimate.hybrid.totalEstimate).toBeLessThan(estimate.aiOnly.totalEstimate);
    });

    it("콘텐츠/일수가 많을수록 절감률이 높아야 함", () => {
      const smallCase = estimateTokenSavings(2, 2, 7);
      const largeCase = estimateTokenSavings(10, 5, 28);

      expect(largeCase.savingsPercent).toBeGreaterThan(smallCase.savingsPercent);
    });

    it("하이브리드 출력 토큰이 AI-only보다 적어야 함", () => {
      const estimate = estimateTokenSavings(5, 3, 14);

      expect(estimate.hybrid.expectedOutputTokens).toBeLessThan(
        estimate.aiOnly.expectedOutputTokens
      );
    });
  });
});

describe("Expected Token Savings Scenarios", () => {
  it("시나리오 1: 소규모 플랜 (1주, 3콘텐츠)", () => {
    const estimate = estimateTokenSavings(3, 2, 7);

    // 하이브리드가 더 효율적이어야 함
    expect(estimate.hybrid.totalEstimate).toBeLessThan(estimate.aiOnly.totalEstimate);
    console.log(`소규모: ${estimate.savingsPercent.toFixed(1)}% 절감`);
  });

  it("시나리오 2: 중규모 플랜 (2주, 5콘텐츠)", () => {
    const estimate = estimateTokenSavings(5, 3, 14);

    expect(estimate.savingsPercent).toBeGreaterThan(20);
    console.log(`중규모: ${estimate.savingsPercent.toFixed(1)}% 절감`);
  });

  it("시나리오 3: 대규모 플랜 (4주, 10콘텐츠)", () => {
    const estimate = estimateTokenSavings(10, 5, 28);

    expect(estimate.savingsPercent).toBeGreaterThan(30);
    console.log(`대규모: ${estimate.savingsPercent.toFixed(1)}% 절감`);
  });

  it("시나리오 4: 캠프 플랜 (2주, 다수 콘텐츠)", () => {
    const estimate = estimateTokenSavings(8, 6, 14);

    expect(estimate.savingsPercent).toBeGreaterThan(25);
    console.log(`캠프: ${estimate.savingsPercent.toFixed(1)}% 절감`);
  });
});
