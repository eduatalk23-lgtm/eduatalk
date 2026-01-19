/**
 * Stage 1: validateInput Tests
 *
 * Tests for input validation stage of the unified plan generation pipeline.
 */

import { describe, it, expect } from "vitest";
import { validateInput } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/stages/validateInput";
import {
  createMockInput,
  TestScenarios,
} from "./__mocks__/testFactories";

describe("validateInput", () => {
  describe("Valid Inputs", () => {
    it("should validate normal input successfully", () => {
      const input = TestScenarios.normalCase();
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.studentId).toBe(input.studentId);
        expect(result.data.planName).toBe(input.planName);
        expect(result.data.totalDays).toBe(31);
        expect(result.data.availableDays).toBe(31);
      }
    });

    it("should validate strategy subject with weeklyDays", () => {
      const input = TestScenarios.strategySubject();
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timetableSettings.subjectType).toBe("strategy");
        expect(result.data.timetableSettings.weeklyDays).toBe(3);
      }
    });

    it("should validate minimum period (7 days)", () => {
      const input = TestScenarios.shortPeriod();
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalDays).toBe(7);
      }
    });

    it("should calculate available days excluding exclusions", () => {
      const input = TestScenarios.manyExclusions();
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalDays).toBe(31);
        expect(result.data.availableDays).toBe(26); // 31 - 5 exclusions
      }
    });

    it("should apply default values for optional fields", () => {
      // Create a minimal input without generationOptions
      const input = {
        studentId: "11111111-1111-1111-1111-111111111111",
        tenantId: "22222222-2222-2222-2222-222222222222",
        planName: "테스트 플랜",
        planPurpose: "내신대비" as const,
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        timeSettings: {
          studyHours: { start: "09:00", end: "22:00" },
        },
        contentSelection: {
          subjectCategory: "수학",
        },
        timetableSettings: {
          studyDays: 6,
          reviewDays: 1,
          studentLevel: "medium" as const,
          subjectType: "weakness" as const,
        },
        // generationOptions intentionally omitted
      };
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.generationOptions.saveToDb).toBe(false);
        expect(result.data.generationOptions.generateMarkdown).toBe(true);
        expect(result.data.generationOptions.dryRun).toBe(false);
      }
    });

    it("should apply default distribution strategy", () => {
      const input = createMockInput({
        timetableSettings: {
          studyDays: 6,
          reviewDays: 1,
          studentLevel: "medium",
          subjectType: "weakness",
          // distributionStrategy not specified
        },
      });
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timetableSettings.distributionStrategy).toBe("even");
      }
    });
  });

  describe("Invalid Inputs - Period Validation", () => {
    it("should reject period shorter than 7 days", () => {
      const input = TestScenarios.periodTooShort();
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("최소 7일");
      }
    });

    it("should reject period longer than 180 days", () => {
      const input = createMockInput({
        periodStart: "2025-01-01",
        periodEnd: "2025-12-31", // 365 days
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("180일");
      }
    });

    it("should reject when end date is before start date", () => {
      const input = createMockInput({
        periodStart: "2025-03-31",
        periodEnd: "2025-03-01",
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("이전이거나");
      }
    });

    it("should reject when available days less than cycle days", () => {
      // 7일 기간에 5일을 제외하면 2일만 남음 (사이클 7일보다 적음)
      const input = createMockInput({
        periodStart: "2025-03-01",
        periodEnd: "2025-03-07", // 7 days
        exclusions: [
          { date: "2025-03-02" },
          { date: "2025-03-03" },
          { date: "2025-03-04" },
          { date: "2025-03-05" },
          { date: "2025-03-06" },
        ],
        timetableSettings: {
          studyDays: 6,
          reviewDays: 1,
          studentLevel: "medium",
          subjectType: "weakness",
        },
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("사이클 일수");
      }
    });
  });

  describe("Invalid Inputs - UUID Validation", () => {
    it("should reject invalid studentId UUID", () => {
      const input = TestScenarios.invalidUuid();
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("studentId");
      }
    });

    it("should reject invalid tenantId UUID", () => {
      const input = createMockInput({
        tenantId: "not-a-valid-uuid",
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("tenantId");
      }
    });
  });

  describe("Invalid Inputs - Required Fields", () => {
    it("should reject empty plan name", () => {
      const input = createMockInput({
        planName: "",
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("planName");
      }
    });

    it("should reject empty subjectCategory", () => {
      const input = TestScenarios.missingSubjectCategory();
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("교과");
      }
    });
  });

  describe("Invalid Inputs - Time Settings", () => {
    it("should reject when study end time is before start time", () => {
      const input = TestScenarios.invalidTimeSettings();
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("시작 시간");
      }
    });

    it("should reject invalid time format", () => {
      const input = createMockInput({
        timeSettings: {
          studyHours: { start: "9:00", end: "22:00" }, // Should be 09:00
        },
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("HH:mm");
      }
    });

    it("should reject invalid lunch time", () => {
      const input = createMockInput({
        timeSettings: {
          studyHours: { start: "09:00", end: "22:00" },
          lunchTime: { start: "13:00", end: "12:00" }, // End before start
        },
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("점심");
      }
    });
  });

  describe("Invalid Inputs - Timetable Settings", () => {
    it("should reject strategy subject without weeklyDays", () => {
      const input = TestScenarios.strategyWithoutWeeklyDays();
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("weeklyDays");
      }
    });

    it("should reject studyDays less than 1", () => {
      const input = createMockInput({
        timetableSettings: {
          studyDays: 0,
          reviewDays: 1,
          studentLevel: "medium",
          subjectType: "weakness",
        },
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
    });

    it("should reject reviewDays greater than 3", () => {
      const input = createMockInput({
        timetableSettings: {
          studyDays: 4,
          reviewDays: 4, // Max is 3
          studentLevel: "medium",
          subjectType: "weakness",
        },
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
    });

    it("should reject when studyDays + reviewDays < 1", () => {
      const input = createMockInput({
        timetableSettings: {
          studyDays: 0,
          reviewDays: 0,
          studentLevel: "medium",
          subjectType: "weakness",
        },
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
    });
  });

  describe("Invalid Inputs - Date Format", () => {
    it("should reject invalid date format for periodStart", () => {
      const input = createMockInput({
        periodStart: "03-01-2025", // Should be YYYY-MM-DD
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("YYYY-MM-DD");
      }
    });

    it("should reject invalid date format for exclusion", () => {
      const input = createMockInput({
        exclusions: [{ date: "2025/03/15" }], // Should be YYYY-MM-DD
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty exclusions array", () => {
      const input = createMockInput({
        exclusions: [],
      });
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exclusions).toHaveLength(0);
      }
    });

    it("should handle empty academySchedules array", () => {
      const input = createMockInput({
        academySchedules: [],
      });
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.academySchedules).toHaveLength(0);
      }
    });

    it("should handle exclusions outside period", () => {
      const input = createMockInput({
        periodStart: "2025-03-01",
        periodEnd: "2025-03-31",
        exclusions: [
          { date: "2025-02-15" }, // Before period
          { date: "2025-04-15" }, // After period
        ],
      });
      const result = validateInput(input);

      expect(result.success).toBe(true);
      if (result.success) {
        // Exclusions outside period should not affect availableDays
        expect(result.data.availableDays).toBe(31);
      }
    });

    it("should handle very long plan name", () => {
      const input = createMockInput({
        planName: "A".repeat(101), // Max 100
      });
      const result = validateInput(input);

      expect(result.success).toBe(false);
    });

    it("should validate all plan purposes", () => {
      const purposes = ["내신대비", "모의고사", "수능", "기타"] as const;

      for (const purpose of purposes) {
        const input = createMockInput({ planPurpose: purpose });
        const result = validateInput(input);
        expect(result.success).toBe(true);
      }
    });

    it("should validate all student levels", () => {
      const levels = ["high", "medium", "low"] as const;

      for (const level of levels) {
        const input = createMockInput({
          timetableSettings: {
            studyDays: 6,
            reviewDays: 1,
            studentLevel: level,
            subjectType: "weakness",
          },
        });
        const result = validateInput(input);
        expect(result.success).toBe(true);
      }
    });
  });
});
