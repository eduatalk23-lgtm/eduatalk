/**
 * AI Plan Generation E2E Validation Tests
 *
 * Integration tests that verify the complete flow:
 * 1. Parse LLM response
 * 2. Validate against constraints
 * 3. Transform to database format
 *
 * These tests use mock data to simulate the full pipeline
 * without actual API calls.
 */

import { describe, it, expect } from "vitest";
import { validatePlans } from "@/lib/domains/plan/llm/validators/planValidator";
import {
  transformLLMResponseToPlans,
  buildContentTypeMap,
  buildAllocationMap,
} from "@/lib/domains/admin-plan/transformers/llmResponseTransformer";
import type { LLMPlanGenerationResponse, TransformContext, BlockInfo } from "@/lib/domains/plan/llm";

// ============================================
// Mock Data Factories
// ============================================

function createValidLLMResponse(): LLMPlanGenerationResponse {
  return {
    weeklyMatrices: [
      {
        weekNumber: 1,
        weekStart: "2026-01-05",
        weekEnd: "2026-01-11",
        days: [
          {
            date: "2026-01-05", // Monday
            dayOfWeek: 1,
            totalMinutes: 120,
            plans: [
              {
                date: "2026-01-05",
                dayOfWeek: 1,
                slotId: "slot-1",
                startTime: "09:00",
                endTime: "10:00",
                contentId: "content-math",
                contentTitle: "수학의 정석",
                subject: "수학",
                subjectCategory: "수학",
                rangeStart: 1,
                rangeEnd: 20,
                rangeDisplay: "p.1-20",
                estimatedMinutes: 60,
                isReview: false,
                priority: "high",
              },
              {
                date: "2026-01-05",
                dayOfWeek: 1,
                slotId: "slot-2",
                startTime: "10:30",
                endTime: "11:30",
                contentId: "content-eng",
                contentTitle: "영어 독해",
                subject: "영어",
                subjectCategory: "영어",
                rangeStart: 1,
                rangeEnd: 10,
                rangeDisplay: "p.1-10",
                estimatedMinutes: 60,
                isReview: false,
                priority: "medium",
              },
            ],
            dailySummary: "수학 집중 학습일",
          },
          {
            date: "2026-01-06", // Tuesday
            dayOfWeek: 2,
            totalMinutes: 90,
            plans: [
              {
                date: "2026-01-06",
                dayOfWeek: 2,
                slotId: "slot-1",
                startTime: "14:00",
                endTime: "15:30",
                contentId: "content-kor",
                contentTitle: "국어 문학",
                subject: "국어",
                subjectCategory: "국어",
                rangeStart: 1,
                rangeEnd: 30,
                rangeDisplay: "p.1-30",
                estimatedMinutes: 90,
                isReview: false,
                priority: "medium",
              },
            ],
            dailySummary: "국어 문학 학습",
          },
        ],
        weeklySummary: "기초 개념 정립 주간",
      },
    ],
    totalPlans: 3,
    recommendations: {
      studyTips: ["아침에 수학 집중"],
      warnings: [],
      suggestedAdjustments: [],
      focusAreas: ["수학 기초"],
    },
  };
}

function createAcademyConflictResponse(): LLMPlanGenerationResponse {
  return {
    weeklyMatrices: [
      {
        weekNumber: 1,
        weekStart: "2026-01-05",
        weekEnd: "2026-01-11",
        days: [
          {
            date: "2026-01-05", // Monday
            dayOfWeek: 1,
            totalMinutes: 60,
            plans: [
              {
                date: "2026-01-05",
                dayOfWeek: 1,
                slotId: "slot-1",
                startTime: "14:30", // Conflicts with academy 14:00-16:00
                endTime: "15:30",
                contentId: "content-math",
                contentTitle: "수학의 정석",
                subject: "수학",
                subjectCategory: "수학",
                rangeStart: 1,
                rangeEnd: 20,
                rangeDisplay: "p.1-20",
                estimatedMinutes: 60,
                isReview: false,
                priority: "high",
              },
            ],
            dailySummary: "수학 학습",
          },
        ],
        weeklySummary: "테스트",
      },
    ],
    totalPlans: 1,
  };
}

function createExcludedDateResponse(): LLMPlanGenerationResponse {
  return {
    weeklyMatrices: [
      {
        weekNumber: 1,
        weekStart: "2026-01-05",
        weekEnd: "2026-01-11",
        days: [
          {
            date: "2026-01-10", // Saturday - excluded day
            dayOfWeek: 6,
            totalMinutes: 60,
            plans: [
              {
                date: "2026-01-10",
                dayOfWeek: 6,
                slotId: "slot-1",
                startTime: "09:00",
                endTime: "10:00",
                contentId: "content-math",
                contentTitle: "수학의 정석",
                subject: "수학",
                subjectCategory: "수학",
                rangeStart: 1,
                rangeEnd: 20,
                rangeDisplay: "p.1-20",
                estimatedMinutes: 60,
                isReview: false,
                priority: "high",
              },
            ],
            dailySummary: "주말 학습",
          },
        ],
        weeklySummary: "테스트",
      },
    ],
    totalPlans: 1,
  };
}

function createMockBlockInfo(overrides: Partial<BlockInfo> = {}): BlockInfo {
  return {
    block_index: 0,
    day_of_week: 1,
    start_time: "08:00",
    end_time: "12:00",
    ...overrides,
  };
}

function createMockTransformContext(): TransformContext {
  return {
    contentTypeMap: buildContentTypeMap([
      { id: "content-math", contentType: "book" },
      { id: "content-eng", contentType: "lecture" },
      { id: "content-kor", contentType: "book" },
    ]),
    blockSets: [
      createMockBlockInfo({ block_index: 0, day_of_week: 1, start_time: "08:00", end_time: "12:00" }),
      createMockBlockInfo({ block_index: 1, day_of_week: 1, start_time: "14:00", end_time: "18:00" }),
      createMockBlockInfo({ block_index: 0, day_of_week: 2, start_time: "08:00", end_time: "12:00" }),
      createMockBlockInfo({ block_index: 1, day_of_week: 2, start_time: "14:00", end_time: "18:00" }),
    ],
    allocationMap: buildAllocationMap([
      { contentId: "content-math", subject: "수학", subject_type: "weakness" },
      { contentId: "content-eng", subject: "영어", subject_type: "strategy" },
      { contentId: "content-kor", subject: "국어", subject_type: null },
    ]),
    academySchedules: [],
    excludeDays: [0, 6], // Sunday, Saturday
    excludeDates: [],
  };
}

// ============================================
// E2E Validation Flow Tests
// ============================================

describe("AI Plan Generation E2E Validation", () => {
  describe("Valid response flow", () => {
    it("should parse valid response and pass all validations", () => {
      const response = createValidLLMResponse();
      const context = createMockTransformContext();

      // Extract plans from response for validation
      const plans = response.weeklyMatrices.flatMap((week) =>
        week.days.flatMap((day) => day.plans)
      );

      // Step 1: Validate plans
      const validationResult = validatePlans({
        plans,
        academySchedules: context.academySchedules,
        blockSets: context.blockSets.map((b) => ({
          id: `block-${b.block_index}-${b.day_of_week}`,
          blockIndex: b.block_index,
          dayOfWeek: b.day_of_week,
          startTime: b.start_time,
          endTime: b.end_time,
        })),
        excludeDays: context.excludeDays,
        excludeDates: context.excludeDates,
        dailyStudyMinutes: 240,
      });

      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // Step 2: Transform to database format
      const transformedPlans = transformLLMResponseToPlans(response, context);

      expect(transformedPlans).toHaveLength(3);
      expect(transformedPlans[0].content_type).toBe("book");
      expect(transformedPlans[1].content_type).toBe("lecture");
      expect(transformedPlans[0].subject_type).toBe("weakness");
      expect(transformedPlans[1].subject_type).toBe("strategy");
    });

    it("should correctly map all required fields", () => {
      const response = createValidLLMResponse();
      const context = createMockTransformContext();

      const transformedPlans = transformLLMResponseToPlans(response, context);

      // Verify first plan
      const plan1 = transformedPlans[0];
      expect(plan1.plan_date).toBe("2026-01-05");
      expect(plan1.start_time).toBe("09:00");
      expect(plan1.end_time).toBe("10:00");
      expect(plan1.content_id).toBe("content-math");
      expect(plan1.content_title).toBe("수학의 정석");
      expect(plan1.content_subject).toBe("수학");
      expect(plan1.planned_start_page_or_time).toBe(1);
      expect(plan1.planned_end_page_or_time).toBe(20);
      expect(plan1.day_type).toBe("학습일");
      expect(plan1.week).toBe(1);
      expect(plan1.day).toBe(1);
    });
  });

  describe("Academy conflict detection", () => {
    it("should detect academy time conflicts", () => {
      const response = createAcademyConflictResponse();

      const plans = response.weeklyMatrices.flatMap((week) =>
        week.days.flatMap((day) => day.plans)
      );

      const validationResult = validatePlans({
        plans,
        academySchedules: [
          {
            id: "academy-1",
            academyName: "영어학원",
            dayOfWeek: 1, // Monday
            startTime: "14:00",
            endTime: "16:00",
            travelTime: 0,
          },
        ],
        blockSets: [],
        excludeDays: [],
        excludeDates: [],
        dailyStudyMinutes: 240,
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.errors[0].type).toBe("academy_conflict");
    });
  });

  describe("Excluded date/day detection", () => {
    it("should detect plans on excluded days (weekends)", () => {
      const response = createExcludedDateResponse();

      const plans = response.weeklyMatrices.flatMap((week) =>
        week.days.flatMap((day) => day.plans)
      );

      const validationResult = validatePlans({
        plans,
        academySchedules: [],
        blockSets: [],
        excludeDays: [6], // Saturday
        excludeDates: [],
        dailyStudyMinutes: 240,
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some((e) => e.type === "excluded_day")).toBe(true);
    });

    it("should detect plans on specific excluded dates", () => {
      const response = createValidLLMResponse(); // Has plan on 2026-01-05

      const plans = response.weeklyMatrices.flatMap((week) =>
        week.days.flatMap((day) => day.plans)
      );

      const validationResult = validatePlans({
        plans,
        academySchedules: [],
        blockSets: [],
        excludeDays: [],
        excludeDates: ["2026-01-05"], // Exclude the date with plans
        dailyStudyMinutes: 240,
      });

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some((e) => e.type === "excluded_date")).toBe(true);
    });
  });

  describe("Block compatibility", () => {
    it("should warn when plan is outside defined blocks", () => {
      const response = createValidLLMResponse();

      const plans = response.weeklyMatrices.flatMap((week) =>
        week.days.flatMap((day) => day.plans)
      );

      // Define blocks that don't cover plan times
      const validationResult = validatePlans({
        plans,
        academySchedules: [],
        blockSets: [
          {
            id: "block-1",
            blockIndex: 0,
            dayOfWeek: 1,
            startTime: "06:00", // Very early morning
            endTime: "07:00", // Ends before plans start
          },
        ],
        excludeDays: [],
        excludeDates: [],
        dailyStudyMinutes: 240,
      });

      // Block incompatibility produces warnings, not errors
      expect(validationResult.valid).toBe(true);
      expect(validationResult.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("ContentType and SubjectType mapping", () => {
    it("should correctly map contentType from context", () => {
      const response = createValidLLMResponse();
      const context = createMockTransformContext();

      const transformedPlans = transformLLMResponseToPlans(response, context);

      // Math content is "book"
      const mathPlan = transformedPlans.find((p) => p.content_id === "content-math");
      expect(mathPlan?.content_type).toBe("book");

      // English content is "lecture"
      const engPlan = transformedPlans.find((p) => p.content_id === "content-eng");
      expect(engPlan?.content_type).toBe("lecture");
    });

    it("should correctly map subjectType from allocation", () => {
      const response = createValidLLMResponse();
      const context = createMockTransformContext();

      const transformedPlans = transformLLMResponseToPlans(response, context);

      // Math is "weakness"
      const mathPlan = transformedPlans.find((p) => p.content_id === "content-math");
      expect(mathPlan?.subject_type).toBe("weakness");

      // English is "strategy"
      const engPlan = transformedPlans.find((p) => p.content_id === "content-eng");
      expect(engPlan?.subject_type).toBe("strategy");

      // Korean is null
      const korPlan = transformedPlans.find((p) => p.content_id === "content-kor");
      expect(korPlan?.subject_type).toBeNull();
    });
  });

  describe("Block index calculation", () => {
    it("should calculate block index based on time ranges", () => {
      const response = createValidLLMResponse();
      const context = createMockTransformContext();

      const transformedPlans = transformLLMResponseToPlans(response, context);

      // Plan at 09:00 (Monday) should be in block 0 (08:00-12:00)
      const morningPlan = transformedPlans.find(
        (p) => p.plan_date === "2026-01-05" && p.start_time === "09:00"
      );
      expect(morningPlan?.block_index).toBe(0);

      // Plan at 14:00 (Tuesday) should be in block 1 (14:00-18:00)
      const afternoonPlan = transformedPlans.find(
        (p) => p.plan_date === "2026-01-06" && p.start_time === "14:00"
      );
      expect(afternoonPlan?.block_index).toBe(1);
    });
  });

  describe("Day type mapping", () => {
    it("should set day_type based on isReview flag", () => {
      const response: LLMPlanGenerationResponse = {
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2026-01-05",
            weekEnd: "2026-01-11",
            days: [
              {
                date: "2026-01-05",
                dayOfWeek: 1,
                totalMinutes: 120,
                plans: [
                  {
                    date: "2026-01-05",
                    dayOfWeek: 1,
                    slotId: "slot-1",
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-math",
                    contentTitle: "수학의 정석",
                    subject: "수학",
                    subjectCategory: "수학",
                    rangeStart: 1,
                    rangeEnd: 20,
                    rangeDisplay: "p.1-20",
                    estimatedMinutes: 60,
                    isReview: false, // Learning day
                    priority: "high",
                  },
                  {
                    date: "2026-01-05",
                    dayOfWeek: 1,
                    slotId: "slot-2",
                    startTime: "10:30",
                    endTime: "11:30",
                    contentId: "content-math",
                    contentTitle: "수학의 정석",
                    subject: "수학",
                    subjectCategory: "수학",
                    rangeStart: 1,
                    rangeEnd: 10,
                    rangeDisplay: "p.1-10",
                    estimatedMinutes: 60,
                    isReview: true, // Review day
                    priority: "medium",
                  },
                ],
                dailySummary: "수학 학습 및 복습",
              },
            ],
            weeklySummary: "테스트",
          },
        ],
        totalPlans: 2,
      };

      const context = createMockTransformContext();
      const transformedPlans = transformLLMResponseToPlans(response, context);

      const learningPlan = transformedPlans[0];
      const reviewPlan = transformedPlans[1];

      expect(learningPlan.day_type).toBe("학습일");
      expect(reviewPlan.day_type).toBe("복습일");
    });
  });
});

// ============================================
// Comprehensive Validation Scenarios
// ============================================

describe("Comprehensive validation scenarios", () => {
  it("should handle multiple validation failures", () => {
    // Response with multiple issues:
    // 1. Academy conflict on Monday
    // 2. Weekend plan on Saturday
    const response: LLMPlanGenerationResponse = {
      weeklyMatrices: [
        {
          weekNumber: 1,
          weekStart: "2026-01-05",
          weekEnd: "2026-01-11",
          days: [
            {
              date: "2026-01-05", // Monday - academy conflict
              dayOfWeek: 1,
              totalMinutes: 60,
              plans: [
                {
                  date: "2026-01-05",
                  dayOfWeek: 1,
                  slotId: "slot-1",
                  startTime: "14:30",
                  endTime: "15:30",
                  contentId: "content-1",
                  contentTitle: "수학",
                  subject: "수학",
                  subjectCategory: "수학",
                  rangeStart: 1,
                  rangeEnd: 20,
                  rangeDisplay: "p.1-20",
                  estimatedMinutes: 60,
                  isReview: false,
                  priority: "high",
                },
              ],
              dailySummary: "수학",
            },
            {
              date: "2026-01-10", // Saturday - weekend
              dayOfWeek: 6,
              totalMinutes: 60,
              plans: [
                {
                  date: "2026-01-10",
                  dayOfWeek: 6,
                  slotId: "slot-2",
                  startTime: "09:00",
                  endTime: "10:00",
                  contentId: "content-2",
                  contentTitle: "영어",
                  subject: "영어",
                  subjectCategory: "영어",
                  rangeStart: 1,
                  rangeEnd: 10,
                  rangeDisplay: "p.1-10",
                  estimatedMinutes: 60,
                  isReview: false,
                  priority: "medium",
                },
              ],
              dailySummary: "영어",
            },
          ],
          weeklySummary: "테스트",
        },
      ],
      totalPlans: 2,
    };

    const plans = response.weeklyMatrices.flatMap((week) =>
      week.days.flatMap((day) => day.plans)
    );

    const validationResult = validatePlans({
      plans,
      academySchedules: [
        {
          id: "academy-1",
          academyName: "영어학원",
          dayOfWeek: 1, // Monday
          startTime: "14:00",
          endTime: "16:00",
          travelTime: 0,
        },
      ],
      blockSets: [],
      excludeDays: [6], // Saturday
      excludeDates: [],
      dailyStudyMinutes: 240,
    });

    expect(validationResult.valid).toBe(false);
    expect(validationResult.errors.length).toBeGreaterThanOrEqual(2);

    // Check both error types are present
    expect(validationResult.errors.some((e) => e.type === "academy_conflict")).toBe(true);
    expect(validationResult.errors.some((e) => e.type === "excluded_day")).toBe(true);
  });
});
