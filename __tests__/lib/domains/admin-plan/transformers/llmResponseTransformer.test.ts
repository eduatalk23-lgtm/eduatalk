/**
 * LLM Response Transformer Tests
 * Phase 1: Transform context handling and field mapping
 *
 * Tests the transformation of LLM responses to plan payloads
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  transformLLMResponseToPlans,
  createEmptyTransformContext,
  buildContentTypeMap,
  buildAllocationMap,
  toAtomicPlanPayloads,
  batchPlanItemsToAtomicPayloads,
  type TransformedPlanPayload,
} from "@/lib/domains/admin-plan/transformers/llmResponseTransformer";
import type { LLMPlanGenerationResponse, TransformContext, BlockInfo } from "@/lib/domains/plan/llm";
import type { ContentType } from "@/lib/types/plan-generation";

// ============================================
// Mock LLM Response Factory
// ============================================

function createMockLLMResponse(
  overrides: Partial<LLMPlanGenerationResponse> = {}
): LLMPlanGenerationResponse {
  return {
    weeklyMatrices: [
      {
        weekNumber: 1,
        weekStart: "2026-01-05",
        weekEnd: "2026-01-11",
        days: [
          {
            date: "2026-01-05",
            dayOfWeek: 1,
            totalMinutes: 60,
            plans: [
              {
                date: "2026-01-05",
                dayOfWeek: 1,
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
              },
            ],
            dailySummary: "테스트 학습일",
          },
        ],
        weeklySummary: "테스트 주간",
      },
    ],
    totalPlans: 1,
    ...overrides,
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

// ============================================
// TransformContext Warning Tests
// ============================================

describe("transformLLMResponseToPlans", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("TransformContext warning logging", () => {
    it("should log warning when context is not provided", () => {
      const response = createMockLLMResponse();

      transformLLMResponseToPlans(response);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("TransformContext가 제공되지 않았습니다")
      );
    });

    it("should log warning when contentTypeMap is empty", () => {
      const response = createMockLLMResponse();
      const context: TransformContext = {
        contentTypeMap: new Map(), // Empty
        blockSets: [createMockBlockInfo()],
        allocationMap: new Map(),
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      transformLLMResponseToPlans(response, context);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("contentTypeMap이 비어 있습니다")
      );
    });

    it("should log warning when blockSets is empty", () => {
      const response = createMockLLMResponse();
      const context: TransformContext = {
        contentTypeMap: new Map([["content-1", "book"]]),
        blockSets: [], // Empty
        allocationMap: new Map(),
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      transformLLMResponseToPlans(response, context);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("blockSets가 비어 있습니다")
      );
    });

    it("should not log warnings when context is fully provided", () => {
      const response = createMockLLMResponse();
      const context: TransformContext = {
        contentTypeMap: new Map([["content-1", "book"]]),
        blockSets: [createMockBlockInfo()],
        allocationMap: new Map(),
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      transformLLMResponseToPlans(response, context);

      // Only check that specific warnings were NOT called
      const warningMessages = consoleWarnSpy.mock.calls.map((call) => call[0]);
      expect(
        warningMessages.some((msg) => msg.includes("TransformContext가 제공되지 않았습니다"))
      ).toBe(false);
    });
  });

  describe("Field mapping with context", () => {
    it("should determine content_type from contentTypeMap", () => {
      const response = createMockLLMResponse();
      const context: TransformContext = {
        contentTypeMap: new Map<string, ContentType>([["content-1", "lecture"]]),
        blockSets: [createMockBlockInfo()],
        allocationMap: new Map(),
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      const result = transformLLMResponseToPlans(response, context);

      expect(result[0].content_type).toBe("lecture");
    });

    it("should fall back to 'book' when contentId not in map", () => {
      const response = createMockLLMResponse();
      const context: TransformContext = {
        contentTypeMap: new Map<string, ContentType>([["other-content", "lecture"]]),
        blockSets: [createMockBlockInfo()],
        allocationMap: new Map(),
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      const result = transformLLMResponseToPlans(response, context);

      expect(result[0].content_type).toBe("book");
    });

    it("should calculate block_index from blockSets", () => {
      const response = createMockLLMResponse();
      // Plan starts at 09:00, block 0 is 08:00-12:00
      const context: TransformContext = {
        contentTypeMap: new Map([["content-1", "book"]]),
        blockSets: [
          createMockBlockInfo({ block_index: 0, day_of_week: 1, start_time: "08:00", end_time: "12:00" }),
          createMockBlockInfo({ block_index: 1, day_of_week: 1, start_time: "14:00", end_time: "18:00" }),
        ],
        allocationMap: new Map(),
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      const result = transformLLMResponseToPlans(response, context);

      expect(result[0].block_index).toBe(0); // 09:00 is within 08:00-12:00
    });

    it("should determine subject_type from allocationMap", () => {
      const response = createMockLLMResponse();
      const context: TransformContext = {
        contentTypeMap: new Map([["content-1", "book"]]),
        blockSets: [createMockBlockInfo()],
        allocationMap: new Map([
          [
            "content-1",
            {
              contentId: "content-1",
              subject: "수학",
              subject_type: "weakness" as const,
            },
          ],
        ]),
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      const result = transformLLMResponseToPlans(response, context);

      expect(result[0].subject_type).toBe("weakness");
    });

    it("should set subject_type to null when not in allocationMap", () => {
      const response = createMockLLMResponse();
      const context: TransformContext = {
        contentTypeMap: new Map([["content-1", "book"]]),
        blockSets: [createMockBlockInfo()],
        allocationMap: new Map(), // Empty
        academySchedules: [],
        excludeDays: [],
        excludeDates: [],
      };

      const result = transformLLMResponseToPlans(response, context);

      expect(result[0].subject_type).toBeNull();
    });
  });

  describe("Field mapping without context", () => {
    it("should use fallback values when no context provided", () => {
      const response = createMockLLMResponse();

      const result = transformLLMResponseToPlans(response);

      expect(result[0].content_type).toBe("book"); // Fallback
      expect(result[0].subject_type).toBeNull(); // Fallback
    });

    it("should use array index for block_index when no blockSets", () => {
      const response = createMockLLMResponse({
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
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    subjectCategory: "수학",
                    rangeStart: 1,
                    rangeEnd: 20,
                    rangeDisplay: "p.1-20",
                    estimatedMinutes: 60,
                    isReview: false,
                    priority: "medium",
                  },
                  {
                    date: "2026-01-05",
                    dayOfWeek: 1,
                    slotId: "slot-2",
                    startTime: "10:30",
                    endTime: "11:30",
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
                dailySummary: "테스트",
              },
            ],
            weeklySummary: "테스트",
          },
        ],
        totalPlans: 2,
      });

      const result = transformLLMResponseToPlans(response);

      // When no blockSets, uses array index
      expect(result[0].block_index).toBe(0);
      expect(result[1].block_index).toBe(1);
    });
  });

  describe("Core field transformations", () => {
    it("should correctly map plan_date", () => {
      const response = createMockLLMResponse();

      const result = transformLLMResponseToPlans(response);

      expect(result[0].plan_date).toBe("2026-01-05");
    });

    it("should correctly map start_time and end_time", () => {
      const response = createMockLLMResponse();

      const result = transformLLMResponseToPlans(response);

      expect(result[0].start_time).toBe("09:00");
      expect(result[0].end_time).toBe("10:00");
    });

    it("should correctly map planned_start/end_page_or_time", () => {
      const response = createMockLLMResponse();

      const result = transformLLMResponseToPlans(response);

      expect(result[0].planned_start_page_or_time).toBe(1);
      expect(result[0].planned_end_page_or_time).toBe(20);
    });

    it("should set day_type based on isReview flag", () => {
      const response = createMockLLMResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2026-01-05",
            weekEnd: "2026-01-11",
            days: [
              {
                date: "2026-01-05",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2026-01-05",
                    dayOfWeek: 1,
                    slotId: "slot-1",
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    subjectCategory: "수학",
                    rangeStart: 1,
                    rangeEnd: 20,
                    rangeDisplay: "p.1-20",
                    estimatedMinutes: 60,
                    isReview: true, // Review day
                    priority: "medium",
                  },
                ],
                dailySummary: "복습일",
              },
            ],
            weeklySummary: "테스트",
          },
        ],
        totalPlans: 1,
      });

      const result = transformLLMResponseToPlans(response);

      expect(result[0].day_type).toBe("복습일");
    });

    it("should set week and day correctly", () => {
      const response = createMockLLMResponse();

      const result = transformLLMResponseToPlans(response);

      expect(result[0].week).toBe(1);
      expect(result[0].day).toBe(1); // Monday
    });

    it("should include content metadata", () => {
      const response = createMockLLMResponse();

      const result = transformLLMResponseToPlans(response);

      expect(result[0].content_title).toBe("수학의 정석");
      expect(result[0].content_subject).toBe("수학");
      expect(result[0].content_subject_category).toBe("수학");
    });
  });

  describe("plan_number calculation", () => {
    it("should assign unique plan_number to each plan", () => {
      const response = createMockLLMResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2026-01-05",
            weekEnd: "2026-01-11",
            days: [
              {
                date: "2026-01-05",
                dayOfWeek: 1,
                totalMinutes: 180,
                plans: [
                  {
                    date: "2026-01-05",
                    dayOfWeek: 1,
                    slotId: "slot-1",
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    subjectCategory: "수학",
                    rangeStart: 1,
                    rangeEnd: 20,
                    rangeDisplay: "p.1-20",
                    estimatedMinutes: 60,
                    isReview: false,
                    priority: "medium",
                  },
                  {
                    date: "2026-01-05",
                    dayOfWeek: 1,
                    slotId: "slot-2",
                    startTime: "10:30",
                    endTime: "11:30",
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
                  {
                    date: "2026-01-05",
                    dayOfWeek: 1,
                    slotId: "slot-3",
                    startTime: "14:00",
                    endTime: "15:00",
                    contentId: "content-3",
                    contentTitle: "과학",
                    subject: "과학",
                    subjectCategory: "과학",
                    rangeStart: 1,
                    rangeEnd: 15,
                    rangeDisplay: "p.1-15",
                    estimatedMinutes: 60,
                    isReview: false,
                    priority: "medium",
                  },
                ],
                dailySummary: "테스트",
              },
            ],
            weeklySummary: "테스트",
          },
        ],
        totalPlans: 3,
      });

      const result = transformLLMResponseToPlans(response);

      expect(result[0].plan_number).toBe(1);
      expect(result[1].plan_number).toBe(2);
      expect(result[2].plan_number).toBe(3);
    });
  });
});

// ============================================
// Helper Function Tests
// ============================================

describe("createEmptyTransformContext", () => {
  it("should return context with empty maps and arrays", () => {
    const context = createEmptyTransformContext();

    expect(context.contentTypeMap.size).toBe(0);
    expect(context.blockSets).toHaveLength(0);
    expect(context.allocationMap.size).toBe(0);
    expect(context.academySchedules).toHaveLength(0);
    expect(context.excludeDays).toHaveLength(0);
    expect(context.excludeDates).toHaveLength(0);
  });
});

describe("buildContentTypeMap", () => {
  it("should build map from content array", () => {
    const contents = [
      { id: "content-1", contentType: "book" as const },
      { id: "content-2", contentType: "lecture" as const },
      { id: "content-3", contentType: "custom" as const },
    ];

    const map = buildContentTypeMap(contents);

    expect(map.get("content-1")).toBe("book");
    expect(map.get("content-2")).toBe("lecture");
    expect(map.get("content-3")).toBe("custom");
  });

  it("should return empty map for empty input", () => {
    const map = buildContentTypeMap([]);

    expect(map.size).toBe(0);
  });
});

describe("buildAllocationMap", () => {
  it("should build map from allocation array", () => {
    const allocations = [
      { contentId: "content-1", subject: "수학", subject_type: "strategy" as const },
      { contentId: "content-2", subject: "영어", subject_type: "weakness" as const },
    ];

    const map = buildAllocationMap(allocations);

    expect(map.get("content-1")?.subject_type).toBe("strategy");
    expect(map.get("content-2")?.subject_type).toBe("weakness");
  });

  it("should return empty map for empty input", () => {
    const map = buildAllocationMap([]);

    expect(map.size).toBe(0);
  });
});

// ============================================
// Atomic Transaction Conversion Tests
// ============================================

describe("toAtomicPlanPayloads", () => {
  const mockTransformedPlan: TransformedPlanPayload = {
    plan_date: "2026-01-05",
    block_index: 0,
    content_type: "book",
    content_id: "content-1",
    planned_start_page_or_time: 1,
    planned_end_page_or_time: 20,
    chapter: null,
    start_time: "09:00",
    end_time: "10:00",
    day_type: "학습일",
    week: 1,
    day: 1,
    is_partial: false,
    is_continued: false,
    plan_number: 1,
    subject_type: "strategy",
    content_title: "수학의 정석",
    content_subject: "수학",
    content_subject_category: "수학",
    content_category: null,
  };

  it("should convert TransformedPlanPayload to AtomicPlanPayload", () => {
    const result = toAtomicPlanPayloads(
      [mockTransformedPlan],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result).toHaveLength(1);
    expect(result[0].plan_group_id).toBe("group-123");
    expect(result[0].student_id).toBe("student-456");
    expect(result[0].tenant_id).toBe("tenant-789");
  });

  it("should map all required fields correctly", () => {
    const result = toAtomicPlanPayloads(
      [mockTransformedPlan],
      "group-123",
      "student-456",
      "tenant-789"
    );

    const payload = result[0];
    expect(payload.plan_date).toBe("2026-01-05");
    expect(payload.block_index).toBe(0);
    expect(payload.status).toBe("pending");
    expect(payload.content_type).toBe("book");
    expect(payload.content_id).toBe("content-1");
    expect(payload.planned_start_page_or_time).toBe(1);
    expect(payload.planned_end_page_or_time).toBe(20);
    expect(payload.start_time).toBe("09:00");
    expect(payload.end_time).toBe("10:00");
    expect(payload.day_type).toBe("학습일");
    expect(payload.week).toBe(1);
    expect(payload.day).toBe(1);
    expect(payload.subject_type).toBe("strategy");
  });

  it("should set sequence based on array index", () => {
    const plans = [
      { ...mockTransformedPlan, content_id: "content-1" },
      { ...mockTransformedPlan, content_id: "content-2" },
      { ...mockTransformedPlan, content_id: "content-3" },
    ];

    const result = toAtomicPlanPayloads(
      plans,
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result[0].sequence).toBe(0);
    expect(result[1].sequence).toBe(1);
    expect(result[2].sequence).toBe(2);
  });

  it("should set is_virtual to false and is_active to true", () => {
    const result = toAtomicPlanPayloads(
      [mockTransformedPlan],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result[0].is_virtual).toBe(false);
    expect(result[0].is_active).toBe(true);
  });

  it("should handle empty plans array", () => {
    const result = toAtomicPlanPayloads(
      [],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result).toHaveLength(0);
  });
});

describe("batchPlanItemsToAtomicPayloads", () => {
  const mockPlanItem = {
    date: "2026-01-05",
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
  };

  it("should convert batch plan items to AtomicPlanPayloads", () => {
    const result = batchPlanItemsToAtomicPayloads(
      [mockPlanItem],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result).toHaveLength(1);
    expect(result[0].plan_group_id).toBe("group-123");
    expect(result[0].student_id).toBe("student-456");
    expect(result[0].tenant_id).toBe("tenant-789");
  });

  it("should map fields correctly from LLM plan item format", () => {
    const result = batchPlanItemsToAtomicPayloads(
      [mockPlanItem],
      "group-123",
      "student-456",
      "tenant-789"
    );

    const payload = result[0];
    expect(payload.plan_date).toBe("2026-01-05");
    expect(payload.start_time).toBe("09:00");
    expect(payload.end_time).toBe("10:00");
    expect(payload.content_id).toBe("content-1");
    expect(payload.content_title).toBe("수학의 정석");
    expect(payload.content_subject).toBe("수학");
    expect(payload.content_subject_category).toBe("수학");
    expect(payload.planned_start_page_or_time).toBe(1);
    expect(payload.planned_end_page_or_time).toBe(20);
  });

  it("should set day_type based on isReview flag", () => {
    const reviewPlan = { ...mockPlanItem, isReview: true };
    const studyPlan = { ...mockPlanItem, isReview: false };

    const reviewResult = batchPlanItemsToAtomicPayloads(
      [reviewPlan],
      "group-123",
      "student-456",
      "tenant-789"
    );
    const studyResult = batchPlanItemsToAtomicPayloads(
      [studyPlan],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(reviewResult[0].day_type).toBe("복습일");
    expect(studyResult[0].day_type).toBe("학습일");
  });

  it("should calculate day from date", () => {
    // 2026-01-05 is a Monday (day = 1)
    const result = batchPlanItemsToAtomicPayloads(
      [mockPlanItem],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result[0].day).toBe(1); // Monday
  });

  it("should use sequential block_index", () => {
    const plans = [
      { ...mockPlanItem, contentId: "content-1" },
      { ...mockPlanItem, contentId: "content-2" },
      { ...mockPlanItem, contentId: "content-3" },
    ];

    const result = batchPlanItemsToAtomicPayloads(
      plans,
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result[0].block_index).toBe(0);
    expect(result[1].block_index).toBe(1);
    expect(result[2].block_index).toBe(2);
  });

  it("should default content_type to book", () => {
    const result = batchPlanItemsToAtomicPayloads(
      [mockPlanItem],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result[0].content_type).toBe("book");
  });

  it("should set status to pending", () => {
    const result = batchPlanItemsToAtomicPayloads(
      [mockPlanItem],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result[0].status).toBe("pending");
  });

  it("should handle optional fields with defaults", () => {
    const minimalPlan = {
      date: "2026-01-05",
      startTime: "09:00",
      endTime: "10:00",
      contentId: "content-1",
      contentTitle: "테스트",
      subject: "수학",
      estimatedMinutes: 60,
    };

    const result = batchPlanItemsToAtomicPayloads(
      [minimalPlan],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result[0].planned_start_page_or_time).toBe(0);
    expect(result[0].planned_end_page_or_time).toBe(0);
    expect(result[0].content_subject_category).toBeNull();
  });

  it("should handle empty plans array", () => {
    const result = batchPlanItemsToAtomicPayloads(
      [],
      "group-123",
      "student-456",
      "tenant-789"
    );

    expect(result).toHaveLength(0);
  });
});
