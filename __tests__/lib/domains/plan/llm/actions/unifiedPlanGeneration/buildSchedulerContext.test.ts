/**
 * Stage 3: buildSchedulerContext Tests
 *
 * Tests for scheduler context building stage.
 */

import { describe, it, expect } from "vitest";
import { buildSchedulerContext } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/buildSchedulerContext";
import {
  createMockValidatedInput,
  createMockContentResolution,
  createMockResolvedContent,
} from "./__mocks__/testFactories";

describe("buildSchedulerContext", () => {
  describe("Success Cases", () => {
    it("should build context successfully with default settings", () => {
      const input = createMockValidatedInput();
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contents).toHaveLength(1);
        expect(result.data.periodStart).toBe("2025-03-01");
        expect(result.data.periodEnd).toBe("2025-03-31");
      }
    });

    it("should convert ResolvedContentItem to ContentInfo correctly", () => {
      const input = createMockValidatedInput();
      const content = createMockResolvedContent({
        id: "test-content",
        contentType: "book",
        startRange: 1,
        endRange: 100,
        subject: "미적분",
        subjectCategory: "수학",
      });
      const contentResolution = createMockContentResolution({
        items: [content],
      });

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        const contentInfo = result.data.contents[0];
        expect(contentInfo.content_id).toBe("test-content");
        expect(contentInfo.content_type).toBe("book");
        expect(contentInfo.start_range).toBe(1);
        expect(contentInfo.end_range).toBe(101); // exclusive
        expect(contentInfo.total_amount).toBe(100);
        expect(contentInfo.subject).toBe("미적분");
        expect(contentInfo.subject_category).toBe("수학");
      }
    });

    it("should create subject type map from content", () => {
      const input = createMockValidatedInput({
        timetableSettings: {
          studyDays: 6,
          reviewDays: 1,
          studentLevel: "medium",
          subjectType: "strategy",
          weeklyDays: 3,
          distributionStrategy: "even",
        },
      });
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        const subjectType = result.data.subjectTypeMap.get("bk_test_content");
        expect(subjectType).toBe("strategy");
      }
    });
  });

  describe("Block Generation", () => {
    it("should generate blocks for all 7 days of the week", () => {
      const input = createMockValidatedInput();
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        // With lunch time, we should have 2 blocks per day = 14 blocks total
        expect(result.data.blocks.length).toBe(14);

        // Check each day has blocks
        const dayBlockCounts = new Map<number, number>();
        for (const block of result.data.blocks) {
          const count = dayBlockCounts.get(block.day_of_week) ?? 0;
          dayBlockCounts.set(block.day_of_week, count + 1);
        }

        for (let day = 0; day <= 6; day++) {
          expect(dayBlockCounts.get(day)).toBe(2);
        }
      }
    });

    it("should split blocks around lunch time", () => {
      const input = createMockValidatedInput({
        timeSettings: {
          studyHours: { start: "09:00", end: "18:00" },
          lunchTime: { start: "12:00", end: "13:00" },
        },
      });
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        // Get blocks for Monday (day 1)
        const mondayBlocks = result.data.blocks.filter(
          (b) => b.day_of_week === 1
        );

        expect(mondayBlocks).toHaveLength(2);

        // Morning block: 09:00 - 12:00
        const morningBlock = mondayBlocks.find((b) => b.block_index === 0);
        expect(morningBlock?.start_time).toBe("09:00");
        expect(morningBlock?.end_time).toBe("12:00");
        expect(morningBlock?.duration_minutes).toBe(180);

        // Afternoon block: 13:00 - 18:00
        const afternoonBlock = mondayBlocks.find((b) => b.block_index === 1);
        expect(afternoonBlock?.start_time).toBe("13:00");
        expect(afternoonBlock?.end_time).toBe("18:00");
        expect(afternoonBlock?.duration_minutes).toBe(300);
      }
    });

    it("should create single block without lunch time", () => {
      const input = createMockValidatedInput({
        timeSettings: {
          studyHours: { start: "09:00", end: "18:00" },
        },
      });
      // Explicitly remove lunch time after creation (deepMerge doesn't handle undefined)
      delete (input.timeSettings as { lunchTime?: unknown }).lunchTime;
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        // 7 days * 1 block = 7 blocks
        expect(result.data.blocks).toHaveLength(7);

        const mondayBlock = result.data.blocks.find(
          (b) => b.day_of_week === 1
        );
        expect(mondayBlock?.start_time).toBe("09:00");
        expect(mondayBlock?.end_time).toBe("18:00");
        expect(mondayBlock?.duration_minutes).toBe(540);
      }
    });
  });

  describe("Exclusions Handling", () => {
    it("should convert exclusions correctly", () => {
      const input = createMockValidatedInput({
        exclusions: [
          { date: "2025-03-15", reason: "휴일" },
          { date: "2025-03-20", reason: "개인 사정" },
        ],
      });
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exclusions).toHaveLength(2);
        expect(result.data.exclusions[0].exclusion_date).toBe("2025-03-15");
        expect(result.data.exclusions[0].reason).toBe("휴일");
        expect(result.data.exclusions[1].exclusion_date).toBe("2025-03-20");
      }
    });

    it("should handle empty exclusions", () => {
      const input = createMockValidatedInput({
        exclusions: [],
      });
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exclusions).toHaveLength(0);
      }
    });
  });

  describe("Academy Schedules Handling", () => {
    it("should convert academy schedules correctly", () => {
      const input = createMockValidatedInput({
        academySchedules: [
          { dayOfWeek: 1, startTime: "14:00", endTime: "16:00", subject: "수학" },
          { dayOfWeek: 3, startTime: "17:00", endTime: "19:00", subject: "영어" },
        ],
      });
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.academySchedules).toHaveLength(2);
        expect(result.data.academySchedules[0].day_of_week).toBe(1);
        expect(result.data.academySchedules[0].start_time).toBe("14:00");
        expect(result.data.academySchedules[0].end_time).toBe("16:00");
        expect(result.data.academySchedules[0].subject).toBe("수학");
      }
    });
  });

  describe("Multiple Contents", () => {
    it("should handle multiple content items", () => {
      const input = createMockValidatedInput();
      const contentResolution = createMockContentResolution({
        items: [
          createMockResolvedContent({ id: "content-1", title: "교재 1" }),
          createMockResolvedContent({ id: "content-2", title: "교재 2" }),
        ],
      });

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contents).toHaveLength(2);
        expect(result.data.subjectTypeMap.size).toBe(2);
      }
    });
  });

  describe("Error Cases", () => {
    it("should fail when no contents are provided", () => {
      const input = createMockValidatedInput();
      const contentResolution = createMockContentResolution({
        items: [],
      });

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("콘텐츠");
      }
    });
  });

  describe("Block ID Generation", () => {
    it("should generate unique IDs for each block", () => {
      const input = createMockValidatedInput();
      const contentResolution = createMockContentResolution();

      const result = buildSchedulerContext(input, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        const ids = result.data.blocks.map((b) => b.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }
    });
  });
});
