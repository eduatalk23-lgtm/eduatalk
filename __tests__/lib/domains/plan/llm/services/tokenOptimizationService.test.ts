/**
 * Token Optimization Service Unit Tests
 * Phase 2.3: 토큰 최적화
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TokenOptimizationService,
  getTokenOptimizationService,
  optimizeContents,
  optimizeLearningHistory,
  type ContentInfoFull,
  type LearningHistoryFull,
} from "@/lib/domains/plan/llm/services/tokenOptimizationService";

// ============================================
// Mock estimateTokens
// ============================================

vi.mock("@/lib/domains/plan/llm/client", () => ({
  estimateTokens: vi.fn((text: string) => {
    // 간단한 토큰 추정: 문자 수 / 4
    return Math.ceil(text.length / 4);
  }),
}));

// ============================================
// Test Data
// ============================================

const createFullContent = (id: string): ContentInfoFull => ({
  id,
  title: `콘텐츠 ${id}`,
  subject: "수학",
  subjectCategory: "수학",
  contentType: "book",
  totalPages: 500,
  difficulty: "medium",
  priority: "high",
  // 불필요한 필드들
  description: "이 교재는 수학의 기초를 다루는 교재입니다. 매우 긴 설명이 포함되어 있습니다.",
  toc: "1장: 기초\n2장: 심화\n3장: 응용\n4장: 연습문제",
  notes: "학생들에게 인기 있는 교재입니다.",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  publisher: "좋은책출판사",
  author: "홍길동",
  coverImageUrl: "https://example.com/cover.jpg",
  isbn: "978-89-12345-67-8",
});

const createFullHistory = (): LearningHistoryFull => ({
  recentPlans: Array.from({ length: 50 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    contentId: `content-${i}`,
    completed: i % 2 === 0,
    duration: 30 + (i % 60),
    notes: `학습 노트 ${i}`,
    createdAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
  })),
  subjectPerformance: Array.from({ length: 15 }, (_, i) => ({
    subject: `과목${i}`,
    completionRate: 0.5 + (i % 5) * 0.1,
    avgDuration: 30 + i * 5,
    lastStudied: `2026-01-${String(i + 1).padStart(2, "0")}`,
    detailedStats: { weeklyAvg: 35, monthlyAvg: 40 },
  })),
  weeklyStats: { week1: 10, week2: 12 },
  monthlyStats: { jan: 50, feb: 60 },
  allTimePlans: Array.from({ length: 100 }, (_, i) => ({ id: i })),
});

// ============================================
// Tests
// ============================================

describe("TokenOptimizationService", () => {
  let service: TokenOptimizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenOptimizationService(4000);
  });

  describe("optimizeContentPayload", () => {
    it("should remove unnecessary fields from content", () => {
      const contents: ContentInfoFull[] = [createFullContent("1")];

      const result = service.optimizeContentPayload(contents);

      expect(result.data[0]).toHaveProperty("id");
      expect(result.data[0]).toHaveProperty("title");
      expect(result.data[0]).toHaveProperty("subject");
      expect(result.data[0]).not.toHaveProperty("description");
      expect(result.data[0]).not.toHaveProperty("toc");
      expect(result.data[0]).not.toHaveProperty("notes");
      expect(result.data[0]).not.toHaveProperty("createdAt");
      expect(result.data[0]).not.toHaveProperty("coverImageUrl");
    });

    it("should report token savings", () => {
      const contents: ContentInfoFull[] = [
        createFullContent("1"),
        createFullContent("2"),
      ];

      const result = service.optimizeContentPayload(contents);

      expect(result.originalTokens).toBeGreaterThan(result.optimizedTokens);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    it("should preserve essential fields", () => {
      const contents: ContentInfoFull[] = [createFullContent("1")];

      const result = service.optimizeContentPayload(contents);

      expect(result.data[0].id).toBe("1");
      expect(result.data[0].title).toBe("콘텐츠 1");
      expect(result.data[0].subject).toBe("수학");
      expect(result.data[0].contentType).toBe("book");
      expect(result.data[0].totalPages).toBe(500);
    });
  });

  describe("limitContents", () => {
    it("should limit content count", () => {
      const contents = Array.from({ length: 20 }, (_, i) =>
        createFullContent(String(i))
      );

      const result = service.limitContents(contents, 10);

      expect(result.data).toHaveLength(10);
    });

    it("should not modify if under limit", () => {
      const contents = Array.from({ length: 5 }, (_, i) =>
        createFullContent(String(i))
      );

      const result = service.limitContents(contents, 10);

      expect(result.data).toHaveLength(5);
      expect(result.savingsPercent).toBe(0);
    });

    it("should report savings when limiting", () => {
      const contents = Array.from({ length: 20 }, (_, i) =>
        createFullContent(String(i))
      );

      const result = service.limitContents(contents, 5);

      expect(result.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe("optimizeLearningHistory", () => {
    it("should limit recent plans to default max (20)", () => {
      const history = createFullHistory();

      const result = service.optimizeLearningHistory(history);

      expect(result.data.recentPlans?.length).toBe(20);
    });

    it("should limit subject performance to default max (10)", () => {
      const history = createFullHistory();

      const result = service.optimizeLearningHistory(history);

      expect(result.data.subjectPerformance?.length).toBe(10);
    });

    it("should remove detailed stats from subject performance", () => {
      const history = createFullHistory();

      const result = service.optimizeLearningHistory(history);

      expect(result.data.subjectPerformance?.[0]).not.toHaveProperty(
        "detailedStats"
      );
      expect(result.data.subjectPerformance?.[0]).not.toHaveProperty(
        "lastStudied"
      );
    });

    it("should remove notes and timestamps from plans", () => {
      const history = createFullHistory();

      const result = service.optimizeLearningHistory(history);

      expect(result.data.recentPlans?.[0]).not.toHaveProperty("notes");
      expect(result.data.recentPlans?.[0]).not.toHaveProperty("createdAt");
      expect(result.data.recentPlans?.[0]).not.toHaveProperty("updatedAt");
    });

    it("should not include weeklyStats and monthlyStats", () => {
      const history = createFullHistory();

      const result = service.optimizeLearningHistory(history);

      expect(result.data).not.toHaveProperty("weeklyStats");
      expect(result.data).not.toHaveProperty("monthlyStats");
      expect(result.data).not.toHaveProperty("allTimePlans");
    });

    it("should respect custom limits", () => {
      const history = createFullHistory();

      const result = service.optimizeLearningHistory(history, {
        maxRecentPlans: 5,
        maxSubjectPerformance: 3,
      });

      expect(result.data.recentPlans?.length).toBe(5);
      expect(result.data.subjectPerformance?.length).toBe(3);
    });

    it("should report significant savings", () => {
      const history = createFullHistory();

      const result = service.optimizeLearningHistory(history);

      expect(result.savingsPercent).toBeGreaterThan(50);
    });
  });

  describe("analyzeTokenUsage", () => {
    it("should calculate total token estimate", () => {
      const result = service.analyzeTokenUsage({
        systemPrompt: "You are a helpful assistant.",
        contents: [createFullContent("1")],
      });

      expect(result.estimatedTokens).toBeGreaterThan(0);
    });

    it("should provide breakdown by component", () => {
      const result = service.analyzeTokenUsage({
        systemPrompt: "System prompt here",
        contents: [createFullContent("1")],
        learningHistory: createFullHistory(),
        settings: { dailyMinutes: 180 },
      });

      expect(result.breakdown.systemPrompt).toBeGreaterThan(0);
      expect(result.breakdown.contents).toBeGreaterThan(0);
      expect(result.breakdown.learningHistory).toBeGreaterThan(0);
      expect(result.breakdown.settings).toBeGreaterThan(0);
    });

    it("should check against limit", () => {
      const smallService = new TokenOptimizationService(100);

      const result = smallService.analyzeTokenUsage({
        systemPrompt: "A very long system prompt that exceeds the limit".repeat(
          10
        ),
      });

      expect(result.isWithinLimit).toBe(false);
    });

    it("should suggest optimizations when over limit", () => {
      const smallService = new TokenOptimizationService(100);

      const result = smallService.analyzeTokenUsage({
        contents: Array.from({ length: 10 }, (_, i) =>
          createFullContent(String(i))
        ),
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("should prioritize suggestions", () => {
      const smallService = new TokenOptimizationService(100);

      const result = smallService.analyzeTokenUsage({
        contents: Array.from({ length: 10 }, (_, i) =>
          createFullContent(String(i))
        ),
        learningHistory: createFullHistory(),
      });

      // Suggestions should be sorted by priority
      for (let i = 1; i < result.suggestions.length; i++) {
        expect(result.suggestions[i].priority).toBeGreaterThanOrEqual(
          result.suggestions[i - 1].priority
        );
      }
    });
  });

  describe("truncateText", () => {
    it("should not modify short text", () => {
      const text = "Short text";

      const result = service.truncateText(text, 100);

      expect(result.data).toBe(text);
      expect(result.savingsPercent).toBe(0);
    });

    it("should truncate long text", () => {
      const text = "A".repeat(1000);

      const result = service.truncateText(text, 50);

      expect(result.data.length).toBeLessThan(text.length);
      expect(result.data.endsWith("...")).toBe(true);
    });

    it("should use custom suffix", () => {
      const text = "A".repeat(1000);

      const result = service.truncateText(text, 50, " [더보기]");

      expect(result.data.endsWith(" [더보기]")).toBe(true);
    });
  });

  describe("optimizeFullRequest", () => {
    it("should optimize both contents and learning history", () => {
      const request = {
        contents: [createFullContent("1"), createFullContent("2")],
        learningHistory: createFullHistory(),
        settings: { dailyMinutes: 180 },
      };

      const result = service.optimizeFullRequest(request);

      expect(result.optimizedTokens).toBeLessThan(result.originalTokens);
      expect(result.savingsPercent).toBeGreaterThan(0);
    });

    it("should preserve non-optimizable fields", () => {
      const request = {
        contents: [createFullContent("1")],
        settings: { dailyMinutes: 180 },
        customField: "should be preserved",
      };

      const result = service.optimizeFullRequest(request);

      expect(result.data.settings).toEqual({ dailyMinutes: 180 });
      expect(result.data.customField).toBe("should be preserved");
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTokenOptimizationService", () => {
    it("should return singleton instance", () => {
      const service1 = getTokenOptimizationService();
      const service2 = getTokenOptimizationService();

      expect(service1).toBe(service2);
    });

    it("should create new instance with custom limit", () => {
      const service = getTokenOptimizationService(8000);

      expect(service).toBeInstanceOf(TokenOptimizationService);
    });
  });

  describe("optimizeContents", () => {
    it("should return optimized content array", () => {
      const contents: ContentInfoFull[] = [createFullContent("1")];

      const result = optimizeContents(contents);

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty("description");
    });
  });

  describe("optimizeLearningHistory", () => {
    it("should return optimized learning history", () => {
      const history = createFullHistory();

      const result = optimizeLearningHistory(history);

      expect(result.recentPlans?.length).toBe(20);
      expect(result).not.toHaveProperty("allTimePlans");
    });
  });
});
