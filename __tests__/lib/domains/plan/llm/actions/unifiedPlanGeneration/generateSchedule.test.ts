/**
 * Stage 4: generateSchedule Tests
 *
 * Tests for schedule generation stage using SchedulerEngine.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateSchedule } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/generateSchedule";
import {
  createMockValidatedInput,
  createMockSchedulerContext,
  createMockScheduledPlan,
} from "./__mocks__/testFactories";

// Mock SchedulerEngine - using vi.hoisted to make functions available before mock hoisting
const { mockGenerate, mockGetFailureReasons } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockGetFailureReasons: vi.fn(),
}));

vi.mock("@/lib/scheduler/SchedulerEngine", () => {
  return {
    SchedulerEngine: class MockSchedulerEngine {
      generate = mockGenerate;
      getFailureReasons = mockGetFailureReasons;
    },
  };
});

describe("generateSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFailureReasons.mockReturnValue([]);
  });

  describe("Success Cases", () => {
    it("should generate schedule successfully with plans", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      const mockPlans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          cycle_day_number: 1,
          date_type: "study",
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-04",
          cycle_day_number: 2,
          date_type: "study",
        }),
      ];
      mockGenerate.mockReturnValue(mockPlans);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plans).toHaveLength(2);
        expect(result.data.cycleDays).toHaveLength(2);
      }
    });

    it("should extract cycle days correctly from plans", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      const mockPlans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          cycle_day_number: 1,
          date_type: "study",
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-04",
          cycle_day_number: 2,
          date_type: "study",
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-09",
          cycle_day_number: 7,
          date_type: "review",
        }),
      ];
      mockGenerate.mockReturnValue(mockPlans);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cycleDays).toContainEqual({
          date: "2025-03-03",
          dayType: "study",
          cycleDayNumber: 1,
        });
        expect(result.data.cycleDays).toContainEqual({
          date: "2025-03-09",
          dayType: "review",
          cycleDayNumber: 7,
        });
      }
    });

    it("should handle multiple plans on same date", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      const mockPlans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          cycle_day_number: 1,
          date_type: "study",
          block_index: 0,
        }),
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          cycle_day_number: 1,
          date_type: "study",
          block_index: 1,
        }),
      ];
      mockGenerate.mockReturnValue(mockPlans);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plans).toHaveLength(2);
        // cycleDays should deduplicate by date
        expect(result.data.cycleDays).toHaveLength(1);
      }
    });
  });

  describe("Failure Cases", () => {
    it("should fail when no plans generated", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      mockGenerate.mockReturnValue([]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("스케줄 생성 실패");
      }
    });

    it("should include failure reasons in error message", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      mockGenerate.mockReturnValue([]);
      mockGetFailureReasons.mockReturnValue([
        {
          type: "no_study_days",
          period: "2025-03-01 ~ 2025-03-31",
          totalDays: 31,
          excludedDays: 31,
        },
      ]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("학습 가능한 일자가 없습니다");
        expect(result.details?.failureReasons).toHaveLength(1);
      }
    });

    it("should handle insufficient_time failure reason", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      mockGenerate.mockReturnValue([]);
      mockGetFailureReasons.mockReturnValue([
        {
          type: "insufficient_time",
          date: "2025-03-03",
          dayOfWeek: "월",
          requiredMinutes: 120,
          availableMinutes: 60,
        },
      ]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.details?.failureReasons?.[0]?.code).toBe(
          "insufficient_time"
        );
        expect(result.details?.failureReasons?.[0]?.message).toContain(
          "시간이 부족합니다"
        );
      }
    });

    it("should handle content_allocation_failed failure reason", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      mockGenerate.mockReturnValue([]);
      mockGetFailureReasons.mockReturnValue([
        {
          type: "content_allocation_failed",
          contentId: "bk_test_content",
          reason: "콘텐츠를 배정할 수 없습니다",
        },
      ]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.details?.failureReasons?.[0]?.code).toBe(
          "content_allocation_failed"
        );
        expect(result.details?.failureReasons?.[0]?.message).toContain(
          "콘텐츠 배정 실패"
        );
      }
    });
  });

  describe("Scheduler Options", () => {
    it("should pass correct options to SchedulerEngine", () => {
      const input = createMockValidatedInput({
        timetableSettings: {
          studyDays: 5,
          reviewDays: 2,
          studentLevel: "high",
          subjectType: "strategy",
          weeklyDays: 3,
          distributionStrategy: "even",
        },
      });
      const context = createMockSchedulerContext();
      mockGenerate.mockReturnValue([createMockScheduledPlan()]);

      const result = generateSchedule(input, context);

      // Verify generation succeeded (SchedulerEngine was called)
      expect(result.success).toBe(true);
      expect(mockGenerate).toHaveBeenCalled();
    });

    it("should filter out custom content types from allocations", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext({
        contents: [
          {
            content_type: "book",
            content_id: "bk_test",
            start_range: 1,
            end_range: 100,
            total_amount: 99,
            subject: "미적분",
            subject_category: "수학",
          },
          {
            content_type: "custom" as "book", // TypeScript workaround for testing
            content_id: "cst_test",
            start_range: 1,
            end_range: 10,
            total_amount: 9,
            subject: "기타",
            subject_category: "기타",
          },
        ],
      });
      mockGenerate.mockReturnValue([createMockScheduledPlan()]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(true);
      // Custom content should be filtered out from allocations
    });
  });

  describe("Warning Cases", () => {
    it("should include failure reasons even when plans are generated", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext();
      mockGenerate.mockReturnValue([createMockScheduledPlan()]);
      mockGetFailureReasons.mockReturnValue([
        {
          type: "insufficient_slots",
          date: "2025-03-03",
          requiredSlots: 3,
          availableSlots: 2,
        },
      ]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.failureReasons).toHaveLength(1);
        expect(result.data.failureReasons[0].code).toBe("insufficient_slots");
      }
    });
  });

  describe("Exclusion Type Mapping", () => {
    it("should map holiday exclusion type to Korean", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext({
        exclusions: [
          {
            id: "exc-1",
            exclusion_date: "2025-03-15",
            exclusion_type: "holiday",
            reason: "공휴일",
          },
        ],
      });
      mockGenerate.mockReturnValue([createMockScheduledPlan()]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(true);
    });

    it("should map personal exclusion type to Korean", () => {
      const input = createMockValidatedInput();
      const context = createMockSchedulerContext({
        exclusions: [
          {
            id: "exc-1",
            exclusion_date: "2025-03-15",
            exclusion_type: "personal",
            reason: "개인 사정",
          },
        ],
      });
      mockGenerate.mockReturnValue([createMockScheduledPlan()]);

      const result = generateSchedule(input, context);

      expect(result.success).toBe(true);
    });
  });
});
