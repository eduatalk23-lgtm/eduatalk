/**
 * Plan Validator Tests
 * Phase 3: validatePlans function and sub-validators
 *
 * Tests the validation integration added in Phase 3 of AI Plan Generation Quality Improvement
 */

import { describe, it, expect } from "vitest";
import {
  validatePlans,
  validateAcademyConflicts,
  validateExcludedDates,
  validateBlockCompatibility,
  validateTimeFormats,
  validateDailyStudyMinutes,
} from "@/lib/domains/plan/llm/validators/planValidator";
import {
  createMockPlan,
  createMockAcademySchedule,
  createMockBlock,
  TestScenarios,
} from "../__mocks__/planValidation";

// ============================================
// validateAcademyConflicts Tests
// ============================================

describe("validateAcademyConflicts", () => {
  describe("No conflict scenarios", () => {
    it("should pass when plan is before academy time", () => {
      // 2026-01-05 is Monday (dayOfWeek: 1)
      const plans = [createMockPlan({ date: "2026-01-05", startTime: "09:00", endTime: "10:00" })];
      const academySchedules = [
        createMockAcademySchedule({ dayOfWeek: 1, startTime: "14:00", endTime: "16:00" }),
      ];

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should pass when plan is after academy time", () => {
      // 2026-01-05 is Monday (dayOfWeek: 1)
      const plans = [createMockPlan({ date: "2026-01-05", startTime: "17:00", endTime: "18:00" })];
      const academySchedules = [
        createMockAcademySchedule({ dayOfWeek: 1, startTime: "14:00", endTime: "16:00" }),
      ];

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should pass when academy is on different day", () => {
      // 2026-01-05 is Monday (dayOfWeek: 1)
      const plans = [
        createMockPlan({
          date: "2026-01-05", // Monday
          startTime: "14:00",
          endTime: "16:00",
        }),
      ];
      const academySchedules = [
        createMockAcademySchedule({
          dayOfWeek: 2, // Tuesday - different from plan's Monday
          startTime: "14:00",
          endTime: "16:00",
        }),
      ];

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.valid).toBe(true);
    });

    it("should pass when no academy schedules provided", () => {
      const plans = [createMockPlan()];

      const result = validateAcademyConflicts(plans, []);

      expect(result.valid).toBe(true);
    });
  });

  describe("Conflict scenarios", () => {
    it("should detect direct time overlap with academy", () => {
      const { plans, academySchedules } = TestScenarios.academyConflict;

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe("academy_conflict");
    });

    it("should consider travel time when checking conflicts", () => {
      const { plans, academySchedules } = TestScenarios.academyConflictWithTravelTime;

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("학원");
    });

    it("should include academy name in error message", () => {
      const plans = [createMockPlan({ startTime: "14:30", endTime: "15:30" })];
      const academySchedules = [
        createMockAcademySchedule({
          academyName: "수학학원",
          startTime: "14:00",
          endTime: "16:00",
          travelTime: 0,
        }),
      ];

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.errors[0].message).toContain("수학학원");
    });

    it("should provide suggestion for conflict resolution", () => {
      const plans = [createMockPlan({ startTime: "14:30", endTime: "15:30" })];
      const academySchedules = [
        createMockAcademySchedule({
          startTime: "14:00",
          endTime: "16:00",
          travelTime: 0,
        }),
      ];

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.errors[0].suggestion).toBeDefined();
    });

    it("should handle multiple conflicting academies", () => {
      const plans = [
        createMockPlan({ startTime: "14:30", endTime: "15:30" }),
        createMockPlan({
          startTime: "17:30",
          endTime: "18:30",
          contentId: "content-2",
        }),
      ];
      const academySchedules = [
        createMockAcademySchedule({
          academyName: "영어학원",
          startTime: "14:00",
          endTime: "16:00",
          travelTime: 0,
        }),
        createMockAcademySchedule({
          id: "academy-2",
          academyName: "수학학원",
          startTime: "17:00",
          endTime: "19:00",
          travelTime: 0,
        }),
      ];

      const result = validateAcademyConflicts(plans, academySchedules);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });
});

// ============================================
// validateExcludedDates Tests
// ============================================

describe("validateExcludedDates", () => {
  describe("Date exclusion", () => {
    it("should pass when plan is not on excluded date", () => {
      const plans = [createMockPlan({ date: "2026-01-06" })];

      const result = validateExcludedDates(plans, [], ["2026-01-07", "2026-01-08"]);

      expect(result.valid).toBe(true);
    });

    it("should fail when plan is on excluded date", () => {
      const { plans, excludeDates } = TestScenarios.excludedDateViolation;

      const result = validateExcludedDates(plans, [], excludeDates);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("excluded_date");
      expect(result.errors[0].message).toContain("2026-01-07");
    });
  });

  describe("Day of week exclusion", () => {
    it("should pass when plan is not on excluded day", () => {
      const plans = [createMockPlan({ date: "2026-01-06", dayOfWeek: 1 })]; // Monday

      const result = validateExcludedDates(plans, [0, 6], []); // Exclude Sunday, Saturday

      expect(result.valid).toBe(true);
    });

    it("should fail when plan is on excluded day of week", () => {
      const { plans, excludeDays } = TestScenarios.weekendViolation;

      const result = validateExcludedDates(plans, excludeDays, []);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe("excluded_day");
    });

    it("should include Korean day name in error message for Saturday", () => {
      const plans = [createMockPlan({ date: "2026-01-10", dayOfWeek: 6 })]; // Saturday

      const result = validateExcludedDates(plans, [6], []);

      expect(result.errors[0].message).toContain("토요일");
    });

    it("should include Korean day name in error message for Sunday", () => {
      const plans = [createMockPlan({ date: "2026-01-11", dayOfWeek: 0 })]; // Sunday

      const result = validateExcludedDates(plans, [0], []);

      expect(result.errors[0].message).toContain("일요일");
    });
  });

  describe("Combined exclusions", () => {
    it("should detect both date and day exclusions", () => {
      const plans = [
        createMockPlan({ date: "2026-01-07", dayOfWeek: 2 }), // Tuesday, also excluded date
        createMockPlan({ date: "2026-01-10", dayOfWeek: 6, contentId: "content-2" }), // Saturday
      ];

      const result = validateExcludedDates(plans, [6], ["2026-01-07"]);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });
});

// ============================================
// validateBlockCompatibility Tests
// ============================================

describe("validateBlockCompatibility", () => {
  describe("Block matching", () => {
    it("should pass when plan fits within a block", () => {
      // 2026-01-05 is Monday (dayOfWeek: 1)
      const plans = [
        createMockPlan({
          date: "2026-01-05",
          startTime: "09:00",
          endTime: "10:00",
        }),
      ];
      const blocks = [createMockBlock({ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" })];

      const result = validateBlockCompatibility(plans, blocks);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn when plan is outside all blocks", () => {
      const { plans, blockSets } = TestScenarios.blockIncompatibility;

      const result = validateBlockCompatibility(plans, blockSets);

      expect(result.valid).toBe(true); // Still valid, just warning
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Day-specific blocks", () => {
    it("should only check blocks for the same day of week", () => {
      // 2026-01-05 is Monday (dayOfWeek: 1)
      const plans = [
        createMockPlan({
          date: "2026-01-05",
          startTime: "09:00",
          endTime: "10:00",
        }),
      ];
      const blocks = [
        createMockBlock({ dayOfWeek: 2, startTime: "08:00", endTime: "12:00" }), // Tuesday only - no blocks for Monday
      ];

      const result = validateBlockCompatibility(plans, blocks);

      // Should warn because no blocks defined for Monday
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("should pass when no blocks are defined", () => {
      const plans = [createMockPlan()];

      const result = validateBlockCompatibility(plans, []);

      expect(result.valid).toBe(true);
    });
  });
});

// ============================================
// validateTimeFormats Tests
// ============================================

describe("validateTimeFormats", () => {
  it("should pass for valid HH:mm format", () => {
    const plans = [createMockPlan({ startTime: "09:00", endTime: "10:30" })];

    const result = validateTimeFormats(plans);

    expect(result.valid).toBe(true);
  });

  it("should fail for impossible hour values", () => {
    const plans = [createMockPlan({ startTime: "25:00", endTime: "10:30" })];

    const result = validateTimeFormats(plans);

    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe("invalid_time");
  });

  it("should fail for impossible minute values", () => {
    const plans = [createMockPlan({ startTime: "09:60", endTime: "10:30" })];

    const result = validateTimeFormats(plans);

    expect(result.valid).toBe(false);
  });

  it("should fail when end time is before start time", () => {
    const plans = [createMockPlan({ startTime: "10:00", endTime: "09:00" })];

    const result = validateTimeFormats(plans);

    expect(result.valid).toBe(false);
  });
});

// ============================================
// validateDailyStudyMinutes Tests
// ============================================

describe("validateDailyStudyMinutes", () => {
  it("should pass when daily total is within limit", () => {
    const plans = [
      createMockPlan({ date: "2026-01-06", estimatedMinutes: 60 }),
      createMockPlan({ date: "2026-01-06", estimatedMinutes: 60, contentId: "content-2" }),
    ];

    const result = validateDailyStudyMinutes(plans, 180);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("should error when daily total exceeds limit with tolerance", () => {
    // TestScenarios.dailyStudyExceeded: 360 minutes total, limit 180
    // 360 > 180 * 1.2 (216) = error (time_overflow)
    const { plans, dailyStudyMinutes } = TestScenarios.dailyStudyExceeded;

    const result = validateDailyStudyMinutes(plans, dailyStudyMinutes!);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe("time_overflow");
  });

  it("should calculate total correctly across multiple plans on same day", () => {
    // 2026-01-05 is Monday
    const plans = [
      createMockPlan({ date: "2026-01-05", estimatedMinutes: 100 }),
      createMockPlan({ date: "2026-01-05", estimatedMinutes: 100, contentId: "content-2" }),
      createMockPlan({ date: "2026-01-05", estimatedMinutes: 100, contentId: "content-3" }),
    ]; // Total: 300 minutes, limit 180 * 1.2 = 216

    const result = validateDailyStudyMinutes(plans, 180);

    // 300 > 216 → should produce error
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should separate totals by date", () => {
    const plans = [
      createMockPlan({ date: "2026-01-06", estimatedMinutes: 100 }),
      createMockPlan({ date: "2026-01-07", estimatedMinutes: 100, contentId: "content-2" }),
    ];

    const result = validateDailyStudyMinutes(plans, 180);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

// ============================================
// validatePlans (Orchestrator) Tests
// ============================================

describe("validatePlans (orchestrator)", () => {
  it("should return valid when all validations pass", () => {
    const { plans, academySchedules, blockSets, excludeDays, excludeDates } =
      TestScenarios.normalDay;

    const result = validatePlans({
      plans,
      academySchedules,
      blockSets,
      excludeDays,
      excludeDates,
      dailyStudyMinutes: 240,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should combine all validation errors", () => {
    const { plans, academySchedules, excludeDays, excludeDates } =
      TestScenarios.multipleFailures;

    const result = validatePlans({
      plans,
      academySchedules,
      blockSets: [],
      excludeDays,
      excludeDates,
      dailyStudyMinutes: 240,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("should include academy conflict errors", () => {
    const { plans, academySchedules } = TestScenarios.academyConflict;

    const result = validatePlans({
      plans,
      academySchedules,
      blockSets: [],
      excludeDays: [],
      excludeDates: [],
      dailyStudyMinutes: 240,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "academy_conflict")).toBe(true);
  });

  it("should include excluded date errors", () => {
    const { plans, excludeDates } = TestScenarios.excludedDateViolation;

    const result = validatePlans({
      plans,
      academySchedules: [],
      blockSets: [],
      excludeDays: [],
      excludeDates,
      dailyStudyMinutes: 240,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "excluded_date")).toBe(true);
  });

  it("should include excluded day errors", () => {
    const { plans, excludeDays } = TestScenarios.weekendViolation;

    const result = validatePlans({
      plans,
      academySchedules: [],
      blockSets: [],
      excludeDays,
      excludeDates: [],
      dailyStudyMinutes: 240,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === "excluded_day")).toBe(true);
  });

  it("should return valid=true with only warnings (no errors)", () => {
    const { plans, blockSets } = TestScenarios.blockIncompatibility;

    const result = validatePlans({
      plans,
      academySchedules: [],
      blockSets,
      excludeDays: [],
      excludeDates: [],
      dailyStudyMinutes: 240,
    });

    // Block incompatibility generates warnings, not errors
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
