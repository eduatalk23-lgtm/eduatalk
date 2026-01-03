/**
 * Provider Selection Service Unit Tests
 * Phase 2.2: 동적 프로바이더 선택
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ProviderSelectionService,
  extractComplexityFromPlanRequest,
  type ComplexityInput,
} from "@/lib/domains/plan/llm/services/providerSelectionService";

// ============================================
// Mock Providers Config
// ============================================

vi.mock("@/lib/domains/plan/llm/providers/config", () => ({
  getAvailableProviders: vi.fn(() => ["anthropic", "openai", "gemini"]),
  hasApiKey: vi.fn((type: string) =>
    ["anthropic", "openai", "gemini"].includes(type)
  ),
  getAllProviderCosts: vi.fn((tier: string) => {
    const costs = {
      fast: [
        { provider: "gemini", estimatedCostPer1kIO: 0.000225 },
        { provider: "openai", estimatedCostPer1kIO: 0.00045 },
        { provider: "anthropic", estimatedCostPer1kIO: 0.000875 },
      ],
      standard: [
        { provider: "openai", estimatedCostPer1kIO: 0.0075 },
        { provider: "gemini", estimatedCostPer1kIO: 0.00375 },
        { provider: "anthropic", estimatedCostPer1kIO: 0.0105 },
      ],
      advanced: [
        { provider: "anthropic", estimatedCostPer1kIO: 0.0105 },
        { provider: "openai", estimatedCostPer1kIO: 0.025 },
        { provider: "gemini", estimatedCostPer1kIO: 0.00375 },
      ],
    };
    return costs[tier as keyof typeof costs] || [];
  }),
}));

// ============================================
// Tests
// ============================================

describe("ProviderSelectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeComplexity", () => {
    it("should return low score for simple requests", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.score).toBe(0);
      expect(result.recommendedTier).toBe("fast");
    });

    it("should add 30 points for >10 contents", () => {
      const input: ComplexityInput = {
        contentCount: 15,
        periodDays: 7,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.contentScore).toBe(30);
      expect(result.score).toBeGreaterThanOrEqual(30);
    });

    it("should add 15 points for 5-10 contents", () => {
      const input: ComplexityInput = {
        contentCount: 7,
        periodDays: 7,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.contentScore).toBe(15);
    });

    it("should add 20 points for >60 days period", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 90,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.periodScore).toBe(20);
    });

    it("should add 10 points for 30-60 days period", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 45,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.periodScore).toBe(10);
    });

    it("should add 10 points for weakness subject priority", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
        weaknessSubjectPriority: true,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.weaknessScore).toBe(10);
    });

    it("should add 10 points for subject balance", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
        subjectBalance: true,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.balanceScore).toBe(10);
    });

    it("should add 15 points for custom time slots", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
        hasCustomTimeSlots: true,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.timeSlotsScore).toBe(15);
    });

    it("should add 10 points for academy schedule check", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
        academyScheduleCheck: true,
        academyScheduleCount: 3,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.academyScore).toBe(10);
    });

    it("should not add academy points if no schedules exist", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
        academyScheduleCheck: true,
        academyScheduleCount: 0,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.academyScore).toBe(0);
    });

    it("should add context points (max 15)", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
        additionalContext: {
          hasLearningHistory: true,
          hasExamSchedule: true,
          hasDetailedSettings: true,
        },
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.breakdown.contextScore).toBe(15);
    });

    it("should recommend 'advanced' tier for score >= 70", () => {
      const input: ComplexityInput = {
        contentCount: 15, // +30
        periodDays: 90, // +20
        weaknessSubjectPriority: true, // +10
        subjectBalance: true, // +10
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.recommendedTier).toBe("advanced");
    });

    it("should recommend 'standard' tier for score 40-69", () => {
      const input: ComplexityInput = {
        contentCount: 15, // +30
        periodDays: 45, // +10
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(70);
      expect(result.recommendedTier).toBe("standard");
    });

    it("should recommend 'fast' tier for score < 40", () => {
      const input: ComplexityInput = {
        contentCount: 7, // +15
        periodDays: 14, // +0
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.score).toBeLessThan(40);
      expect(result.recommendedTier).toBe("fast");
    });

    it("should cap score at 100", () => {
      const input: ComplexityInput = {
        contentCount: 20, // +30
        periodDays: 180, // +20
        weaknessSubjectPriority: true, // +10
        subjectBalance: true, // +10
        hasCustomTimeSlots: true, // +15
        academyScheduleCheck: true, // +10
        academyScheduleCount: 5,
        additionalContext: {
          hasLearningHistory: true, // +5
          hasExamSchedule: true, // +5
          hasDetailedSettings: true, // +5 (capped at 15)
        },
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.score).toBe(100);
    });

    it("should include reasoning for each score component", () => {
      const input: ComplexityInput = {
        contentCount: 15,
        periodDays: 45,
        weaknessSubjectPriority: true,
      };

      const result = ProviderSelectionService.analyzeComplexity(input);

      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning.some((r) => r.includes("콘텐츠"))).toBe(true);
      expect(result.reasoning.some((r) => r.includes("기간"))).toBe(true);
      expect(result.reasoning.some((r) => r.includes("약점"))).toBe(true);
    });
  });

  describe("selectProvider", () => {
    it("should select gemini for fast tier (most cost-effective)", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
      };

      const result = ProviderSelectionService.selectProvider(input);

      expect(result.tier).toBe("fast");
      expect(result.provider).toBe("gemini");
    });

    it("should select openai for standard tier", () => {
      const input: ComplexityInput = {
        contentCount: 15, // +30
        periodDays: 45, // +10
      };

      const result = ProviderSelectionService.selectProvider(input);

      expect(result.tier).toBe("standard");
      expect(result.provider).toBe("openai");
    });

    it("should select anthropic for advanced tier", () => {
      const input: ComplexityInput = {
        contentCount: 15, // +30
        periodDays: 90, // +20
        weaknessSubjectPriority: true, // +10
        subjectBalance: true, // +10
      };

      const result = ProviderSelectionService.selectProvider(input);

      expect(result.tier).toBe("advanced");
      expect(result.provider).toBe("anthropic");
    });

    it("should include fallback provider", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
      };

      const result = ProviderSelectionService.selectProvider(input);

      expect(result.fallbackProvider).toBeDefined();
      expect(result.fallbackProvider).not.toBe(result.provider);
    });

    it("should include estimated cost", () => {
      const input: ComplexityInput = {
        contentCount: 2,
        periodDays: 7,
      };

      const result = ProviderSelectionService.selectProvider(input);

      expect(result.estimatedCostPer1kIO).toBeGreaterThan(0);
    });

    it("should include selection reason", () => {
      const input: ComplexityInput = {
        contentCount: 15,
        periodDays: 90,
      };

      const result = ProviderSelectionService.selectProvider(input);

      expect(result.selectionReason).toBeDefined();
      expect(result.selectionReason.length).toBeGreaterThan(0);
    });
  });

  describe("selectProviderWithTier", () => {
    it("should respect forced tier", () => {
      const result = ProviderSelectionService.selectProviderWithTier("advanced");

      expect(result.tier).toBe("advanced");
    });

    it("should use preferred provider if available", () => {
      const result = ProviderSelectionService.selectProviderWithTier(
        "standard",
        "gemini"
      );

      expect(result.provider).toBe("gemini");
    });

    it("should fallback to available provider if preferred not available", async () => {
      // Mock only anthropic available
      const { getAvailableProviders } = await import(
        "@/lib/domains/plan/llm/providers/config"
      );
      vi.mocked(getAvailableProviders).mockReturnValueOnce(["anthropic"]);

      const result = ProviderSelectionService.selectProviderWithTier(
        "fast",
        "gemini"
      );

      expect(result.provider).toBe("anthropic");
    });
  });

  describe("compareCosts", () => {
    it("should return costs sorted by price", () => {
      const result = ProviderSelectionService.compareCosts("fast");

      expect(result.recommended).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThanOrEqual(0);
    });

    it("should identify the cheapest provider as recommended", () => {
      const result = ProviderSelectionService.compareCosts("fast");

      expect(result.recommended.provider).toBe("gemini");
    });
  });
});

describe("extractComplexityFromPlanRequest", () => {
  it("should extract content count", () => {
    const request = {
      contents: [{ id: "1" }, { id: "2" }, { id: "3" }],
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.contentCount).toBe(3);
  });

  it("should calculate period days from dates", () => {
    const request = {
      settings: {
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      },
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.periodDays).toBe(30);
  });

  it("should use default period if dates not provided", () => {
    const request = {};

    const result = extractComplexityFromPlanRequest(request);

    expect(result.periodDays).toBe(14);
  });

  it("should extract weakness subject priority", () => {
    const request = {
      settings: {
        weaknessSubjectPriority: true,
      },
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.weaknessSubjectPriority).toBe(true);
  });

  it("should extract subject balance", () => {
    const request = {
      settings: {
        subjectBalance: true,
      },
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.subjectBalance).toBe(true);
  });

  it("should detect custom time slots", () => {
    const request = {
      timeSlots: [{ id: "1" }, { id: "2" }],
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.hasCustomTimeSlots).toBe(true);
  });

  it("should count academy schedules", () => {
    const request = {
      academySchedules: [{ id: "1" }, { id: "2" }, { id: "3" }],
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.academyScheduleCheck).toBe(true);
    expect(result.academyScheduleCount).toBe(3);
  });

  it("should detect learning history", () => {
    const request = {
      learningHistory: { recentPlans: [] },
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.additionalContext?.hasLearningHistory).toBe(true);
  });

  it("should detect exam schedule", () => {
    const request = {
      examSchedule: { date: "2026-03-15" },
    };

    const result = extractComplexityFromPlanRequest(request);

    expect(result.additionalContext?.hasExamSchedule).toBe(true);
  });
});
