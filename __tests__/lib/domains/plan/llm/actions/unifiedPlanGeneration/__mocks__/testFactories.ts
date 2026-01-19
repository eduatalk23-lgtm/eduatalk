/**
 * Test Factories for Unified Plan Generation Pipeline
 *
 * Mock data factories for testing the unified plan generation pipeline.
 */

import type {
  UnifiedPlanGenerationInput,
  ValidatedPlanInput,
  ResolvedContentItem,
  ContentResolutionResult,
  SchedulerContextResult,
  ScheduleGenerationResult,
  ValidationResult,
  TimeRange,
  AcademyScheduleInput,
  ExclusionInput,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration/types";
import type { ScheduledPlan } from "@/lib/plan/scheduler";

// ============================================================================
// Base Factory Types
// ============================================================================

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// Input Factories
// ============================================================================

/**
 * Creates a valid UnifiedPlanGenerationInput with sensible defaults
 */
export function createMockInput(
  overrides: DeepPartial<UnifiedPlanGenerationInput> = {}
): UnifiedPlanGenerationInput {
  const defaults: UnifiedPlanGenerationInput = {
    studentId: "11111111-1111-1111-1111-111111111111",
    tenantId: "22222222-2222-2222-2222-222222222222",
    planName: "테스트 학습 플랜",
    planPurpose: "내신대비",
    periodStart: "2025-03-01",
    periodEnd: "2025-03-31",
    timeSettings: {
      studyHours: { start: "09:00", end: "22:00" },
      lunchTime: { start: "12:00", end: "13:00" },
    },
    academySchedules: [],
    exclusions: [],
    contentSelection: {
      subjectCategory: "수학",
      subject: "미적분",
      difficulty: "개념",
      contentType: "book",
      maxResults: 5,
    },
    timetableSettings: {
      studyDays: 6,
      reviewDays: 1,
      studentLevel: "medium",
      subjectType: "weakness",
      distributionStrategy: "even",
    },
    generationOptions: {
      saveToDb: false,
      generateMarkdown: true,
      dryRun: true,
    },
  };

  return deepMerge(defaults, overrides) as UnifiedPlanGenerationInput;
}

/**
 * Creates a ValidatedPlanInput (output of Stage 1)
 */
export function createMockValidatedInput(
  overrides: DeepPartial<ValidatedPlanInput> = {}
): ValidatedPlanInput {
  const defaults: ValidatedPlanInput = {
    studentId: "11111111-1111-1111-1111-111111111111",
    tenantId: "22222222-2222-2222-2222-222222222222",
    planName: "테스트 학습 플랜",
    planPurpose: "내신대비",
    periodStart: "2025-03-01",
    periodEnd: "2025-03-31",
    timeSettings: {
      studyHours: { start: "09:00", end: "22:00" },
      lunchTime: { start: "12:00", end: "13:00" },
    },
    academySchedules: [],
    exclusions: [],
    contentSelection: {
      subjectCategory: "수학",
      subject: "미적분",
      difficulty: "개념",
      contentType: "book",
      maxResults: 5,
    },
    timetableSettings: {
      studyDays: 6,
      reviewDays: 1,
      studentLevel: "medium",
      subjectType: "weakness",
      distributionStrategy: "even",
    },
    generationOptions: {
      saveToDb: false,
      generateMarkdown: true,
      dryRun: true,
    },
    totalDays: 31,
    availableDays: 31,
  };

  return deepMerge(defaults, overrides) as ValidatedPlanInput;
}

/**
 * Creates a mock TimeRange
 */
export function createMockTimeRange(
  overrides: Partial<TimeRange> = {}
): TimeRange {
  return {
    start: "09:00",
    end: "22:00",
    ...overrides,
  };
}

/**
 * Creates a mock AcademyScheduleInput
 */
export function createMockAcademySchedule(
  overrides: Partial<AcademyScheduleInput> = {}
): AcademyScheduleInput {
  return {
    dayOfWeek: 1, // Monday
    startTime: "14:00",
    endTime: "16:00",
    name: "수학 학원",
    subject: "수학",
    ...overrides,
  };
}

/**
 * Creates a mock ExclusionInput
 */
export function createMockExclusion(
  overrides: Partial<ExclusionInput> = {}
): ExclusionInput {
  return {
    date: "2025-03-15",
    reason: "개인 사정",
    ...overrides,
  };
}

// ============================================================================
// Content Factories
// ============================================================================

/**
 * Creates a mock ResolvedContentItem
 */
export function createMockResolvedContent(
  overrides: Partial<ResolvedContentItem> = {}
): ResolvedContentItem {
  return {
    id: "bk_test_content",
    title: "테스트 교재",
    contentType: "book",
    totalRange: 280,
    startRange: 1,
    endRange: 280,
    author: "테스트 저자",
    publisher: "테스트 출판사",
    subject: "미적분",
    subjectCategory: "수학",
    chapters: [
      { title: "1. 수열의 극한", startRange: 1, endRange: 70 },
      { title: "2. 급수", startRange: 71, endRange: 140 },
      { title: "3. 미분법", startRange: 141, endRange: 210 },
      { title: "4. 적분법", startRange: 211, endRange: 280 },
    ],
    source: "ai_recommendation",
    matchScore: 85,
    reason: "미적분 개념 학습에 적합한 교재입니다.",
    ...overrides,
  };
}

/**
 * Creates a mock ContentResolutionResult
 */
export function createMockContentResolution(
  overrides: Partial<ContentResolutionResult> = {}
): ContentResolutionResult {
  return {
    items: [createMockResolvedContent()],
    strategy: "ai_recommendation",
    newlySaved: 0,
    ...overrides,
  };
}

// ============================================================================
// Scheduler Context Factories
// ============================================================================

/**
 * Creates a mock SchedulerContextResult
 */
export function createMockSchedulerContext(
  overrides: Partial<SchedulerContextResult> = {}
): SchedulerContextResult {
  return {
    contents: [
      {
        content_type: "book",
        content_id: "bk_test_content",
        start_range: 1,
        end_range: 281, // exclusive
        total_amount: 280,
        subject: "미적분",
        subject_category: "수학",
        chapter: "1. 수열의 극한",
      },
    ],
    blocks: [
      {
        id: "block-1",
        day_of_week: 0,
        block_index: 0,
        start_time: "09:00",
        end_time: "12:00",
        duration_minutes: 180,
      },
      {
        id: "block-2",
        day_of_week: 0,
        block_index: 1,
        start_time: "13:00",
        end_time: "22:00",
        duration_minutes: 540,
      },
    ],
    exclusions: [],
    academySchedules: [],
    subjectTypeMap: new Map([["bk_test_content", "weakness"]]),
    periodStart: "2025-03-01",
    periodEnd: "2025-03-31",
    ...overrides,
  };
}

// ============================================================================
// Schedule Generation Factories
// ============================================================================

/**
 * Creates a mock ScheduledPlan
 */
export function createMockScheduledPlan(
  overrides: Partial<ScheduledPlan> = {}
): ScheduledPlan {
  return {
    plan_date: "2025-03-03",
    block_index: 0,
    content_type: "book",
    content_id: "bk_test_content",
    planned_start_page_or_time: 1,
    planned_end_page_or_time: 35,
    is_reschedulable: true,
    start_time: "09:00",
    end_time: "10:30",
    cycle_day_number: 1,
    date_type: "study",
    ...overrides,
  };
}

/**
 * Creates a mock ScheduleGenerationResult
 */
export function createMockScheduleResult(
  overrides: Partial<ScheduleGenerationResult> = {}
): ScheduleGenerationResult {
  const plans = overrides.plans ?? [
    createMockScheduledPlan({ plan_date: "2025-03-03", cycle_day_number: 1 }),
    createMockScheduledPlan({
      plan_date: "2025-03-04",
      cycle_day_number: 2,
      planned_start_page_or_time: 36,
      planned_end_page_or_time: 70,
    }),
    createMockScheduledPlan({
      plan_date: "2025-03-05",
      cycle_day_number: 3,
      planned_start_page_or_time: 71,
      planned_end_page_or_time: 105,
    }),
  ];

  return {
    plans,
    cycleDays: plans.map((p) => ({
      date: p.plan_date,
      dayType: p.date_type ?? "study",
      cycleDayNumber: p.cycle_day_number ?? 1,
    })),
    failureReasons: [],
    ...overrides,
  };
}

// ============================================================================
// Validation Factories
// ============================================================================

/**
 * Creates a mock ValidationResult
 */
export function createMockValidationResult(
  overrides: Partial<ValidationResult> = {}
): ValidationResult {
  return {
    isValid: true,
    plans: [createMockScheduledPlan()],
    warnings: [],
    autoAdjustedCount: 0,
    unadjustablePlans: [],
    ...overrides,
  };
}

// ============================================================================
// Test Scenarios
// ============================================================================

export const TestScenarios = {
  /**
   * Normal case: Valid input with default settings
   */
  normalCase: () => createMockInput(),

  /**
   * Strategy subject with weeklyDays
   */
  strategySubject: () =>
    createMockInput({
      timetableSettings: {
        studyDays: 6,
        reviewDays: 1,
        studentLevel: "medium",
        subjectType: "strategy",
        weeklyDays: 3,
      },
    }),

  /**
   * Short period (minimum 7 days)
   */
  shortPeriod: () =>
    createMockInput({
      periodStart: "2025-03-01",
      periodEnd: "2025-03-07",
    }),

  /**
   * Period too short (should fail)
   */
  periodTooShort: () =>
    createMockInput({
      periodStart: "2025-03-01",
      periodEnd: "2025-03-05", // Only 5 days
    }),

  /**
   * Many exclusions
   */
  manyExclusions: () =>
    createMockInput({
      exclusions: [
        { date: "2025-03-05", reason: "휴일" },
        { date: "2025-03-10", reason: "휴일" },
        { date: "2025-03-15", reason: "휴일" },
        { date: "2025-03-20", reason: "휴일" },
        { date: "2025-03-25", reason: "휴일" },
      ],
    }),

  /**
   * With academy schedules
   */
  withAcademySchedules: () =>
    createMockInput({
      academySchedules: [
        { dayOfWeek: 1, startTime: "14:00", endTime: "16:00", name: "수학" },
        { dayOfWeek: 3, startTime: "14:00", endTime: "16:00", name: "영어" },
      ],
    }),

  /**
   * Invalid UUID (should fail validation)
   */
  invalidUuid: () =>
    createMockInput({
      studentId: "not-a-uuid",
    }),

  /**
   * Missing required field
   */
  missingSubjectCategory: () => {
    const input = createMockInput();
    // @ts-expect-error - Testing invalid input
    input.contentSelection.subjectCategory = "";
    return input;
  },

  /**
   * Strategy without weeklyDays (should fail)
   */
  strategyWithoutWeeklyDays: () =>
    createMockInput({
      timetableSettings: {
        studyDays: 6,
        reviewDays: 1,
        studentLevel: "medium",
        subjectType: "strategy",
        // weeklyDays missing - should fail
      },
    }),

  /**
   * Invalid time settings
   */
  invalidTimeSettings: () =>
    createMockInput({
      timeSettings: {
        studyHours: { start: "22:00", end: "09:00" }, // End before start
      },
    }),
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Deep merge two objects
 */
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key as keyof typeof source];
      const targetValue = target[key as keyof T];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === "object" &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === "object" &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as DeepPartial<typeof targetValue>
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  return result;
}
