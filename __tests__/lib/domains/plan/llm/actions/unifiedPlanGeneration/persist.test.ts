/**
 * Stage 6: persist Tests
 *
 * Tests for database persistence of generated schedules.
 * Focus on sequence assignment logic validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockValidatedInput,
  createMockValidationResult,
  createMockContentResolution,
  createMockScheduledPlan,
} from "./__mocks__/testFactories";

// Import the actual function from persist.ts
import { assignSequencesToPlans } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/persist";

// ============================================================================
// Unit Tests for Sequence Assignment Logic
// ============================================================================

describe("assignSequencesToPlans", () => {
  /**
   * Tests for the exported assignSequencesToPlans utility function.
   *
   * The logic: For each date, assign sequential numbers starting from 1.
   * Plans on the same date should have consecutive sequences (1, 2, 3...),
   * and different dates reset to 1.
   */

  it("should assign sequential numbers per date", () => {
    const plans = [
      { plan_date: "2025-03-03", content_id: "content-1" },
      { plan_date: "2025-03-03", content_id: "content-2" },
      { plan_date: "2025-03-04", content_id: "content-3" },
      { plan_date: "2025-03-04", content_id: "content-4" },
      { plan_date: "2025-03-04", content_id: "content-5" },
    ];

    const result = assignSequencesToPlans(plans);

    // Plans on 2025-03-03 should have sequence 1, 2
    const march3Plans = result.filter((p) => p.plan_date === "2025-03-03");
    expect(march3Plans.map((p) => p.sequence)).toEqual([1, 2]);

    // Plans on 2025-03-04 should have sequence 1, 2, 3
    const march4Plans = result.filter((p) => p.plan_date === "2025-03-04");
    expect(march4Plans.map((p) => p.sequence)).toEqual([1, 2, 3]);
  });

  it("should maintain order when assigning sequences", () => {
    const plans = [
      { plan_date: "2025-03-03", content_id: "content-a" },
      { plan_date: "2025-03-03", content_id: "content-b" },
      { plan_date: "2025-03-03", content_id: "content-c" },
    ];

    const result = assignSequencesToPlans(plans);

    // Order should be preserved
    expect(result[0].content_id).toBe("content-a");
    expect(result[0].sequence).toBe(1);
    expect(result[1].content_id).toBe("content-b");
    expect(result[1].sequence).toBe(2);
    expect(result[2].content_id).toBe("content-c");
    expect(result[2].sequence).toBe(3);
  });

  it("should reset sequence for each new date", () => {
    const plans = [
      { plan_date: "2025-03-03", content_id: "content-1" },
      { plan_date: "2025-03-05", content_id: "content-2" }, // Skip 03-04
      { plan_date: "2025-03-05", content_id: "content-3" },
    ];

    const result = assignSequencesToPlans(plans);

    // March 3rd: sequence 1
    const march3Plans = result.filter((p) => p.plan_date === "2025-03-03");
    expect(march3Plans.map((p) => p.sequence)).toEqual([1]);

    // March 5th: sequence 1, 2 (reset from March 3rd)
    const march5Plans = result.filter((p) => p.plan_date === "2025-03-05");
    expect(march5Plans.map((p) => p.sequence)).toEqual([1, 2]);
  });

  it("should handle single plan per date", () => {
    const plans = [
      { plan_date: "2025-03-01", content_id: "content-1" },
      { plan_date: "2025-03-02", content_id: "content-2" },
      { plan_date: "2025-03-03", content_id: "content-3" },
    ];

    const result = assignSequencesToPlans(plans);

    // Each date should have sequence 1
    expect(result.every((p) => p.sequence === 1)).toBe(true);
  });

  it("should handle empty plans array", () => {
    const plans: Array<{ plan_date: string; content_id: string }> = [];

    const result = assignSequencesToPlans(plans);

    expect(result).toHaveLength(0);
  });

  it("should handle interleaved dates correctly", () => {
    // This tests that the algorithm works even if plans are not sorted by date
    const plans = [
      { plan_date: "2025-03-03", content_id: "content-1" },
      { plan_date: "2025-03-04", content_id: "content-2" },
      { plan_date: "2025-03-03", content_id: "content-3" }, // Back to 03-03
      { plan_date: "2025-03-04", content_id: "content-4" }, // Back to 03-04
    ];

    const result = assignSequencesToPlans(plans);

    // Note: The sequence continues from the last assignment for each date
    // 03-03: content-1 gets 1, content-3 gets 2
    // 03-04: content-2 gets 1, content-4 gets 2
    expect(result[0].sequence).toBe(1); // 03-03, first
    expect(result[1].sequence).toBe(1); // 03-04, first
    expect(result[2].sequence).toBe(2); // 03-03, second
    expect(result[3].sequence).toBe(2); // 03-04, second
  });
});

// ============================================================================
// Integration Tests with Mocked Supabase
// ============================================================================

// Use vi.hoisted to declare mutable state that can be captured in mocks
const { mockState, mockFrom } = vi.hoisted(() => {
  const state = {
    capturedPlanGroupInsert: null as Record<string, unknown> | null,
    capturedStudentPlanInserts: [] as Array<Record<string, unknown>>,
  };

  const from = vi.fn((tableName: string) => {
    const mockInsert = vi.fn((data: unknown) => {
      if (tableName === "plan_groups") {
        state.capturedPlanGroupInsert = data as Record<string, unknown>;
      } else if (tableName === "student_plan") {
        state.capturedStudentPlanInserts = data as Array<Record<string, unknown>>;
      }
      return {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "generated-id-" + tableName },
          error: null,
        }),
        error: null,
      };
    });

    return {
      insert: mockInsert,
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
  });

  return { mockState: state, mockFrom: from };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

// Mock planner auto-create
vi.mock("@/lib/domains/plan/actions/planners/autoCreate", () => ({
  ensurePlannerForPipeline: vi.fn().mockResolvedValue({
    success: true,
    plannerId: "test-planner-id",
    isNew: false,
    hasWarning: false,
  }),
}));

// Mock logging
vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
  logActionDebug: vi.fn(),
}));

// Import after mocks
import { persist } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/persist";

describe("persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.capturedPlanGroupInsert = null;
    mockState.capturedStudentPlanInserts = [];
  });

  describe("DryRun Mode", () => {
    it("should skip persistence in dryRun mode", async () => {
      const input = createMockValidatedInput({
        generationOptions: {
          dryRun: true,
          saveToDb: false,
          generateMarkdown: false,
        },
      });
      const validationResult = createMockValidationResult();
      const contentResolution = createMockContentResolution();

      const result = await persist(input, validationResult, contentResolution);

      expect(result.success).toBe(false);
      expect(result.error).toContain("DryRun");
    });
  });

  describe("Single Content Mode", () => {
    it("should set is_single_content=true for single content plan", async () => {
      const input = createMockValidatedInput({
        generationOptions: {
          dryRun: false,
          saveToDb: true,
          generateMarkdown: false,
        },
      });
      const contentResolution = createMockContentResolution({
        items: [
          {
            id: "single-content-id",
            title: "Single Content",
            contentType: "book",
            totalRange: 100,
            startRange: 1,
            endRange: 100,
            source: "ai_recommendation",
          },
        ],
      });
      const validationResult = createMockValidationResult();

      await persist(input, validationResult, contentResolution);

      // Plan group should have is_single_content=true
      expect(mockState.capturedPlanGroupInsert).toBeDefined();
      expect(mockState.capturedPlanGroupInsert?.is_single_content).toBe(true);
    });

    it("should set is_single_content=false for multi content plan", async () => {
      const input = createMockValidatedInput({
        generationOptions: {
          dryRun: false,
          saveToDb: true,
          generateMarkdown: false,
        },
      });
      const contentResolution = createMockContentResolution({
        items: [
          {
            id: "content-1",
            title: "Content 1",
            contentType: "book",
            totalRange: 100,
            startRange: 1,
            endRange: 100,
            source: "ai_recommendation",
          },
          {
            id: "content-2",
            title: "Content 2",
            contentType: "book",
            totalRange: 100,
            startRange: 1,
            endRange: 100,
            source: "ai_recommendation",
          },
        ],
      });
      const validationResult = createMockValidationResult();

      await persist(input, validationResult, contentResolution);

      expect(mockState.capturedPlanGroupInsert?.is_single_content).toBe(false);
    });
  });

  describe("Sequence Assignment in Persisted Plans", () => {
    it("should assign sequences to student plans", async () => {
      const input = createMockValidatedInput({
        generationOptions: {
          dryRun: false,
          saveToDb: true,
          generateMarkdown: false,
        },
      });
      const plans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          content_id: "content-1",
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          content_id: "content-2",
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-04",
          content_id: "content-3",
        }),
      ];
      const validationResult = createMockValidationResult({ plans });
      const contentResolution = createMockContentResolution();

      await persist(input, validationResult, contentResolution);

      // Check that student plans have sequence assigned
      expect(mockState.capturedStudentPlanInserts.length).toBe(3);

      // First two plans are on same date, should have sequence 1, 2
      const march3Plans = mockState.capturedStudentPlanInserts.filter(
        (p) => p.plan_date === "2025-03-03"
      );
      const march3Sequences = march3Plans.map((p) => p.sequence);
      expect(march3Sequences).toContain(1);
      expect(march3Sequences).toContain(2);

      // Third plan is on different date, should have sequence 1
      const march4Plans = mockState.capturedStudentPlanInserts.filter(
        (p) => p.plan_date === "2025-03-04"
      );
      expect(march4Plans[0]?.sequence).toBe(1);
    });
  });

  describe("Result Structure", () => {
    it("should return correct result structure on success", async () => {
      const input = createMockValidatedInput({
        generationOptions: {
          dryRun: false,
          saveToDb: true,
          generateMarkdown: false,
        },
        planName: "Test Plan",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
      });
      const validationResult = createMockValidationResult({
        plans: [createMockScheduledPlan(), createMockScheduledPlan()],
      });
      const contentResolution = createMockContentResolution();

      const result = await persist(input, validationResult, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.planGroup).toBeDefined();
        expect(result.data.planGroup.name).toBe("Test Plan");
        expect(result.data.planGroup.periodStart).toBe("2025-03-01");
        expect(result.data.planGroup.periodEnd).toBe("2025-03-31");
        expect(result.data.savedPlanCount).toBe(2);
      }
    });
  });
});
