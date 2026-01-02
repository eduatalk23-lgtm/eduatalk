/**
 * 응답 파서 테스트
 *
 * responseParser.ts의 파싱 및 검증 함수들을 검증합니다.
 *
 * @module __tests__/lib/plan/llm/responseParser.test
 */

import { describe, it, expect } from "vitest";
import {
  parseLLMResponse,
  toDBPlanData,
  toDBPlanDataList,
  validateQualityMetrics,
} from "@/lib/domains/plan/llm/transformers/responseParser";
import type {
  LLMPlanGenerationResponse,
  GeneratedPlanItem,
  WeeklyPlanMatrix,
  DailyPlanGroup,
  PlanGenerationSettings,
  SubjectScore,
} from "@/lib/domains/plan/llm/types";

// ============================================
// 테스트 데이터
// ============================================

const mockPlanItem: GeneratedPlanItem = {
  date: "2026-01-06",
  dayOfWeek: 1,
  slotId: "slot-1",
  startTime: "08:00",
  endTime: "08:50",
  contentId: "content-1",
  contentTitle: "수학의 정석",
  subject: "수학",
  subjectCategory: "수학 가형",
  rangeStart: 1,
  rangeEnd: 20,
  rangeDisplay: "p.1-20",
  estimatedMinutes: 50,
  isReview: false,
  notes: "오전 집중력 높을 때 취약 과목",
  priority: "high",
};

const mockDailyGroup: DailyPlanGroup = {
  date: "2026-01-06",
  dayOfWeek: 1,
  totalMinutes: 180,
  plans: [mockPlanItem],
  dailySummary: "수학 집중 학습일",
};

const mockWeeklyMatrix: WeeklyPlanMatrix = {
  weekNumber: 1,
  weekStart: "2026-01-06",
  weekEnd: "2026-01-12",
  days: [mockDailyGroup],
  weeklySummary: "수학 기초 개념 정리",
};

const mockResponse: LLMPlanGenerationResponse = {
  success: true,
  meta: {
    modelId: "claude-sonnet-4-20250514",
    confidence: 0.85,
    reasoning: "학생의 취약 과목인 수학을 오전에 배치",
    tokensUsed: { input: 1000, output: 500 },
    generatedAt: "2026-01-02T10:00:00Z",
    warnings: [],
  },
  weeklyMatrices: [mockWeeklyMatrix],
  totalPlans: 28,
  recommendations: {
    studyTips: ["수학은 오전에 집중 배치"],
    warnings: [],
    suggestedAdjustments: [],
    focusAreas: ["수학 기초 개념"],
  },
};

const mockSettings: PlanGenerationSettings = {
  startDate: "2026-01-06",
  endDate: "2026-01-19",
  dailyStudyMinutes: 180,
  prioritizeWeakSubjects: true,
  balanceSubjects: true,
  includeReview: true,
  reviewRatio: 0.2,
};

const mockScores: SubjectScore[] = [
  { subject: "수학", isWeak: true, grade: 3 },
  { subject: "영어", isWeak: false, grade: 2 },
  { subject: "국어", isWeak: true, grade: 4 },
];

// ============================================
// parseLLMResponse 테스트
// ============================================

describe("parseLLMResponse", () => {
  describe("기본 파싱", () => {
    it("유효한 JSON 응답을 파싱한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            weekStart: "2026-01-06",
            weekEnd: "2026-01-12",
            days: [
              {
                date: "2026-01-06",
                dayOfWeek: 1,
                totalMinutes: 180,
                plans: [
                  {
                    contentId: "content-1",
                    contentTitle: "수학의 정석",
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "08:50",
                    estimatedMinutes: 50,
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {
          studyTips: ["테스트 팁"],
          warnings: [],
        },
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.weeklyMatrices).toHaveLength(1);
      expect(result.response?.totalPlans).toBe(1);
    });

    it("마크다운 코드 블록으로 감싸진 JSON을 파싱한다", () => {
      const rawResponse = `\`\`\`json
{
  "weeklyMatrices": [{
    "weekNumber": 1,
    "days": [{
      "date": "2026-01-06",
      "plans": [{
        "contentId": "content-1",
        "subject": "수학",
        "startTime": "08:00",
        "endTime": "08:50"
      }]
    }]
  }],
  "totalPlans": 1,
  "recommendations": { "studyTips": [] }
}
\`\`\``;

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      expect(result.response?.weeklyMatrices).toHaveLength(1);
    });

    it("잘못된 JSON은 에러를 반환한다", () => {
      const rawResponse = "이것은 JSON이 아닙니다";

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("weeklyMatrices가 없으면 에러를 반환한다", () => {
      const rawResponse = JSON.stringify({
        totalPlans: 0,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("시간 정규화", () => {
    it("HH:mm 형식을 유지한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "09:30",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      const plan = result.response?.weeklyMatrices[0].days[0].plans[0];
      expect(plan?.startTime).toBe("08:00");
      expect(plan?.endTime).toBe("09:30");
    });

    it("H:mm 형식을 HH:mm으로 정규화한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                    startTime: "8:00",
                    endTime: "9:30",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      const plan = result.response?.weeklyMatrices[0].days[0].plans[0];
      expect(plan?.startTime).toBe("08:00");
      expect(plan?.endTime).toBe("09:30");
    });
  });

  describe("contentId 유효성 검증", () => {
    it("유효한 contentId를 포함한 플랜을 파싱한다", () => {
      const validContentIds = new Set(["content-1", "content-2"]);

      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "08:50",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 },
        validContentIds
      );

      expect(result.success).toBe(true);
      expect(result.response?.weeklyMatrices[0].days[0].plans).toHaveLength(1);
      expect(result.skippedPlans?.length ?? 0).toBe(0);
    });

    it("유효하지 않은 contentId는 스킵하고 기록한다", () => {
      const validContentIds = new Set(["content-1"]);

      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "08:50",
                  },
                  {
                    contentId: "invalid-content",
                    subject: "영어",
                    startTime: "09:00",
                    endTime: "09:50",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 2,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 },
        validContentIds
      );

      expect(result.success).toBe(true);
      expect(result.response?.weeklyMatrices[0].days[0].plans).toHaveLength(1);
      expect(result.skippedPlans).toHaveLength(1);
      expect(result.skippedPlans?.[0].reason).toContain("유효하지 않은 contentId");
    });
  });

  describe("필수 필드 검증", () => {
    it("contentId가 없으면 플랜을 스킵한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "08:50",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      expect(result.skippedPlans).toHaveLength(1);
      expect(result.skippedPlans?.[0].reason).toContain("contentId 누락");
    });

    it("startTime/endTime이 없으면 플랜을 스킵한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      expect(result.skippedPlans).toHaveLength(1);
      expect(result.skippedPlans?.[0].reason).toContain("시간");
    });
  });

  describe("우선순위 정규화", () => {
    it("유효한 우선순위를 유지한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "08:50",
                    priority: "high",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      expect(result.response?.weeklyMatrices[0].days[0].plans[0].priority).toBe("high");
    });

    it("잘못된 우선순위는 medium으로 정규화한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "08:50",
                    priority: "invalid",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.success).toBe(true);
      expect(result.response?.weeklyMatrices[0].days[0].plans[0].priority).toBe("medium");
    });
  });

  describe("메타데이터 생성", () => {
    it("모델 ID를 포함한다", () => {
      const rawResponse = JSON.stringify({
        weeklyMatrices: [
          {
            weekNumber: 1,
            days: [
              {
                date: "2026-01-06",
                plans: [
                  {
                    contentId: "content-1",
                    subject: "수학",
                    startTime: "08:00",
                    endTime: "08:50",
                  },
                ],
              },
            ],
          },
        ],
        totalPlans: 1,
        recommendations: {},
      });

      const result = parseLLMResponse(
        rawResponse,
        "claude-sonnet-4-20250514",
        { input_tokens: 1000, output_tokens: 500 }
      );

      expect(result.response?.meta.modelId).toBe("claude-sonnet-4-20250514");
    });
  });
});

// ============================================
// toDBPlanData 테스트
// ============================================

describe("toDBPlanData", () => {
  it("GeneratedPlanItem을 DB 형식으로 변환한다", () => {
    const dbData = toDBPlanData(mockPlanItem);

    expect(dbData.plan_date).toBe("2026-01-06");
    expect(dbData.content_id).toBe("content-1");
    expect(dbData.title).toBe("수학의 정석");
    expect(dbData.subject).toBe("수학");
    expect(dbData.subject_category).toBe("수학 가형");
    expect(dbData.start_time).toBe("08:00");
    expect(dbData.end_time).toBe("08:50");
    expect(dbData.range_start).toBe(1);
    expect(dbData.range_end).toBe(20);
    expect(dbData.range_display).toBe("p.1-20");
    expect(dbData.estimated_minutes).toBe(50);
    expect(dbData.is_review).toBe(false);
    expect(dbData.notes).toBe("오전 집중력 높을 때 취약 과목");
    expect(dbData.priority).toBe("high");
    expect(dbData.status).toBe("pending");
    expect(dbData.ai_generated).toBe(true);
  });

  it("선택적 필드가 없어도 동작한다", () => {
    const minimalPlan: GeneratedPlanItem = {
      date: "2026-01-06",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "08:50",
      contentId: "content-1",
      contentTitle: "수학의 정석",
      subject: "수학",
      estimatedMinutes: 50,
    };

    const dbData = toDBPlanData(minimalPlan);

    expect(dbData.plan_date).toBe("2026-01-06");
    // 선택적 필드는 undefined가 될 수 있음
    expect(dbData.subject_category).toBeUndefined();
    expect(dbData.range_start).toBeUndefined();
    expect(dbData.range_end).toBeUndefined();
    expect(dbData.range_display).toBeUndefined();
    expect(dbData.is_review).toBe(false);
    expect(dbData.notes).toBeUndefined();
  });
});

// ============================================
// toDBPlanDataList 테스트
// ============================================

describe("toDBPlanDataList", () => {
  it("LLMPlanGenerationResponse의 모든 플랜을 DB 형식으로 변환한다", () => {
    const dbDataList = toDBPlanDataList(mockResponse);

    expect(dbDataList).toHaveLength(1);
    expect(dbDataList[0].content_id).toBe("content-1");
  });

  it("여러 주의 여러 일의 플랜을 모두 변환한다", () => {
    const multiWeekResponse: LLMPlanGenerationResponse = {
      ...mockResponse,
      weeklyMatrices: [
        {
          weekNumber: 1,
          weekStart: "2026-01-06",
          weekEnd: "2026-01-12",
          days: [
            { ...mockDailyGroup, plans: [mockPlanItem, { ...mockPlanItem, contentId: "content-2" }] },
            { ...mockDailyGroup, date: "2026-01-07", plans: [mockPlanItem] },
          ],
        },
        {
          weekNumber: 2,
          weekStart: "2026-01-13",
          weekEnd: "2026-01-19",
          days: [{ ...mockDailyGroup, date: "2026-01-13", plans: [mockPlanItem] }],
        },
      ],
    };

    const dbDataList = toDBPlanDataList(multiWeekResponse);

    expect(dbDataList).toHaveLength(4);
  });
});

// ============================================
// validateQualityMetrics 테스트
// ============================================

describe("validateQualityMetrics", () => {
  describe("취약 과목 배치 검증", () => {
    it("취약 과목이 오전에 배치되면 경고가 없다", () => {
      const response: LLMPlanGenerationResponse = {
        ...mockResponse,
        weeklyMatrices: [
          {
            ...mockWeeklyMatrix,
            days: [
              {
                ...mockDailyGroup,
                plans: [
                  { ...mockPlanItem, subject: "수학", startTime: "08:00" }, // 취약 과목, 오전
                  { ...mockPlanItem, subject: "수학", startTime: "09:00" }, // 취약 과목, 오전
                  { ...mockPlanItem, subject: "영어", startTime: "14:00" }, // 비취약, 오후
                ],
              },
            ],
          },
        ],
      };

      const result = validateQualityMetrics(response, mockSettings, mockScores);

      const weakSubjectWarning = result.warnings.find(
        (w) => w.type === "weak_subject"
      );
      expect(weakSubjectWarning).toBeUndefined();
    });

    it("취약 과목이 오전에 배치되지 않으면 경고한다", () => {
      const response: LLMPlanGenerationResponse = {
        ...mockResponse,
        weeklyMatrices: [
          {
            ...mockWeeklyMatrix,
            days: [
              {
                ...mockDailyGroup,
                plans: [
                  { ...mockPlanItem, subject: "수학", startTime: "15:00" }, // 취약 과목, 오후
                  { ...mockPlanItem, subject: "수학", startTime: "16:00" }, // 취약 과목, 오후
                  { ...mockPlanItem, subject: "영어", startTime: "08:00" }, // 비취약, 오전
                  { ...mockPlanItem, subject: "영어", startTime: "09:00" }, // 비취약, 오전
                  { ...mockPlanItem, subject: "영어", startTime: "10:00" }, // 비취약, 오전
                ],
              },
            ],
          },
        ],
      };

      const settingsWithWeak = { ...mockSettings, prioritizeWeakSubjects: true };
      const result = validateQualityMetrics(response, settingsWithWeak, mockScores);

      // 취약 과목의 오전 배치 비율이 낮으면 경고
      expect(result.metrics.weakSubjectRatio).toBeLessThan(0.3);
    });
  });

  describe("복습 비율 검증", () => {
    it("복습 비율이 설정값과 맞으면 경고가 없다", () => {
      const response: LLMPlanGenerationResponse = {
        ...mockResponse,
        weeklyMatrices: [
          {
            ...mockWeeklyMatrix,
            days: [
              {
                ...mockDailyGroup,
                plans: [
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: true }, // 20% 복습
                ],
              },
            ],
          },
        ],
      };

      const settingsWithReview = {
        ...mockSettings,
        includeReview: true,
        reviewRatio: 0.2,
      };

      const result = validateQualityMetrics(response, settingsWithReview, mockScores);

      // 20% 복습 비율이므로 reviewRatio가 0.2에 가까워야 함
      expect(result.metrics.reviewRatio).toBeCloseTo(0.2, 1);
    });

    it("복습 비율이 설정값과 많이 다르면 경고한다", () => {
      const response: LLMPlanGenerationResponse = {
        ...mockResponse,
        weeklyMatrices: [
          {
            ...mockWeeklyMatrix,
            days: [
              {
                ...mockDailyGroup,
                plans: [
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false }, // 0% 복습
                ],
              },
            ],
          },
        ],
      };

      const settingsWithReview = {
        ...mockSettings,
        includeReview: true,
        reviewRatio: 0.3, // 30% 기대
      };

      const result = validateQualityMetrics(response, settingsWithReview, mockScores);

      const reviewWarning = result.warnings.find((w) => w.type === "review_ratio");
      expect(reviewWarning).toBeDefined();
      expect(reviewWarning?.expected).toBe(30);
      expect(reviewWarning?.actual).toBe(0);
    });
  });

  describe("과목 균형 검증", () => {
    it("과목별 분포를 계산한다", () => {
      const response: LLMPlanGenerationResponse = {
        ...mockResponse,
        weeklyMatrices: [
          {
            ...mockWeeklyMatrix,
            days: [
              {
                ...mockDailyGroup,
                plans: [
                  { ...mockPlanItem, subject: "수학", estimatedMinutes: 60 },
                  { ...mockPlanItem, subject: "영어", estimatedMinutes: 30 },
                  { ...mockPlanItem, subject: "국어", estimatedMinutes: 30 },
                ],
              },
            ],
          },
        ],
      };

      const result = validateQualityMetrics(response, mockSettings, mockScores);

      expect(result.metrics.subjectDistribution?.["수학"]).toBe(60);
      expect(result.metrics.subjectDistribution?.["영어"]).toBe(30);
      expect(result.metrics.subjectDistribution?.["국어"]).toBe(30);
    });
  });

  describe("유효성 판정", () => {
    it("경고가 없으면 isValid는 true", () => {
      const response: LLMPlanGenerationResponse = {
        ...mockResponse,
        weeklyMatrices: [
          {
            ...mockWeeklyMatrix,
            days: [
              {
                ...mockDailyGroup,
                plans: [
                  { ...mockPlanItem, subject: "수학", startTime: "08:00", isReview: false },
                  { ...mockPlanItem, subject: "수학", startTime: "09:00", isReview: true },
                ],
              },
            ],
          },
        ],
      };

      const settingsWithReview = {
        ...mockSettings,
        includeReview: true,
        reviewRatio: 0.5,
        prioritizeWeakSubjects: true,
      };

      const result = validateQualityMetrics(response, settingsWithReview, mockScores);

      // 50% 복습, 취약 과목 오전 배치
      expect(result.isValid).toBe(true);
    });

    it("경고가 있으면 isValid는 false", () => {
      const response: LLMPlanGenerationResponse = {
        ...mockResponse,
        weeklyMatrices: [
          {
            ...mockWeeklyMatrix,
            days: [
              {
                ...mockDailyGroup,
                plans: [
                  { ...mockPlanItem, isReview: false },
                  { ...mockPlanItem, isReview: false },
                ],
              },
            ],
          },
        ],
      };

      const settingsWithReview = {
        ...mockSettings,
        includeReview: true,
        reviewRatio: 0.5, // 50% 기대하지만 0%
      };

      const result = validateQualityMetrics(response, settingsWithReview, mockScores);

      expect(result.isValid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
