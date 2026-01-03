/**
 * AI 플랜 생성 액션 테스트
 *
 * transformLLMResponseToPlans 함수 및 관련 로직을 테스트합니다.
 *
 * @module __tests__/lib/domains/admin-plan/aiPlanGeneration.test
 */

import { describe, it, expect } from "vitest";
import { transformLLMResponseToPlans } from "@/lib/domains/admin-plan/actions/aiPlanGeneration";
import type { LLMPlanGenerationResponse } from "@/lib/domains/plan/llm";

describe("transformLLMResponseToPlans", () => {
  const createMockResponse = (
    overrides: Partial<LLMPlanGenerationResponse> = {}
  ): LLMPlanGenerationResponse => ({
    success: true,
    meta: {
      modelId: "claude-3-5-haiku-20241022",
      confidence: 0.9,
      reasoning: "테스트 추론",
      tokensUsed: { input: 100, output: 200 },
      generatedAt: "2024-01-15T09:00:00Z",
    },
    weeklyMatrices: [],
    totalPlans: 0,
    recommendations: {
      studyTips: [],
      warnings: [],
    },
    ...overrides,
  });

  describe("기본 변환", () => {
    it("빈 응답에서 빈 배열을 반환해야 함", () => {
      const response = createMockResponse({ weeklyMatrices: [] });
      const plans = transformLLMResponseToPlans(response);
      expect(plans).toEqual([]);
    });

    it("단일 플랜을 올바르게 변환해야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-123",
                    contentTitle: "수학의 정석",
                    subject: "수학",
                    subjectCategory: "수학",
                    rangeStart: 1,
                    rangeEnd: 20,
                    estimatedMinutes: 60,
                    isReview: false,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({
        plan_date: "2024-01-15",
        block_index: 0,
        content_type: "book",
        content_id: "content-123",
        planned_start_page_or_time: 1,
        planned_end_page_or_time: 20,
        start_time: "09:00",
        end_time: "10:00",
        day_type: "학습일",
        week: 1,
        day: 1,
        content_title: "수학의 정석",
        content_subject: "수학",
        content_subject_category: "수학",
      });
    });

    it("복습 플랜의 day_type을 복습일로 설정해야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-123",
                    contentTitle: "수학의 정석",
                    subject: "수학",
                    estimatedMinutes: 60,
                    isReview: true, // 복습
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans[0].day_type).toBe("복습일");
    });
  });

  describe("여러 플랜 처리", () => {
    it("여러 날짜의 플랜을 올바르게 변환해야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    estimatedMinutes: 60,
                  },
                ],
              },
              {
                date: "2024-01-16",
                dayOfWeek: 2,
                totalMinutes: 90,
                plans: [
                  {
                    date: "2024-01-16",
                    dayOfWeek: 2,
                    startTime: "09:00",
                    endTime: "10:30",
                    contentId: "content-2",
                    contentTitle: "영어",
                    subject: "영어",
                    estimatedMinutes: 90,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 2,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans).toHaveLength(2);
      expect(plans[0].plan_date).toBe("2024-01-15");
      expect(plans[0].content_id).toBe("content-1");
      expect(plans[1].plan_date).toBe("2024-01-16");
      expect(plans[1].content_id).toBe("content-2");
    });

    it("하루에 여러 플랜이 있을 때 block_index가 증가해야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 180,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    estimatedMinutes: 60,
                  },
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "10:00",
                    endTime: "11:00",
                    contentId: "content-2",
                    contentTitle: "영어",
                    subject: "영어",
                    estimatedMinutes: 60,
                  },
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "11:00",
                    endTime: "12:00",
                    contentId: "content-3",
                    contentTitle: "국어",
                    subject: "국어",
                    estimatedMinutes: 60,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 3,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans).toHaveLength(3);
      expect(plans[0].block_index).toBe(0);
      expect(plans[1].block_index).toBe(1);
      expect(plans[2].block_index).toBe(2);
    });
  });

  describe("plan_number 계산", () => {
    it("서로 다른 플랜에 고유한 plan_number가 부여되어야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 120,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    rangeStart: 1,
                    rangeEnd: 20,
                    estimatedMinutes: 60,
                  },
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "10:00",
                    endTime: "11:00",
                    contentId: "content-2",
                    contentTitle: "영어",
                    subject: "영어",
                    rangeStart: 1,
                    rangeEnd: 10,
                    estimatedMinutes: 60,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 2,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans[0].plan_number).toBe(1);
      expect(plans[1].plan_number).toBe(2);
    });

    it("동일한 날짜+콘텐츠+범위는 같은 plan_number를 가져야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 120,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "09:30",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    rangeStart: 1,
                    rangeEnd: 20,
                    estimatedMinutes: 30,
                  },
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:30",
                    endTime: "10:00",
                    contentId: "content-1", // 같은 콘텐츠
                    contentTitle: "수학",
                    subject: "수학",
                    rangeStart: 1, // 같은 범위
                    rangeEnd: 20,
                    estimatedMinutes: 30,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 2,
      });

      const plans = transformLLMResponseToPlans(response);

      // 동일한 키(날짜+콘텐츠+범위)는 같은 plan_number
      expect(plans[0].plan_number).toBe(1);
      expect(plans[1].plan_number).toBe(1);
    });
  });

  describe("여러 주 처리", () => {
    it("여러 주간 매트릭스를 올바르게 처리해야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    estimatedMinutes: 60,
                  },
                ],
              },
            ],
          },
          {
            weekNumber: 2,
            weekStart: "2024-01-22",
            weekEnd: "2024-01-28",
            days: [
              {
                date: "2024-01-22",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-22",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-2",
                    contentTitle: "영어",
                    subject: "영어",
                    estimatedMinutes: 60,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 2,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans).toHaveLength(2);
      expect(plans[0].week).toBe(1);
      expect(plans[0].plan_date).toBe("2024-01-15");
      expect(plans[1].week).toBe(2);
      expect(plans[1].plan_date).toBe("2024-01-22");
    });
  });

  describe("선택적 필드 처리", () => {
    it("rangeStart/rangeEnd가 없으면 0으로 설정해야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "강의",
                    subject: "수학",
                    estimatedMinutes: 60,
                    // rangeStart, rangeEnd 없음
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans[0].planned_start_page_or_time).toBe(0);
      expect(plans[0].planned_end_page_or_time).toBe(0);
    });

    it("subjectCategory가 없으면 null로 설정해야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    estimatedMinutes: 60,
                    // subjectCategory 없음
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans[0].content_subject_category).toBeNull();
    });
  });

  describe("기본값 설정", () => {
    it("is_partial, is_continued는 항상 false여야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    estimatedMinutes: 60,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans[0].is_partial).toBe(false);
      expect(plans[0].is_continued).toBe(false);
    });

    it("chapter, subject_type, content_category는 null이어야 함", () => {
      const response = createMockResponse({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2024-01-15",
            weekEnd: "2024-01-21",
            days: [
              {
                date: "2024-01-15",
                dayOfWeek: 1,
                totalMinutes: 60,
                plans: [
                  {
                    date: "2024-01-15",
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "10:00",
                    contentId: "content-1",
                    contentTitle: "수학",
                    subject: "수학",
                    estimatedMinutes: 60,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
      });

      const plans = transformLLMResponseToPlans(response);

      expect(plans[0].chapter).toBeNull();
      expect(plans[0].subject_type).toBeNull();
      expect(plans[0].content_category).toBeNull();
    });
  });
});
