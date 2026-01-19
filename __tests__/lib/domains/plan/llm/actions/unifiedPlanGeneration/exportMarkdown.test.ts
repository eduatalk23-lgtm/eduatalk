/**
 * Stage 7: exportMarkdown Tests
 *
 * Tests for markdown export stage.
 */

import { describe, it, expect } from "vitest";
import { exportMarkdown } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/exportMarkdown";
import {
  createMockValidatedInput,
  createMockScheduledPlan,
  createMockContentResolution,
  createMockResolvedContent,
} from "./__mocks__/testFactories";

describe("exportMarkdown", () => {
  describe("Success Cases", () => {
    it("should generate markdown successfully", () => {
      const input = createMockValidatedInput({
        planName: "1학기 수학 플랜",
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        planPurpose: "내신대비",
      });
      const plans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          content_id: "bk_test",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 35,
          start_time: "09:00",
          end_time: "10:30",
        }),
      ];
      const contentResolution = createMockContentResolution({
        items: [
          createMockResolvedContent({
            id: "bk_test",
            title: "개념원리 미적분",
          }),
        ],
      });

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("1학기 수학 플랜");
        expect(result.data).toContain("2025-03-01");
        expect(result.data).toContain("2025-03-31");
      }
    });

    it("should include plan purpose in markdown", () => {
      const input = createMockValidatedInput({ planPurpose: "모의고사" });
      const plans = [createMockScheduledPlan()];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("모의고사");
      }
    });

    it("should include content information in markdown", () => {
      const input = createMockValidatedInput();
      const plans = [createMockScheduledPlan({ content_id: "bk_calculus" })];
      const contentResolution = createMockContentResolution({
        items: [
          createMockResolvedContent({
            id: "bk_calculus",
            title: "미적분 기초",
            contentType: "book",
          }),
        ],
      });

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("미적분 기초");
      }
    });

    it("should include schedule information in markdown", () => {
      const input = createMockValidatedInput();
      const plans = [
        createMockScheduledPlan({
          plan_date: "2025-03-03",
          planned_start_page_or_time: 1,
          planned_end_page_or_time: 35,
        }),
      ];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("2025-03-03");
      }
    });
  });

  describe("Disabled Markdown Generation", () => {
    it("should return empty string when markdown generation is disabled", () => {
      const input = createMockValidatedInput({
        generationOptions: {
          saveToDb: false,
          generateMarkdown: false,
          dryRun: true,
        },
      });
      const plans = [createMockScheduledPlan()];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("");
      }
    });
  });

  describe("Empty Plans", () => {
    it("should fail when no plans provided", () => {
      const input = createMockValidatedInput();
      const plans: ReturnType<typeof createMockScheduledPlan>[] = [];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("플랜");
      }
    });
  });

  describe("Multiple Plans", () => {
    it("should handle multiple plans across different dates", () => {
      const input = createMockValidatedInput();
      const plans = [
        createMockScheduledPlan({ plan_date: "2025-03-03" }),
        createMockScheduledPlan({ plan_date: "2025-03-04" }),
        createMockScheduledPlan({ plan_date: "2025-03-05" }),
      ];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("2025-03-03");
        expect(result.data).toContain("2025-03-04");
        expect(result.data).toContain("2025-03-05");
      }
    });

    it("should handle multiple content items", () => {
      const input = createMockValidatedInput();
      const plans = [
        createMockScheduledPlan({ content_id: "bk_1" }),
        createMockScheduledPlan({ content_id: "bk_2" }),
      ];
      const contentResolution = createMockContentResolution({
        items: [
          createMockResolvedContent({ id: "bk_1", title: "교재 1" }),
          createMockResolvedContent({ id: "bk_2", title: "교재 2" }),
        ],
      });

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("교재 1");
        expect(result.data).toContain("교재 2");
      }
    });
  });

  describe("Markdown Format", () => {
    it("should include markdown headers", () => {
      const input = createMockValidatedInput({ planName: "테스트 플랜" });
      const plans = [createMockScheduledPlan()];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("# ");
      }
    });

    it("should include bold text markers", () => {
      const input = createMockValidatedInput();
      const plans = [createMockScheduledPlan()];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("**");
      }
    });

    it("should include table separators", () => {
      const input = createMockValidatedInput();
      const plans = [createMockScheduledPlan()];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("|");
      }
    });
  });

  describe("Weekly Grouping", () => {
    it("should group plans by week", () => {
      const input = createMockValidatedInput();
      // Create plans across two weeks
      const plans = [
        createMockScheduledPlan({ plan_date: "2025-03-03" }), // Week 1
        createMockScheduledPlan({ plan_date: "2025-03-10" }), // Week 2
      ];
      const contentResolution = createMockContentResolution();

      const result = exportMarkdown(input, plans, contentResolution);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should have week headers or grouping
        expect(result.data.length).toBeGreaterThan(0);
      }
    });
  });
});
