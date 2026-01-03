/**
 * Mock Data Factories for Plan Validation Testing
 * Phase 5: AI Plan Generation Quality Improvement Tests
 */

import type { GeneratedPlanItem } from "@/lib/domains/plan/llm/types";
import type {
  AcademyScheduleForPrompt,
  BlockInfoForPrompt,
} from "@/lib/domains/plan/llm/transformers/requestBuilder";

// ============================================
// Plan Mock Factory
// ============================================

export interface MockPlanOptions extends Partial<GeneratedPlanItem> {}

export function createMockPlan(options: MockPlanOptions = {}): GeneratedPlanItem {
  // 2026-01-05 is Monday (dayOfWeek: 1)
  const date = options.date || "2026-01-05";
  const dayOfWeek = options.dayOfWeek ?? new Date(date).getDay();

  return {
    date,
    dayOfWeek,
    slotId: "slot-1",
    startTime: "09:00",
    endTime: "10:00",
    contentId: "content-1",
    contentTitle: "수학의 정석",
    subject: "수학",
    subjectCategory: "수학",
    rangeStart: 1,
    rangeEnd: 20,
    rangeDisplay: "p.1-20",
    estimatedMinutes: 60,
    isReview: false,
    notes: undefined,
    priority: "medium",
    ...options,
  };
}

// ============================================
// Academy Schedule Mock Factory
// ============================================

export interface MockAcademyOptions extends Partial<AcademyScheduleForPrompt> {}

export function createMockAcademySchedule(
  options: MockAcademyOptions = {}
): AcademyScheduleForPrompt {
  return {
    id: "academy-1",
    academyName: "영어학원",
    dayOfWeek: 1, // Monday
    startTime: "14:00",
    endTime: "16:00",
    travelTime: 30,
    ...options,
  };
}

// ============================================
// Block Info Mock Factory
// ============================================

export interface MockBlockOptions extends Partial<BlockInfoForPrompt> {}

export function createMockBlock(options: MockBlockOptions = {}): BlockInfoForPrompt {
  return {
    id: "block-1",
    blockIndex: 0,
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "12:00",
    ...options,
  };
}

// ============================================
// Pre-built Test Scenarios
// ============================================

export const TestScenarios = {
  // Scenario: Normal day with no conflicts
  // 2026-01-05 is Monday (dayOfWeek: 1)
  normalDay: {
    plans: [
      createMockPlan({ date: "2026-01-05", startTime: "09:00", endTime: "10:00" }),
      createMockPlan({ date: "2026-01-05", startTime: "10:30", endTime: "11:30", contentId: "content-2" }),
      createMockPlan({ date: "2026-01-05", startTime: "17:00", endTime: "18:00", contentId: "content-3" }),
    ],
    academySchedules: [],
    blockSets: [
      createMockBlock({ dayOfWeek: 1, blockIndex: 0, startTime: "08:00", endTime: "12:00" }),
      createMockBlock({ dayOfWeek: 1, blockIndex: 1, startTime: "14:00", endTime: "18:00" }),
    ],
    excludeDays: [0, 6], // Exclude weekends
    excludeDates: [] as string[],
  },

  // Scenario: Academy conflict
  // 2026-01-05 is Monday (dayOfWeek: 1)
  academyConflict: {
    plans: [
      createMockPlan({ date: "2026-01-05", startTime: "09:00", endTime: "10:00" }),
      createMockPlan({ date: "2026-01-05", startTime: "14:30", endTime: "15:30", contentId: "content-2" }), // Conflicts with academy
    ],
    academySchedules: [
      createMockAcademySchedule({
        dayOfWeek: 1, // Monday
        startTime: "14:00",
        endTime: "16:00",
        travelTime: 0,
      }),
    ],
    blockSets: [] as BlockInfoForPrompt[],
    excludeDays: [] as number[],
    excludeDates: [] as string[],
  },

  // Scenario: Academy conflict with travel time
  // 2026-01-05 is Monday (dayOfWeek: 1)
  academyConflictWithTravelTime: {
    plans: [
      createMockPlan({ date: "2026-01-05", startTime: "13:30", endTime: "14:00", contentId: "content-1" }), // Conflicts due to travel time
    ],
    academySchedules: [
      createMockAcademySchedule({
        dayOfWeek: 1, // Monday
        startTime: "14:00",
        endTime: "16:00",
        travelTime: 30, // 30 minutes travel time
      }),
    ],
    blockSets: [] as BlockInfoForPrompt[],
    excludeDays: [] as number[],
    excludeDates: [] as string[],
  },

  // Scenario: Excluded date violation
  // 2026-01-07 is Wednesday
  excludedDateViolation: {
    plans: [createMockPlan({ date: "2026-01-07" })], // This date is excluded
    academySchedules: [] as AcademyScheduleForPrompt[],
    blockSets: [] as BlockInfoForPrompt[],
    excludeDays: [] as number[],
    excludeDates: ["2026-01-07"],
  },

  // Scenario: Weekend violation (Saturday)
  // 2026-01-10 is Saturday (dayOfWeek: 6)
  weekendViolation: {
    plans: [createMockPlan({ date: "2026-01-10" })], // Saturday - dayOfWeek calculated from date
    academySchedules: [] as AcademyScheduleForPrompt[],
    blockSets: [] as BlockInfoForPrompt[],
    excludeDays: [6], // Exclude Saturday
    excludeDates: [] as string[],
  },

  // Scenario: Block incompatibility (plan outside defined blocks)
  // 2026-01-05 is Monday (dayOfWeek: 1)
  blockIncompatibility: {
    plans: [
      createMockPlan({ date: "2026-01-05", startTime: "13:00", endTime: "14:00" }), // Outside defined blocks
    ],
    academySchedules: [] as AcademyScheduleForPrompt[],
    blockSets: [createMockBlock({ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" })],
    excludeDays: [] as number[],
    excludeDates: [] as string[],
  },

  // Scenario: Multiple validation failures
  multipleFailures: {
    plans: [
      createMockPlan({ date: "2026-01-05", startTime: "14:30", endTime: "15:30" }), // Academy conflict (Monday)
      createMockPlan({ date: "2026-01-10", contentId: "content-2" }), // Weekend (Saturday)
      createMockPlan({ date: "2026-01-07", contentId: "content-3" }), // Excluded date (Wednesday)
    ],
    academySchedules: [
      createMockAcademySchedule({
        dayOfWeek: 1, // Monday
        startTime: "14:00",
        endTime: "16:00",
        travelTime: 0,
      }),
    ],
    blockSets: [] as BlockInfoForPrompt[],
    excludeDays: [6],
    excludeDates: ["2026-01-07"],
  },

  // Scenario: Daily study minutes exceeded
  // 2026-01-05 is Monday
  dailyStudyExceeded: {
    plans: [
      createMockPlan({ date: "2026-01-05", startTime: "08:00", endTime: "10:00", estimatedMinutes: 120 }),
      createMockPlan({
        date: "2026-01-05",
        startTime: "10:30",
        endTime: "12:30",
        estimatedMinutes: 120,
        contentId: "content-2",
      }),
      createMockPlan({
        date: "2026-01-05",
        startTime: "14:00",
        endTime: "16:00",
        estimatedMinutes: 120,
        contentId: "content-3",
      }),
    ], // Total: 360 minutes
    academySchedules: [] as AcademyScheduleForPrompt[],
    blockSets: [] as BlockInfoForPrompt[],
    excludeDays: [] as number[],
    excludeDates: [] as string[],
    dailyStudyMinutes: 180, // Limit: 180 minutes
  },
};

// ============================================
// LLM Response Mock Factory
// ============================================

export interface MockLLMResponseOptions {
  plans?: GeneratedPlanItem[];
  weekNumber?: number;
  weekStart?: string;
  weekEnd?: string;
  includeRecommendations?: boolean;
}

export function createMockLLMResponse(options: MockLLMResponseOptions = {}) {
  const plans = options.plans || [createMockPlan()];
  const weekStart = options.weekStart || "2026-01-06";
  const weekEnd = options.weekEnd || "2026-01-12";

  return {
    weeklyMatrices: [
      {
        weekNumber: options.weekNumber || 1,
        weekStart,
        weekEnd,
        days: [
          {
            date: weekStart,
            dayOfWeek: 1,
            totalMinutes: plans.reduce((sum, p) => sum + p.estimatedMinutes, 0),
            plans,
            dailySummary: "테스트 학습일",
          },
        ],
        weeklySummary: "테스트 주간 학습",
      },
    ],
    totalPlans: plans.length,
    recommendations: options.includeRecommendations
      ? {
          studyTips: ["아침에 수학 집중"],
          warnings: [],
          suggestedAdjustments: [],
          focusAreas: ["수학"],
        }
      : undefined,
  };
}

// ============================================
// Helper: Create plans with required fields
// ============================================

export function createMockPlanWithRequiredFields(
  options: MockPlanOptions & {
    contentType?: "book" | "lecture" | "custom";
    blockIndex?: number;
    subjectType?: "strategy" | "weakness" | null;
  } = {}
): GeneratedPlanItem & {
  contentType: "book" | "lecture" | "custom";
  blockIndex: number;
  subjectType: "strategy" | "weakness" | null;
} {
  const basePlan = createMockPlan(options);
  return {
    ...basePlan,
    contentType: options.contentType || "book",
    blockIndex: options.blockIndex ?? 0,
    subjectType: options.subjectType ?? null,
  };
}
