/**
 * Stage 5: validateAndAdjust Tests
 *
 * Tests for validation and adjustment of generated schedules.
 */

import { describe, it, expect, vi } from "vitest";
import { validateAndAdjust } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/validateAndAdjust";
import {
  createMockValidatedInput,
  createMockScheduleResult,
  createMockScheduledPlan,
} from "./__mocks__/testFactories";

// Mock time overlap validator
const { mockValidateNoInternalOverlaps, mockAdjustOverlappingTimes } =
  vi.hoisted(() => ({
    mockValidateNoInternalOverlaps: vi.fn(),
    mockAdjustOverlappingTimes: vi.fn(),
  }));

vi.mock("@/lib/scheduler/utils/timeOverlapValidator", () => ({
  validateNoInternalOverlaps: mockValidateNoInternalOverlaps,
  adjustOverlappingTimes: mockAdjustOverlappingTimes,
}));

describe("validateAndAdjust", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: no overlaps
    mockValidateNoInternalOverlaps.mockReturnValue({
      hasOverlaps: false,
      overlaps: [],
    });
    mockAdjustOverlappingTimes.mockReturnValue({
      adjustedPlans: [],
      adjustedCount: 0,
      unadjustablePlans: [],
    });
  });

  describe("Success Cases", () => {
    it("should pass validation when no overlaps exist", () => {
      const input = createMockValidatedInput();
      const scheduleResult = createMockScheduleResult();

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(true);
        // No overlap-related warnings (business rule warnings may exist)
        const overlapWarnings = result.data.warnings.filter(
          (w) =>
            w.code === "TIME_OVERLAP_ADJUSTED" ||
            w.code === "UNADJUSTABLE_OVERLAPS"
        );
        expect(overlapWarnings).toHaveLength(0);
        expect(result.data.autoAdjustedCount).toBe(0);
      }
    });

    it("should return plans when validation passes", () => {
      const input = createMockValidatedInput();
      const mockPlans = [
        createMockScheduledPlan({ plan_date: "2025-03-03" }),
        createMockScheduledPlan({ plan_date: "2025-03-04" }),
      ];
      const scheduleResult = createMockScheduleResult({ plans: mockPlans });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plans).toHaveLength(2);
      }
    });
  });

  describe("Time Overlap Handling", () => {
    it("should auto-adjust overlapping times when possible", () => {
      const input = createMockValidatedInput();
      const originalPlans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          start_time: "09:00",
          end_time: "10:30",
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          start_time: "10:00",
          end_time: "11:30",
        }),
      ];
      const scheduleResult = createMockScheduleResult({ plans: originalPlans });

      // Mock overlap detection
      mockValidateNoInternalOverlaps.mockReturnValueOnce({
        hasOverlaps: true,
        overlaps: [
          {
            plan1Index: 0,
            plan2Index: 1,
            overlapMinutes: 30,
          },
        ],
      });

      // Mock adjustment success
      const adjustedPlans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          start_time: "09:00",
          end_time: "10:00",
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          start_time: "10:00",
          end_time: "11:30",
        }),
      ];
      mockAdjustOverlappingTimes.mockReturnValue({
        adjustedPlans,
        adjustedCount: 1,
        unadjustablePlans: [],
      });

      // Mock final validation passes
      mockValidateNoInternalOverlaps.mockReturnValueOnce({
        hasOverlaps: false,
        overlaps: [],
      });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(true);
        expect(result.data.autoAdjustedCount).toBe(1);
        expect(result.data.warnings).toContainEqual(
          expect.objectContaining({
            code: "TIME_OVERLAP_ADJUSTED",
            severity: "info",
          })
        );
      }
    });

    it("should mark as invalid when overlaps cannot be adjusted", () => {
      const input = createMockValidatedInput();
      const scheduleResult = createMockScheduleResult();

      // Mock overlap detection
      mockValidateNoInternalOverlaps.mockReturnValue({
        hasOverlaps: true,
        overlaps: [
          {
            plan1Index: 0,
            plan2Index: 1,
            overlapMinutes: 120,
          },
        ],
      });

      // Mock adjustment failure
      const unadjustablePlan = createMockScheduledPlan();
      mockAdjustOverlappingTimes.mockReturnValue({
        adjustedPlans: scheduleResult.plans,
        adjustedCount: 0,
        unadjustablePlans: [
          {
            plan: unadjustablePlan,
            reason: "시간이 부족합니다",
          },
        ],
      });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(false);
        expect(result.data.unadjustablePlans).toHaveLength(1);
        expect(result.data.warnings).toContainEqual(
          expect.objectContaining({
            code: "UNADJUSTABLE_OVERLAPS",
            severity: "warning",
          })
        );
      }
    });
  });

  describe("Schedule Failure Reasons", () => {
    it("should convert failure reasons to warnings", () => {
      const input = createMockValidatedInput();
      const scheduleResult = createMockScheduleResult({
        failureReasons: [
          {
            code: "insufficient_time",
            message: "시간이 부족합니다",
            context: { date: "2025-03-03" },
          },
        ],
      });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.warnings).toContainEqual(
          expect.objectContaining({
            code: "insufficient_time",
            severity: "warning",
          })
        );
      }
    });

    it("should include multiple failure reasons", () => {
      const input = createMockValidatedInput();
      const scheduleResult = createMockScheduleResult({
        failureReasons: [
          { code: "error1", message: "에러 1", context: {} },
          { code: "error2", message: "에러 2", context: {} },
        ],
      });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        const failureWarnings = result.data.warnings.filter(
          (w) => w.code === "error1" || w.code === "error2"
        );
        expect(failureWarnings).toHaveLength(2);
      }
    });
  });

  describe("Business Rules Validation", () => {
    it("should handle empty plans array", () => {
      const input = createMockValidatedInput();
      const scheduleResult = createMockScheduleResult({ plans: [] });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plans).toHaveLength(0);
      }
    });

    it("should validate plans within period", () => {
      const input = createMockValidatedInput({
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
      });
      const scheduleResult = createMockScheduleResult({
        plans: [
          createMockScheduledPlan({ plan_date: "2025-03-15" }),
          createMockScheduledPlan({ plan_date: "2025-03-20" }),
        ],
      });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isValid).toBe(true);
      }
    });
  });

  describe("Warning Aggregation", () => {
    it("should aggregate warnings from multiple sources", () => {
      const input = createMockValidatedInput();
      const scheduleResult = createMockScheduleResult({
        failureReasons: [
          { code: "schedule_warning", message: "스케줄 경고", context: {} },
        ],
      });

      // Mock overlap with auto-adjustment
      mockValidateNoInternalOverlaps.mockReturnValueOnce({
        hasOverlaps: true,
        overlaps: [{ plan1Index: 0, plan2Index: 1, overlapMinutes: 30 }],
      });
      mockAdjustOverlappingTimes.mockReturnValue({
        adjustedPlans: scheduleResult.plans,
        adjustedCount: 1,
        unadjustablePlans: [],
      });
      mockValidateNoInternalOverlaps.mockReturnValueOnce({
        hasOverlaps: false,
        overlaps: [],
      });

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should have: TIME_OVERLAP_ADJUSTED + schedule_warning
        expect(result.data.warnings.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("Validation Result Structure", () => {
    it("should include all required fields in result", () => {
      const input = createMockValidatedInput();
      const scheduleResult = createMockScheduleResult();

      const result = validateAndAdjust(input, scheduleResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("isValid");
        expect(result.data).toHaveProperty("plans");
        expect(result.data).toHaveProperty("warnings");
        expect(result.data).toHaveProperty("autoAdjustedCount");
        expect(result.data).toHaveProperty("unadjustablePlans");
      }
    });
  });
});
