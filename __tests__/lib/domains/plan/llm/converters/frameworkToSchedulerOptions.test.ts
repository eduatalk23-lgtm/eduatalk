/**
 * AIFramework → SchedulerOptions 변환기 테스트
 *
 * @module __tests__/lib/domains/plan/llm/converters/frameworkToSchedulerOptions.test
 */

import { describe, it, expect } from "vitest";
import {
  convertFrameworkToSchedulerOptions,
  isCompatibleFrameworkVersion,
  isHighConfidenceFramework,
  calculateAverageConfidence,
  extractWeaknessSubjects,
  extractStrategySubjects,
  getOptimalTimeSlot,
  getRecommendedDuration,
} from "@/lib/domains/plan/llm/converters/frameworkToSchedulerOptions";
import type {
  AIFramework,
  SubjectClassification,
  ContentPriority,
} from "@/lib/domains/plan/llm/types/aiFramework";

// ============================================
// 테스트 헬퍼
// ============================================

function createMockFramework(
  overrides: Partial<AIFramework> = {}
): AIFramework {
  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    strategySummary: "테스트 전략 요약",
    subjectClassifications: [],
    weeklyStrategies: [],
    timeHints: [],
    contentPriority: [],
    recommendations: {
      studyTips: [],
      warnings: [],
      suggestedAdjustments: [],
      focusAreas: [],
    },
    meta: {
      modelId: "claude-3-5-sonnet-20241022",
      tokensUsed: { input: 1000, output: 500 },
      confidence: 0.85,
      processingTimeMs: 2500,
    },
    ...overrides,
  };
}

function createMockSubjectClassification(
  overrides: Partial<SubjectClassification> = {}
): SubjectClassification {
  return {
    subjectCategory: "수학",
    classification: "weakness",
    confidence: 0.9,
    reasoning: "성적 분석 기반",
    recommendedWeeklyDays: 4,
    priorityRank: 1,
    ...overrides,
  };
}

function createMockContentPriority(
  overrides: Partial<ContentPriority> = {}
): ContentPriority {
  return {
    contentId: "content-1",
    priorityRank: 1,
    subjectType: "weakness",
    orderInSubject: 1,
    urgency: "high",
    reasoning: "시험 대비",
    ...overrides,
  };
}

// ============================================
// 메인 변환 함수 테스트
// ============================================

describe("convertFrameworkToSchedulerOptions", () => {
  describe("weak_subject_focus 계산", () => {
    it("취약 과목 비율이 50% 이상이면 high 반환", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            classification: "weakness",
          }),
          createMockSubjectClassification({
            subjectCategory: "영어",
            classification: "weakness",
          }),
          createMockSubjectClassification({
            subjectCategory: "국어",
            classification: "strategy",
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.weak_subject_focus).toBe("high");
    });

    it("취약 과목 비율이 25-50%이면 medium 반환", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            classification: "weakness",
            priorityRank: 3, // 중간 우선순위 (high 트리거 방지)
          }),
          createMockSubjectClassification({
            subjectCategory: "영어",
            classification: "strategy",
            priorityRank: 2,
          }),
          createMockSubjectClassification({
            subjectCategory: "국어",
            classification: "strategy",
            priorityRank: 4,
          }),
          createMockSubjectClassification({
            subjectCategory: "과학",
            classification: "neutral",
            priorityRank: 5,
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.weak_subject_focus).toBe("medium");
    });

    it("취약 과목 비율이 25% 미만이면 low 반환", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            classification: "strategy",
          }),
          createMockSubjectClassification({
            subjectCategory: "영어",
            classification: "strategy",
          }),
          createMockSubjectClassification({
            subjectCategory: "국어",
            classification: "strategy",
          }),
          createMockSubjectClassification({
            subjectCategory: "과학",
            classification: "strategy",
          }),
          createMockSubjectClassification({
            subjectCategory: "사회",
            classification: "weakness",
            priorityRank: 5,
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.weak_subject_focus).toBe("low");
    });

    it("취약 과목의 평균 우선순위가 높으면 high 반환", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            classification: "weakness",
            priorityRank: 1, // 매우 높은 우선순위
          }),
          createMockSubjectClassification({
            subjectCategory: "영어",
            classification: "strategy",
            priorityRank: 5,
          }),
          createMockSubjectClassification({
            subjectCategory: "국어",
            classification: "strategy",
            priorityRank: 6,
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.weak_subject_focus).toBe("high");
    });

    it("분류가 없으면 medium 기본값 반환", () => {
      const framework = createMockFramework({
        subjectClassifications: [],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.weak_subject_focus).toBe("medium");
    });
  });

  describe("subject_allocations 변환", () => {
    it("과목 분류를 올바르게 변환", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            subjectId: "math-001",
            classification: "weakness",
            recommendedWeeklyDays: 5,
          }),
          createMockSubjectClassification({
            subjectCategory: "영어",
            subjectId: "eng-001",
            classification: "strategy",
            recommendedWeeklyDays: 3,
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      const { subject_allocations } = result.schedulerOptions;

      expect(subject_allocations).toHaveLength(2);

      // weakness가 먼저 정렬됨
      expect(subject_allocations[0]).toEqual({
        subject_id: "math-001",
        subject_name: "수학",
        subject_type: "weakness",
        weekly_days: 5,
      });

      expect(subject_allocations[1]).toEqual({
        subject_id: "eng-001",
        subject_name: "영어",
        subject_type: "strategy",
        weekly_days: 3,
      });
    });

    it("neutral 분류는 제외", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            classification: "weakness",
          }),
          createMockSubjectClassification({
            subjectCategory: "체육",
            classification: "neutral",
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.subject_allocations).toHaveLength(1);
      expect(result.schedulerOptions.subject_allocations[0].subject_name).toBe(
        "수학"
      );
    });

    it("subjectId가 없으면 카테고리에서 ID 생성", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "한국사",
            subjectId: undefined,
            classification: "strategy",
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.subject_allocations[0].subject_id).toBe(
        "subject_한국사"
      );
    });
  });

  describe("content_allocations 변환", () => {
    it("콘텐츠 매핑이 없으면 undefined 반환", () => {
      const framework = createMockFramework({
        contentPriority: [
          createMockContentPriority({ contentId: "c1" }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.content_allocations).toBeUndefined();
    });

    it("콘텐츠 매핑이 있으면 올바르게 변환", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            classification: "weakness",
            recommendedWeeklyDays: 4,
          }),
        ],
        contentPriority: [
          createMockContentPriority({
            contentId: "content-1",
            subjectType: "weakness",
            urgency: "high",
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework, {
        contentMappings: [
          {
            contentId: "content-1",
            subjectCategory: "수학",
            contentType: "lecture",
          },
        ],
      });

      expect(result.schedulerOptions.content_allocations).toHaveLength(1);
      expect(result.schedulerOptions.content_allocations![0]).toEqual({
        content_id: "content-1",
        content_type: "lecture",
        subject_type: "weakness",
        weekly_days: 5, // high urgency: base(4) + 1
      });
    });

    it("urgency에 따라 weekly_days 조정", () => {
      const framework = createMockFramework({
        subjectClassifications: [
          createMockSubjectClassification({
            subjectCategory: "수학",
            classification: "weakness",
            recommendedWeeklyDays: 3,
          }),
        ],
        contentPriority: [
          createMockContentPriority({
            contentId: "c1",
            urgency: "critical",
          }),
          createMockContentPriority({
            contentId: "c2",
            urgency: "low",
          }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework, {
        contentMappings: [
          { contentId: "c1", subjectCategory: "수학", contentType: "book" },
          { contentId: "c2", subjectCategory: "수학", contentType: "book" },
        ],
      });

      const allocations = result.schedulerOptions.content_allocations!;
      expect(allocations.find((a) => a.content_id === "c1")?.weekly_days).toBe(
        5
      ); // critical: +2
      expect(allocations.find((a) => a.content_id === "c2")?.weekly_days).toBe(
        2
      ); // low: -1
    });
  });

  describe("study_days / review_days 계산", () => {
    it("주별 전략에서 학습일/복습일 추출", () => {
      const framework = createMockFramework({
        weeklyStrategies: [
          {
            weekNumber: 1,
            theme: "기초 다지기",
            goals: ["목표1"],
            dailyStrategies: [
              {
                dayOfWeek: 1,
                focusType: "intensive",
                primarySubjects: [],
                secondarySubjects: [],
                strategyDescription: "",
                recommendedMinutes: 120,
              },
              {
                dayOfWeek: 2,
                focusType: "balanced",
                primarySubjects: [],
                secondarySubjects: [],
                strategyDescription: "",
                recommendedMinutes: 100,
              },
              {
                dayOfWeek: 3,
                focusType: "light",
                primarySubjects: [],
                secondarySubjects: [],
                strategyDescription: "",
                recommendedMinutes: 60,
              },
              {
                dayOfWeek: 4,
                focusType: "intensive",
                primarySubjects: [],
                secondarySubjects: [],
                strategyDescription: "",
                recommendedMinutes: 120,
              },
              {
                dayOfWeek: 5,
                focusType: "balanced",
                primarySubjects: [],
                secondarySubjects: [],
                strategyDescription: "",
                recommendedMinutes: 100,
              },
              {
                dayOfWeek: 6,
                focusType: "review",
                primarySubjects: [],
                secondarySubjects: [],
                strategyDescription: "",
                recommendedMinutes: 90,
              },
            ],
          },
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.schedulerOptions.study_days).toBe(5); // intensive, balanced, light
      expect(result.schedulerOptions.review_days).toBe(1); // review
    });

    it("주별 전략이 없으면 기본값 사용", () => {
      const framework = createMockFramework({
        weeklyStrategies: [],
      });

      const result = convertFrameworkToSchedulerOptions(framework, {
        defaultStudyDays: 5,
        defaultReviewDays: 2,
      });

      expect(result.schedulerOptions.study_days).toBe(5);
      expect(result.schedulerOptions.review_days).toBe(2);
    });
  });

  describe("contentOrdering 맵 생성", () => {
    it("priorityRank 순으로 콘텐츠 정렬 순서 생성", () => {
      const framework = createMockFramework({
        contentPriority: [
          createMockContentPriority({ contentId: "c3", priorityRank: 3 }),
          createMockContentPriority({ contentId: "c1", priorityRank: 1 }),
          createMockContentPriority({ contentId: "c2", priorityRank: 2 }),
        ],
      });

      const result = convertFrameworkToSchedulerOptions(framework);
      const { contentOrdering } = result;

      expect(contentOrdering.get("c1")).toBe(0);
      expect(contentOrdering.get("c2")).toBe(1);
      expect(contentOrdering.get("c3")).toBe(2);
    });
  });

  describe("aiRecommendations 전달", () => {
    it("프레임워크의 추천사항을 그대로 전달", () => {
      const recommendations = {
        studyTips: ["아침 시간 활용", "복습 주기 준수"],
        warnings: ["수면 부족 주의"],
        suggestedAdjustments: ["주말 학습량 조정"],
        focusAreas: ["수학 기초"],
        motivationalNotes: ["화이팅!"],
      };

      const framework = createMockFramework({ recommendations });

      const result = convertFrameworkToSchedulerOptions(framework);
      expect(result.aiRecommendations).toEqual(recommendations);
    });
  });
});

// ============================================
// 유틸리티 함수 테스트
// ============================================

describe("isCompatibleFrameworkVersion", () => {
  it("버전 1.0이면 true 반환", () => {
    const framework = createMockFramework({ version: "1.0" });
    expect(isCompatibleFrameworkVersion(framework)).toBe(true);
  });

  it("다른 버전이면 false 반환", () => {
    const framework = createMockFramework({
      version: "2.0" as "1.0",
    });
    expect(isCompatibleFrameworkVersion(framework)).toBe(false);
  });
});

describe("isHighConfidenceFramework", () => {
  it("기본 임계값(0.7) 이상이면 true 반환", () => {
    const framework = createMockFramework({
      meta: {
        modelId: "test",
        tokensUsed: { input: 100, output: 50 },
        confidence: 0.85,
        processingTimeMs: 1000,
      },
    });
    expect(isHighConfidenceFramework(framework)).toBe(true);
  });

  it("커스텀 임계값 지원", () => {
    const framework = createMockFramework({
      meta: {
        modelId: "test",
        tokensUsed: { input: 100, output: 50 },
        confidence: 0.75,
        processingTimeMs: 1000,
      },
    });
    expect(isHighConfidenceFramework(framework, 0.8)).toBe(false);
    expect(isHighConfidenceFramework(framework, 0.7)).toBe(true);
  });
});

describe("calculateAverageConfidence", () => {
  it("과목 분류의 평균 신뢰도 계산", () => {
    const classifications = [
      createMockSubjectClassification({ confidence: 0.9 }),
      createMockSubjectClassification({ confidence: 0.8 }),
      createMockSubjectClassification({ confidence: 0.7 }),
    ];

    expect(calculateAverageConfidence(classifications)).toBeCloseTo(0.8, 2);
  });

  it("빈 배열이면 0 반환", () => {
    expect(calculateAverageConfidence([])).toBe(0);
  });
});

describe("extractWeaknessSubjects", () => {
  it("취약 과목만 추출하고 우선순위로 정렬", () => {
    const classifications = [
      createMockSubjectClassification({
        subjectCategory: "수학",
        classification: "weakness",
        priorityRank: 2,
      }),
      createMockSubjectClassification({
        subjectCategory: "영어",
        classification: "strategy",
        priorityRank: 1,
      }),
      createMockSubjectClassification({
        subjectCategory: "국어",
        classification: "weakness",
        priorityRank: 1,
      }),
    ];

    const result = extractWeaknessSubjects(classifications);
    expect(result).toHaveLength(2);
    expect(result[0].subjectCategory).toBe("국어"); // priorityRank 1
    expect(result[1].subjectCategory).toBe("수학"); // priorityRank 2
  });
});

describe("extractStrategySubjects", () => {
  it("전략 과목만 추출하고 우선순위로 정렬", () => {
    const classifications = [
      createMockSubjectClassification({
        subjectCategory: "수학",
        classification: "strategy",
        priorityRank: 3,
      }),
      createMockSubjectClassification({
        subjectCategory: "영어",
        classification: "weakness",
        priorityRank: 1,
      }),
      createMockSubjectClassification({
        subjectCategory: "국어",
        classification: "strategy",
        priorityRank: 2,
      }),
    ];

    const result = extractStrategySubjects(classifications);
    expect(result).toHaveLength(2);
    expect(result[0].subjectCategory).toBe("국어"); // priorityRank 2
    expect(result[1].subjectCategory).toBe("수학"); // priorityRank 3
  });
});

describe("getOptimalTimeSlot", () => {
  it("과목의 최적 시간대 반환", () => {
    const framework = createMockFramework({
      timeHints: [
        {
          subjectCategory: "수학",
          preferredTimeSlot: "morning",
          optimalDurationMinutes: 60,
          minDurationMinutes: 30,
          maxDurationMinutes: 90,
          reasoning: "아침에 집중력 높음",
        },
        {
          subjectCategory: "영어",
          preferredTimeSlot: "evening",
          optimalDurationMinutes: 45,
          minDurationMinutes: 20,
          maxDurationMinutes: 60,
          reasoning: "저녁에 어휘 암기 효율적",
        },
      ],
    });

    expect(getOptimalTimeSlot(framework, "수학")).toBe("morning");
    expect(getOptimalTimeSlot(framework, "영어")).toBe("evening");
    expect(getOptimalTimeSlot(framework, "국어")).toBeNull();
  });
});

describe("getRecommendedDuration", () => {
  it("과목의 권장 학습 시간 반환", () => {
    const framework = createMockFramework({
      timeHints: [
        {
          subjectCategory: "수학",
          preferredTimeSlot: "morning",
          optimalDurationMinutes: 60,
          minDurationMinutes: 30,
          maxDurationMinutes: 90,
          reasoning: "집중력 고려",
        },
      ],
    });

    const result = getRecommendedDuration(framework, "수학");
    expect(result).toEqual({
      optimal: 60,
      min: 30,
      max: 90,
    });
  });

  it("해당 과목이 없으면 null 반환", () => {
    const framework = createMockFramework({ timeHints: [] });
    expect(getRecommendedDuration(framework, "수학")).toBeNull();
  });
});
