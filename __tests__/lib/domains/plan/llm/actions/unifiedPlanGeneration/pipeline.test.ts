/**
 * Pipeline Integration Tests
 *
 * Tests for the unified plan generation pipeline orchestration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runUnifiedPlanGenerationPipeline,
  previewUnifiedPlanGeneration,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/pipeline";
import {
  createMockInput,
  createMockScheduledPlan,
  createMockResolvedContent,
} from "./__mocks__/testFactories";

// Hoisted mocks
const {
  mockResolveContent,
  mockSchedulerGenerate,
  mockSchedulerGetFailureReasons,
  mockValidateNoInternalOverlaps,
  mockAdjustOverlappingTimes,
  mockSupabaseFrom,
} = vi.hoisted(() => ({
  mockResolveContent: vi.fn(),
  mockSchedulerGenerate: vi.fn(),
  mockSchedulerGetFailureReasons: vi.fn(),
  mockValidateNoInternalOverlaps: vi.fn(),
  mockAdjustOverlappingTimes: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

// Mock resolveContent stage (includes cold start pipeline)
vi.mock(
  "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/resolveContent",
  () => ({
    resolveContent: mockResolveContent,
  })
);

// Mock SchedulerEngine
vi.mock("@/lib/scheduler/SchedulerEngine", () => ({
  SchedulerEngine: class MockSchedulerEngine {
    generate = mockSchedulerGenerate;
    getFailureReasons = mockSchedulerGetFailureReasons;
  },
}));

// Mock time overlap validator
vi.mock("@/lib/scheduler/utils/timeOverlapValidator", () => ({
  validateNoInternalOverlaps: mockValidateNoInternalOverlaps,
  adjustOverlappingTimes: mockAdjustOverlappingTimes,
}));

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: mockSupabaseFrom,
  }),
}));

describe("Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock responses
    mockResolveContent.mockResolvedValue({
      success: true,
      data: {
        items: [createMockResolvedContent()],
        strategy: "ai_recommendation",
        newlySaved: 0,
      },
    });

    mockSchedulerGenerate.mockReturnValue([
      createMockScheduledPlan({
        plan_date: "2025-03-03",
        cycle_day_number: 1,
        date_type: "study",
      }),
    ]);
    mockSchedulerGetFailureReasons.mockReturnValue([]);

    mockValidateNoInternalOverlaps.mockReturnValue({
      hasOverlaps: false,
      overlaps: [],
    });
    mockAdjustOverlappingTimes.mockReturnValue({
      adjustedPlans: [],
      adjustedCount: 0,
      unadjustablePlans: [],
    });

    // Mock Supabase chain
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "mock-plan-group-id" },
            error: null,
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  describe("runUnifiedPlanGenerationPipeline", () => {
    it("should complete successfully with valid input in dry run mode", async () => {
      const input = createMockInput({
        generationOptions: {
          saveToDb: false,
          generateMarkdown: true,
          dryRun: true,
        },
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.plans).toBeDefined();
        expect(result.aiRecommendations).toBeDefined();
      }
    });

    it("should call content resolution for content selection", async () => {
      const input = createMockInput({
        contentSelection: {
          subjectCategory: "수학",
          subject: "미적분",
          difficulty: "개념",
          contentType: "book",
        },
        generationOptions: {
          dryRun: true,
        },
      });

      await runUnifiedPlanGenerationPipeline(input);

      expect(mockResolveContent).toHaveBeenCalled();
    });

    it("should fail at validation stage with invalid input", async () => {
      const input = createMockInput({
        periodStart: "2025-03-31",
        periodEnd: "2025-03-01", // Invalid: end before start
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("validation");
      }
    });

    it("should fail at content resolution when resolution fails", async () => {
      mockResolveContent.mockResolvedValue({
        success: false,
        error: "API rate limit exceeded",
      });

      const input = createMockInput({
        generationOptions: { dryRun: true },
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("content_resolution");
      }
    });

    it("should fail at schedule generation when no plans generated", async () => {
      mockSchedulerGenerate.mockReturnValue([]);
      mockSchedulerGetFailureReasons.mockReturnValue([
        {
          type: "no_study_days",
          period: "2025-03-01 ~ 2025-03-31",
          totalDays: 31,
          excludedDays: 31,
        },
      ]);

      const input = createMockInput({
        generationOptions: { dryRun: true },
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.failedAt).toBe("schedule_generation");
      }
    });

    it("should generate markdown when enabled", async () => {
      const input = createMockInput({
        generationOptions: {
          generateMarkdown: true,
          dryRun: true,
        },
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.markdown).toBeDefined();
        expect(result.markdown?.length).toBeGreaterThan(0);
      }
    });

    it("should not generate markdown when disabled", async () => {
      const input = createMockInput({
        generationOptions: {
          generateMarkdown: false,
          dryRun: true,
        },
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(true);
      if (result.success) {
        // When markdown is disabled, it may be undefined or empty string
        expect(result.markdown === "" || result.markdown === undefined).toBe(
          true
        );
      }
    });

    it("should include validation warnings in response", async () => {
      // Mock a successful run with business rule warnings
      mockSchedulerGenerate.mockReturnValue([
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          cycle_day_number: 1,
          date_type: "study",
        }),
      ]);

      const input = createMockInput({
        generationOptions: { dryRun: true },
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validation).toBeDefined();
      }
    });
  });

  describe("previewUnifiedPlanGeneration", () => {
    it("should always run in dry run mode", async () => {
      const input = createMockInput({
        generationOptions: {
          saveToDb: true, // This should be ignored
          dryRun: false, // This should be overridden
        },
      });

      const result = await previewUnifiedPlanGeneration(input);

      expect(result.success).toBe(true);
      // Supabase should not be called for saving in preview
      expect(mockSupabaseFrom).not.toHaveBeenCalledWith("plan_groups");
    });

    it("should return plans without saving to database", async () => {
      const input = createMockInput({
        generationOptions: {
          saveToDb: true,
        },
      });

      const result = await previewUnifiedPlanGeneration(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.plans).toBeDefined();
        expect(result.planGroup).toBeUndefined(); // Not saved
      }
    });
  });

  describe("Pipeline Flow", () => {
    it("should execute stages in correct order", async () => {
      const callOrder: string[] = [];

      mockResolveContent.mockImplementation(async () => {
        callOrder.push("content_resolution");
        return {
          success: true,
          data: {
            items: [createMockResolvedContent()],
            strategy: "ai_recommendation",
            newlySaved: 0,
          },
        };
      });

      mockSchedulerGenerate.mockImplementation(() => {
        callOrder.push("schedule_generation");
        return [createMockScheduledPlan()];
      });

      mockValidateNoInternalOverlaps.mockImplementation(() => {
        callOrder.push("validation");
        return { hasOverlaps: false, overlaps: [] };
      });

      const input = createMockInput({
        generationOptions: { dryRun: true },
      });

      await runUnifiedPlanGenerationPipeline(input);

      expect(callOrder).toContain("content_resolution");
      expect(callOrder).toContain("schedule_generation");
      expect(callOrder).toContain("validation");
      expect(callOrder.indexOf("content_resolution")).toBeLessThan(
        callOrder.indexOf("schedule_generation")
      );
      expect(callOrder.indexOf("schedule_generation")).toBeLessThan(
        callOrder.indexOf("validation")
      );
    });

    it("should stop pipeline on stage failure", async () => {
      mockResolveContent.mockResolvedValue({
        success: false,
        error: "Failed",
      });

      const input = createMockInput({
        generationOptions: { dryRun: true },
      });

      const result = await runUnifiedPlanGenerationPipeline(input);

      expect(result.success).toBe(false);
      // SchedulerEngine should not be called after content resolution fails
      expect(mockSchedulerGenerate).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      mockResolveContent.mockRejectedValue(new Error("Unexpected error"));

      const input = createMockInput({
        generationOptions: { dryRun: true },
      });

      // Pipeline should either catch the error and return a failure, or throw
      try {
        const result = await runUnifiedPlanGenerationPipeline(input);
        expect(result.success).toBe(false);
      } catch (error) {
        // If the pipeline throws, that's also acceptable error handling
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
