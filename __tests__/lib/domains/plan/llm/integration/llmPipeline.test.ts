/**
 * LLM Pipeline Integration Tests
 *
 * Phase 6.3: 통합 테스트 스위트
 *
 * 이 테스트는 LLM 플랜 생성 파이프라인의 전체 흐름을 테스트합니다:
 * 1. 요청 빌드 (requestBuilder)
 * 2. LLM 응답 파싱 (responseParser)
 * 3. 플랜 검증 (planValidator + enhancedPlanValidator)
 * 4. 추천 검증 (contentRecommendation + enhancedContentRecommendation)
 *
 * @module integration/llmPipeline
 */

import { describe, it, expect } from "vitest";

// Request Builder
import {
  buildLLMRequest,
  buildExtendedLLMRequest,
  validateRequest,
  calculateDaysInRange,
  transformBlocks,
  transformAcademySchedules,
  transformSubjectAllocations,
  type BuildRequestOptions,
} from "@/lib/domains/plan/llm/transformers/requestBuilder";

// Response Parser
import {
  parseLLMResponse,
  toDBPlanData,
  toDBPlanDataList,
  validateQualityMetrics,
} from "@/lib/domains/plan/llm/transformers/responseParser";

// Plan Validator (Phase 3)
import {
  validatePlans,
  validateAcademyConflicts,
  validateExcludedDates,
  validateDailyStudyMinutes,
  validateBlockCompatibility,
  validateTimeFormats,
} from "@/lib/domains/plan/llm/validators/planValidator";

// Enhanced Plan Validator (Phase 6)
import {
  validatePlansEnhanced,
  validateContentRanges,
  validateRangeContinuity,
  validateSubjectBalance,
  validateConsecutiveSubjects,
  validateLearningGaps,
  validateContentDuplicates,
  validateDailyLoad,
  getQualityGrade,
} from "@/lib/domains/plan/llm/validators/enhancedPlanValidator";

// Enhanced Content Recommendation (Phase 6)
import {
  buildEnhancedContentRecommendationPrompt,
  validateEnhancedRecommendationResponse,
  estimateEnhancedRecommendationTokens,
  calculateDaysUntilExam,
  estimateCompletionDays,
  determineDifficultyLevel,
} from "@/lib/domains/plan/llm/prompts/enhancedContentRecommendation";

// Types
import type { GeneratedPlanItem, ContentInfo, LLMPlanGenerationRequest } from "@/lib/domains/plan/llm/types";
import type {
  AcademyScheduleForPrompt,
  BlockInfoForPrompt,
} from "@/lib/domains/plan/llm/transformers/requestBuilder";
import type {
  EnhancedContentRecommendationRequest,
  EnhancedRecommendedContent,
} from "@/lib/domains/plan/llm/prompts/enhancedContentRecommendation";
import type { ContentMetadata } from "@/lib/domains/plan/llm/validators/enhancedPlanValidator";

// Test helpers
import {
  createMockPlan,
  createMockAcademySchedule,
  createMockBlock,
  createMockLLMResponse,
  createMockPlanWithRequiredFields,
  TestScenarios,
} from "../__mocks__/planValidation";

// ============================================
// Test Data Factories
// ============================================

function createMockRequestOptions(
  overrides: Partial<BuildRequestOptions> = {}
): BuildRequestOptions {
  return {
    student: {
      id: "student-1",
      name: "테스트 학생",
      grade: 2,
      school_name: "테스트 고등학교",
    },
    contents: [
      {
        id: "content-1",
        title: "수학의 정석",
        subject: "수학",
        subject_category: "수학",
        content_type: "book",
        total_pages: 500,
        difficulty: "medium",
      },
      {
        id: "content-2",
        title: "영어 완성",
        subject: "영어",
        subject_category: "영어",
        content_type: "book",
        total_pages: 300,
        difficulty: "medium",
      },
    ],
    settings: {
      startDate: "2026-01-06",
      endDate: "2026-01-19",
      dailyStudyMinutes: 180,
      breakIntervalMinutes: 60,
      breakDurationMinutes: 10,
      excludeDays: [0, 6],
    },
    ...overrides,
  };
}

function createMockContentMetadataArray(): ContentMetadata[] {
  return [
    {
      id: "content-1",
      title: "수학의 정석",
      subject: "수학",
      contentType: "book",
      totalRange: 500,
    },
    {
      id: "content-2",
      title: "영어 완성",
      subject: "영어",
      contentType: "book",
      totalRange: 300,
    },
  ];
}

function createMockEnhancedRecommendationRequest(
  overrides: Partial<EnhancedContentRecommendationRequest> = {}
): EnhancedContentRecommendationRequest {
  return {
    student: {
      id: "student-1",
      name: "테스트 학생",
      grade: 2,
    },
    scores: [
      {
        subjectId: "subj-1",
        subject: "수학",
        subjectCategory: "수학",
        latestGrade: 3,
        latestPercentile: 70,
        isWeak: false,
      },
      {
        subjectId: "subj-2",
        subject: "영어",
        subjectCategory: "영어",
        latestGrade: 4,
        latestPercentile: 45,
        isWeak: true,
      },
    ],
    ownedContents: [
      {
        id: "owned-1",
        title: "기존 수학 교재",
        subject: "수학",
        subjectCategory: "수학",
        contentType: "book",
        completedPercentage: 80,
      },
    ],
    candidateContents: [
      {
        id: "candidate-1",
        title: "수능 영어 완성",
        subject: "영어",
        subjectCategory: "영어",
        contentType: "book",
        difficulty: "medium",
        totalPages: 300,
      },
      {
        id: "candidate-2",
        title: "수학 심화",
        subject: "수학",
        subjectCategory: "수학",
        contentType: "book",
        difficulty: "hard",
        totalPages: 400,
      },
    ],
    maxRecommendations: 5,
    includeSynergy: true,
    applyDifficultyProgression: true,
    ...overrides,
  };
}

// ============================================
// Integration Test: Request Building Pipeline
// ============================================

describe("Integration: Request Building Pipeline", () => {
  describe("buildLLMRequest → validateRequest", () => {
    it("should build valid request with all required fields", () => {
      const options = createMockRequestOptions();
      const request = buildLLMRequest(options);

      expect(request).toBeDefined();
      expect(request.student).toBeDefined();
      expect(request.contents).toHaveLength(2);
      expect(request.settings).toBeDefined();
      expect(request.settings.startDate).toBeDefined();
      expect(request.settings.endDate).toBeDefined();

      const validation = validateRequest(request);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should fail validation for missing contents", () => {
      const options = createMockRequestOptions({ contents: [] });
      const request = buildLLMRequest(options);

      const validation = validateRequest(request);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("콘텐츠"))).toBe(true);
    });

    it("should calculate correct days in range", () => {
      const days = calculateDaysInRange("2026-01-06", "2026-01-19");
      expect(days).toBe(14);
    });
  });

  describe("buildExtendedLLMRequest with transforms", () => {
    it("should include transformed blocks", () => {
      // DBBlock uses snake_case (database format)
      const blocks = [
        { id: "block-1", block_index: 0, day_of_week: 1, start_time: "08:00:00", end_time: "12:00:00" },
        { id: "block-2", block_index: 1, day_of_week: 1, start_time: "14:00:00", end_time: "18:00:00" },
      ];

      const options = createMockRequestOptions({ blocks });
      const request = buildExtendedLLMRequest(options);

      expect(request.blocks).toBeDefined();
      expect(request.blocks).toHaveLength(2);
    });

    it("should include transformed academy schedules", () => {
      // DBAcademySchedule uses snake_case (database format)
      const academySchedules = [
        { id: "academy-1", day_of_week: 1, start_time: "14:00:00", end_time: "16:00:00", academy_name: "영어학원" },
      ];

      const options = createMockRequestOptions({ academySchedules });
      const request = buildExtendedLLMRequest(options);

      expect(request.academySchedules).toBeDefined();
      expect(request.academySchedules).toHaveLength(1);
    });

    it("should include subject allocations", () => {
      const subjectAllocations = [
        { content_id: "content-1", subject: "수학", subject_category: "수학", subject_type: "strategy" as const, weekly_days: 5 },
        { content_id: "content-2", subject: "영어", subject_category: "영어", subject_type: "weakness" as const, weekly_days: 3 },
        { content_id: "content-3", subject: "국어", subject_category: "국어", subject_type: null, weekly_days: 2 },
      ];

      const options = createMockRequestOptions({ subjectAllocations });
      const request = buildExtendedLLMRequest(options);

      expect(request.subjectAllocations).toBeDefined();
      expect(request.subjectAllocations).toHaveLength(3);
    });
  });
});

// ============================================
// Integration Test: Response Parsing Pipeline
// ============================================

describe("Integration: Response Parsing Pipeline", () => {
  const mockUsage = { inputTokens: 100, outputTokens: 200 };
  const mockModelId = "claude-sonnet-4-20250514";

  describe("parseLLMResponse → toDBPlanDataList", () => {
    it("should parse valid LLM response and convert to DB format", () => {
      const mockResponse = createMockLLMResponse({
        plans: [
          createMockPlan({ contentId: "content-1" }),
          createMockPlan({ contentId: "content-2", startTime: "10:30", endTime: "11:30" }),
        ],
      });

      const parsed = parseLLMResponse(JSON.stringify(mockResponse), mockModelId, mockUsage);
      expect(parsed.success).toBe(true);
      expect(parsed.response?.weeklyMatrices).toBeDefined();

      if (parsed.response) {
        // toDBPlanDataList takes the entire response, not just plans array
        const dbPlanList = toDBPlanDataList(parsed.response);

        expect(dbPlanList).toHaveLength(2);
        dbPlanList.forEach((dbPlan) => {
          expect(dbPlan.plan_date).toBeDefined();
          expect(dbPlan.content_id).toBeDefined();
        });
      }
    });

    it("should handle malformed JSON gracefully", () => {
      const parsed = parseLLMResponse("{ invalid json }", mockModelId, mockUsage);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it("should validate quality metrics", () => {
      const mockResponse = createMockLLMResponse({
        plans: [
          createMockPlan({ estimatedMinutes: 60 }),
          createMockPlan({ estimatedMinutes: 60, startTime: "10:30", endTime: "11:30" }),
        ],
        includeRecommendations: true,
      });

      const parsed = parseLLMResponse(JSON.stringify(mockResponse), mockModelId, mockUsage);
      if (parsed.response) {
        // validateQualityMetrics requires settings
        const settings = {
          startDate: "2026-01-06",
          endDate: "2026-01-19",
          dailyStudyMinutes: 180,
        };
        const quality = validateQualityMetrics(parsed.response, settings);
        expect(quality.isValid).toBeDefined();
        expect(quality.warnings).toBeDefined();
      }
    });
  });
});

// ============================================
// Integration Test: Validation Pipeline
// ============================================

describe("Integration: Validation Pipeline", () => {
  describe("Phase 3 + Phase 6 Validators Combined", () => {
    it("should pass both validators for good plans", () => {
      const plans = [
        createMockPlan({ date: "2026-01-05", contentId: "content-1", rangeStart: 1, rangeEnd: 50 }),
        createMockPlan({ date: "2026-01-06", contentId: "content-1", rangeStart: 51, rangeEnd: 100 }),
        createMockPlan({ date: "2026-01-07", contentId: "content-2", rangeStart: 1, rangeEnd: 30 }),
      ];

      // Phase 3 validation
      const phase3Result = validatePlans({
        plans,
        academySchedules: [],
        blockSets: [],
        excludeDates: [],
        excludeDays: [0, 6],
        dailyStudyMinutes: 180,
        startDate: "2026-01-05",
        endDate: "2026-01-31",
      });

      expect(phase3Result.valid).toBe(true);

      // Phase 6 validation
      const contents = createMockContentMetadataArray();
      const phase6Result = validatePlansEnhanced({
        plans,
        contents,
        dailyStudyMinutes: 240,
        maxConsecutiveSameSubject: 3,
      });

      expect(phase6Result.valid).toBe(true);
      expect(phase6Result.metrics.overallScore).toBeGreaterThan(70);
    });

    it("should detect academy conflicts in Phase 3 and single subject in Phase 6", () => {
      const plans = [
        createMockPlan({ date: "2026-01-05", startTime: "14:30", endTime: "15:30", subject: "수학" }),
        createMockPlan({ date: "2026-01-06", subject: "수학" }),
        createMockPlan({ date: "2026-01-07", subject: "수학" }),
        createMockPlan({ date: "2026-01-08", subject: "수학" }),
        createMockPlan({ date: "2026-01-09", subject: "수학" }),
        createMockPlan({ date: "2026-01-10", subject: "수학" }),
      ];

      // Phase 3 - academy conflict
      const academySchedules = [
        createMockAcademySchedule({ dayOfWeek: 1, startTime: "14:00", endTime: "16:00" }),
      ];

      const phase3Result = validatePlans({
        plans,
        academySchedules,
        blockSets: [],
        excludeDates: [],
        excludeDays: [],
        dailyStudyMinutes: 180,
        startDate: "2026-01-05",
        endDate: "2026-01-31",
      });

      expect(phase3Result.valid).toBe(false);
      expect(phase3Result.errors.some((e) => e.type === "academy_conflict")).toBe(true);

      // Phase 6 - single subject with 6 plans triggers info
      const contents = createMockContentMetadataArray();
      const phase6Result = validatePlansEnhanced({
        plans,
        contents,
        maxConsecutiveSameSubject: 2,
      });

      // 6 plans in single subject triggers subject_imbalance (info level)
      expect(phase6Result.issues.some((i) => i.type === "subject_imbalance")).toBe(true);
    });

    it("should track quality grade progression", () => {
      const contents = createMockContentMetadataArray();

      // Good plans - balanced subjects with continuity
      const goodPlans = [
        createMockPlan({ date: "2026-01-05", contentId: "content-1", subject: "수학", rangeStart: 1, rangeEnd: 50, estimatedMinutes: 60 }),
        createMockPlan({ date: "2026-01-06", contentId: "content-2", subject: "영어", rangeStart: 1, rangeEnd: 30, estimatedMinutes: 60 }),
      ];

      const goodResult = validatePlansEnhanced({ plans: goodPlans, contents });
      const goodGrade = getQualityGrade(goodResult.metrics.overallScore);

      // Bad plans (duplicates, gaps) - should have lower quality
      const badPlans = [
        createMockPlan({ date: "2026-01-05", contentId: "content-1", subject: "수학", rangeStart: 1, rangeEnd: 50, estimatedMinutes: 60 }),
        createMockPlan({ date: "2026-01-05", contentId: "content-1", subject: "수학", rangeStart: 1, rangeEnd: 50, estimatedMinutes: 60, startTime: "10:30", endTime: "11:30" }), // duplicate
        createMockPlan({ date: "2026-01-06", contentId: "content-1", subject: "수학", rangeStart: 100, rangeEnd: 150, estimatedMinutes: 60 }), // gap
      ];

      const badResult = validatePlansEnhanced({ plans: badPlans, contents });
      const badGrade = getQualityGrade(badResult.metrics.overallScore);

      // Good plans should score higher
      expect(goodResult.metrics.overallScore).toBeGreaterThanOrEqual(badResult.metrics.overallScore);

      // Good plans should have A or B grade
      expect(["A", "B"]).toContain(goodGrade);

      // Bad plans should have issues
      expect(badResult.issues.length).toBeGreaterThan(0);
    });
  });
});

// ============================================
// Integration Test: Enhanced Recommendation Pipeline
// ============================================

describe("Integration: Enhanced Recommendation Pipeline", () => {
  describe("buildEnhancedContentRecommendationPrompt → validateEnhancedRecommendationResponse", () => {
    it("should build prompt with all enhanced features", () => {
      const request = createMockEnhancedRecommendationRequest({
        exams: [
          {
            examName: "1차 지필평가",
            examDate: "2026-02-15",
            examType: "midterm",
            daysUntil: 40,
          },
        ],
        velocity: {
          pagesPerDay: 15,
          avgSessionMinutes: 90,
          studyDaysPerWeek: 5,
        },
        completionHistory: [
          {
            contentId: "hist-1",
            contentType: "book",
            subject: "수학",
            completedAt: "2025-12-01",
            durationDays: 30,
            difficulty: "medium",
          },
        ],
      });

      const prompt = buildEnhancedContentRecommendationPrompt(request);

      expect(prompt).toContain("학습 속도");
      expect(prompt).toContain("시험 일정");
      expect(prompt).toContain("최근 완료");
      expect(prompt).toContain("candidate-1");
      expect(prompt).toContain("candidate-2");
    });

    it("should validate recommendation response correctly", () => {
      const validContentIds = new Set(["candidate-1", "candidate-2"]);

      const validResponse = {
        recommendations: [
          {
            contentId: "candidate-1",
            title: "수능 영어 완성",
            subject: "영어",
            subjectCategory: "영어",
            contentType: "book" as const,
            priority: 1,
            reason: "약점 과목 보완",
            category: "weak_subject" as const,
            expectedBenefit: "영어 성적 향상",
            matchScore: {
              difficultyFit: 22,
              weakSubjectTarget: 18,
              velocityAlignment: 15,
              prerequisiteMet: 15,
              examRelevance: 10,
              recency: 5,
              total: 85,
            },
            difficultyLevel: "current" as const,
            estimatedCompletionDays: 20,
          },
        ],
        summary: {
          totalRecommended: 1,
          avgMatchScore: 85,
          focusAreaDistribution: { weak_subjects: 1, all_subjects: 0 },
        },
        insights: {
          overallDirection: "약점 보완 중심",
          balanceAdvice: "영어 집중 권장",
          difficultyAdvice: "현재 수준 유지",
        },
      };

      const validation = validateEnhancedRecommendationResponse(validResponse, validContentIds);

      expect(validation.validRecommendations).toHaveLength(1);
      expect(validation.errors).toHaveLength(0);
    });

    it("should filter invalid content IDs in response", () => {
      const validContentIds = new Set(["candidate-1"]);

      const responseWithInvalid = {
        recommendations: [
          {
            contentId: "candidate-1",
            title: "수능 영어 완성",
            subject: "영어",
            subjectCategory: "영어",
            contentType: "book" as const,
            priority: 1,
            reason: "약점 과목",
            category: "weak_subject" as const,
            expectedBenefit: "성적 향상",
            matchScore: {
              difficultyFit: 20,
              weakSubjectTarget: 20,
              velocityAlignment: 15,
              prerequisiteMet: 15,
              examRelevance: 10,
              recency: 5,
              total: 85,
            },
            difficultyLevel: "current" as const,
            estimatedCompletionDays: 20,
          },
          {
            contentId: "invalid-id", // Not in valid set
            title: "Invalid Content",
            subject: "수학",
            subjectCategory: "수학",
            contentType: "book" as const,
            priority: 2,
            reason: "테스트",
            category: "weak_subject" as const,
            expectedBenefit: "테스트",
            matchScore: {
              difficultyFit: 15,
              weakSubjectTarget: 15,
              velocityAlignment: 10,
              prerequisiteMet: 10,
              examRelevance: 10,
              recency: 10,
              total: 70,
            },
            difficultyLevel: "current" as const,
            estimatedCompletionDays: 15,
          },
        ],
        summary: { totalRecommended: 2, avgMatchScore: 77.5, focusAreaDistribution: {} },
        insights: { overallDirection: "", balanceAdvice: "", difficultyAdvice: "" },
      };

      const validation = validateEnhancedRecommendationResponse(responseWithInvalid, validContentIds);

      expect(validation.validRecommendations).toHaveLength(1);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain("invalid-id");
    });
  });

  describe("Utility Functions", () => {
    it("should calculate days until exam correctly", () => {
      // Today is mocked in vitest, so use relative dates
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const days = calculateDaysUntilExam(futureDateStr);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(31);
    });

    it("should estimate completion days based on velocity", () => {
      const content = {
        id: "test-1",
        title: "Test Book",
        subject: "수학",
        subjectCategory: "수학",
        contentType: "book" as const,
        totalPages: 200,
      };
      const velocity = { pagesPerDay: 10 };

      const days = estimateCompletionDays(content, velocity);

      // 200 pages / 10 per day = 20 days
      expect(days).toBe(20);
    });

    it("should determine difficulty level based on student grade", () => {
      // Student grade 2 (good) with hard content
      const level = determineDifficultyLevel("hard", 2);
      expect(level).toBe("current"); // Grade 2 already at hard level

      // Student grade 7 (struggling) with hard content = stretch
      const levelStretch = determineDifficultyLevel("hard", 7);
      expect(levelStretch).toBe("stretch");

      // Student grade 4 (medium) with medium content = current
      const levelCurrent = determineDifficultyLevel("medium", 4);
      expect(levelCurrent).toBe("current");
    });

    it("should estimate tokens for enhanced recommendation", () => {
      const request = createMockEnhancedRecommendationRequest();
      const estimate = estimateEnhancedRecommendationTokens(request);

      expect(estimate.systemTokens).toBeGreaterThan(0);
      expect(estimate.userTokens).toBeGreaterThan(0);
      expect(estimate.totalTokens).toBe(estimate.systemTokens + estimate.userTokens);
    });
  });
});

// ============================================
// Integration Test: End-to-End Quality Pipeline
// ============================================

describe("Integration: End-to-End Quality Pipeline", () => {
  it("should produce consistent quality metrics across pipeline stages", () => {
    const contents = createMockContentMetadataArray();

    // Generate mock plans
    const plans = [
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        subject: "수학",
        rangeStart: 1,
        rangeEnd: 50,
        estimatedMinutes: 60,
      }),
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-2",
        subject: "영어",
        rangeStart: 1,
        rangeEnd: 30,
        estimatedMinutes: 60,
        startTime: "10:30",
        endTime: "11:30",
      }),
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-1",
        subject: "수학",
        rangeStart: 51,
        rangeEnd: 100,
        estimatedMinutes: 60,
      }),
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-2",
        subject: "영어",
        rangeStart: 31,
        rangeEnd: 60,
        estimatedMinutes: 60,
        startTime: "10:30",
        endTime: "11:30",
      }),
    ];

    // Step 1: Phase 3 Validation
    const phase3Result = validatePlans({
      plans,
      academySchedules: [],
      blockSets: [],
      excludeDates: [],
      excludeDays: [0, 6],
      dailyStudyMinutes: 180,
      startDate: "2026-01-05",
      endDate: "2026-01-12",
    });

    expect(phase3Result.valid).toBe(true);

    // Step 2: Phase 6 Enhanced Validation
    const phase6Result = validatePlansEnhanced({
      plans,
      contents,
      dailyStudyMinutes: 240,
      maxConsecutiveSameSubject: 3,
    });

    expect(phase6Result.valid).toBe(true);

    // Step 3: Quality Grade
    const grade = getQualityGrade(phase6Result.metrics.overallScore);
    expect(["A", "B"]).toContain(grade);

    // Step 4: Subject Distribution Check
    expect(phase6Result.distribution).toBeDefined();
    const subjects = phase6Result.distribution.map((d) => d.subject);
    expect(subjects).toContain("수학");
    expect(subjects).toContain("영어");

    // Step 5: Continuity Check
    const continuityIssues = phase6Result.issues.filter((i) => i.type === "range_gap");
    expect(continuityIssues).toHaveLength(0);
  });

  it("should detect quality degradation in poor plans", () => {
    const contents = createMockContentMetadataArray();

    // Poor quality plans with multiple issues
    const poorPlans = [
      // Same day, same content, same range (duplicate)
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        subject: "수학",
        rangeStart: 1,
        rangeEnd: 50,
        estimatedMinutes: 120,
      }),
      createMockPlan({
        date: "2026-01-05",
        contentId: "content-1",
        subject: "수학",
        rangeStart: 1,
        rangeEnd: 50,
        estimatedMinutes: 120,
        startTime: "10:30",
        endTime: "12:30",
      }),
      // Gap in content range
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-1",
        subject: "수학",
        rangeStart: 100,
        rangeEnd: 150,
        estimatedMinutes: 120,
      }),
      // Exceeds daily load
      createMockPlan({
        date: "2026-01-06",
        contentId: "content-2",
        subject: "수학",
        rangeStart: 1,
        rangeEnd: 100,
        estimatedMinutes: 180,
        startTime: "14:00",
        endTime: "17:00",
      }),
    ];

    const result = validatePlansEnhanced({
      plans: poorPlans,
      contents,
      dailyStudyMinutes: 180,
      maxConsecutiveSameSubject: 2,
    });

    // Should detect issues
    expect(result.issues.length).toBeGreaterThan(0);

    // Should have lower quality score
    expect(result.metrics.overallScore).toBeLessThan(80);

    // Check specific issue types detected
    const issueTypes = result.issues.map((i) => i.type);
    expect(issueTypes).toContain("content_duplicate"); // Same content, same range
    expect(issueTypes).toContain("range_gap"); // Gap in range

    // Grade should reflect poor quality
    const grade = getQualityGrade(result.metrics.overallScore);
    expect(["C", "D", "F"]).toContain(grade);
  });
});

// ============================================
// Integration Test: Transform Functions
// ============================================

describe("Integration: Transform Functions", () => {
  it("should transform blocks correctly", () => {
    const rawBlocks = [
      { id: "1", block_index: 0, day_of_week: 1, start_time: "08:00", end_time: "12:00" },
      { id: "2", block_index: 1, day_of_week: 1, start_time: "14:00", end_time: "18:00" },
    ];

    const transformed = transformBlocks(rawBlocks);

    expect(transformed).toHaveLength(2);
    expect(transformed[0]).toEqual({
      id: "1",
      blockIndex: 0,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "12:00",
    });
  });

  it("should transform academy schedules correctly", () => {
    const rawSchedules = [
      {
        id: "1",
        academy_name: "영어학원",
        day_of_week: 1,
        start_time: "14:00",
        end_time: "16:00",
        travel_time: 30,
      },
    ];

    const transformed = transformAcademySchedules(rawSchedules);

    expect(transformed).toHaveLength(1);
    expect(transformed[0]).toEqual({
      id: "1",
      academyName: "영어학원",
      dayOfWeek: 1,
      startTime: "14:00",
      endTime: "16:00",
      travelTime: 30,
    });
  });

  it("should transform subject allocations correctly", () => {
    const rawAllocations = [
      { content_id: "c1", subject: "수학", subject_category: "수학", subject_type: "strategy" as const, weekly_days: 5 },
      { content_id: "c2", subject: "영어", subject_category: "영어", subject_type: "weakness" as const, weekly_days: 4 },
    ];

    const transformed = transformSubjectAllocations(rawAllocations);

    expect(transformed).toHaveLength(2);
    expect(transformed[0].subject).toBe("수학");
    expect(transformed[0].contentId).toBe("c1");
    expect(transformed[0].subjectType).toBe("strategy");
    expect(transformed[1].subject).toBe("영어");
  });
});

// ============================================
// Integration Test: Error Handling
// ============================================

describe("Integration: Error Handling", () => {
  it("should handle empty plans gracefully", () => {
    const contents = createMockContentMetadataArray();

    const result = validatePlansEnhanced({
      plans: [],
      contents,
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary.totalPlans).toBe(0);
  });

  it("should handle undefined content metadata gracefully", () => {
    const plans = [createMockPlan({ contentId: "unknown-content" })];

    const result = validatePlansEnhanced({ plans, contents: [] });

    // Should still produce a result without crashing
    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.summary.totalPlans).toBe(1);
  });

  it("should handle malformed dates in plans", () => {
    const contents = createMockContentMetadataArray();

    const plans = [
      createMockPlan({ date: "invalid-date", contentId: "content-1" }),
      createMockPlan({ date: "2026-01-05", contentId: "content-1" }),
    ];

    // Should not crash
    const result = validatePlansEnhanced({ plans, contents });
    expect(result).toBeDefined();
    expect(result.summary.totalPlans).toBe(2);
  });

  it("should handle empty recommendation response", () => {
    const validContentIds = new Set(["candidate-1"]);

    const emptyResponse = {
      recommendations: [],
      summary: { totalRecommended: 0, avgMatchScore: 0, focusAreaDistribution: {} },
      insights: { overallDirection: "", balanceAdvice: "", difficultyAdvice: "" },
    };

    const validation = validateEnhancedRecommendationResponse(emptyResponse, validContentIds);

    expect(validation.validRecommendations).toHaveLength(0);
    expect(validation.errors).toHaveLength(0);
  });
});
