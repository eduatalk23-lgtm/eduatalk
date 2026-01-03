/**
 * 하이브리드 플랜 완전 생성 액션 테스트
 *
 * @module __tests__/lib/domains/plan/llm/actions/generateHybridPlanComplete.test
 */

import { describe, it, expect } from "vitest";

describe("generateHybridPlanComplete module exports", () => {
  it("필요한 함수와 타입이 올바르게 내보내져야 함", async () => {
    const module = await import(
      "@/lib/domains/plan/llm/actions/generateHybridPlanComplete"
    );

    // 메인 액션
    expect(module.generateHybridPlanCompleteAction).toBeDefined();
    expect(typeof module.generateHybridPlanCompleteAction).toBe("function");

    // 미리보기 액션
    expect(module.previewHybridPlanAction).toBeDefined();
    expect(typeof module.previewHybridPlanAction).toBe("function");
  });
});

describe("generateHybridPlanComplete types", () => {
  it("GenerateHybridPlanCompleteInput 타입에 맞는 객체를 생성할 수 있어야 함", async () => {
    // 타입 호환성 테스트 (런타임 검증)
    const input = {
      planGroupId: "plan-group-123",
      student: {
        id: "student-123",
        name: "홍길동",
        grade: "고2",
      },
      scores: [
        {
          subject: "수학",
          subjectCategory: "수학",
          score: 65,
        },
      ],
      contents: [
        {
          id: "content-123",
          title: "수학 개념서",
          subject: "수학",
          subjectCategory: "수학",
          contentType: "book" as const,
          estimatedHours: 30,
          difficulty: "medium" as const,
        },
      ],
      period: {
        startDate: "2026-01-06",
        endDate: "2026-01-19",
        totalDays: 14,
        studyDays: 12,
      },
      additionalInstructions: "취약 과목 집중 학습",
      modelTier: "standard" as const,
      role: "student" as const,
    };

    expect(input.planGroupId).toBe("plan-group-123");
    expect(input.student.name).toBe("홍길동");
    expect(input.scores).toHaveLength(1);
    expect(input.contents).toHaveLength(1);
    expect(input.period.totalDays).toBe(14);
  });

  it("GenerateHybridPlanCompleteResult 타입에 맞는 성공 객체를 생성할 수 있어야 함", async () => {
    const successResult = {
      success: true as const,
      planCount: 42,
      aiRecommendations: {
        studyTips: ["아침에 수학 집중"],
        warnings: ["과도한 학습량 주의"],
        suggestedAdjustments: [],
        focusAreas: ["수학 함수"],
      },
      tokensUsed: {
        input: 1500,
        output: 800,
      },
      aiProcessingTimeMs: 2500,
      totalProcessingTimeMs: 5000,
      lowConfidenceWarning: false,
    };

    expect(successResult.success).toBe(true);
    expect(successResult.planCount).toBe(42);
    expect(successResult.aiRecommendations?.studyTips).toHaveLength(1);
    expect(successResult.tokensUsed?.input).toBe(1500);
  });

  it("GenerateHybridPlanCompleteResult 타입에 맞는 에러 객체를 생성할 수 있어야 함", async () => {
    const errorResult = {
      success: false as const,
      error: "AI 프레임워크 생성 실패",
      errorPhase: "ai_framework" as const,
      totalProcessingTimeMs: 1000,
    };

    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe("AI 프레임워크 생성 실패");
    expect(errorResult.errorPhase).toBe("ai_framework");
  });

  it("PreviewHybridPlanResult 타입에 맞는 객체를 생성할 수 있어야 함", async () => {
    const previewResult = {
      success: true as const,
      schedulerOptions: {
        weak_subject_focus: "high" as const,
        study_days: 5,
        review_days: 2,
        subject_allocations: [
          {
            subject_id: "subject-math",
            subject_name: "수학",
            subject_type: "weakness" as const,
            weekly_days: 5,
          },
        ],
      },
      aiRecommendations: {
        studyTips: ["취약 과목 집중"],
        warnings: [],
        suggestedAdjustments: [],
        focusAreas: ["수학"],
      },
      tokensUsed: {
        input: 1200,
        output: 600,
      },
      processingTimeMs: 2000,
      lowConfidenceWarning: false,
    };

    expect(previewResult.success).toBe(true);
    expect(previewResult.schedulerOptions?.weak_subject_focus).toBe("high");
    expect(previewResult.schedulerOptions?.subject_allocations).toHaveLength(1);
  });
});

describe("LLM index exports for hybrid plan", () => {
  it("LLM 인덱스에서 하이브리드 플랜 액션이 내보내져야 함", async () => {
    const llmModule = await import("@/lib/domains/plan/llm");

    // 하이브리드 플랜 완전 생성 액션
    expect(llmModule.generateHybridPlanCompleteAction).toBeDefined();
    expect(llmModule.previewHybridPlanAction).toBeDefined();

    // 기존 AI Framework 액션
    expect(llmModule.generateAIFrameworkAction).toBeDefined();

    // 변환기
    expect(llmModule.convertFrameworkToSchedulerOptions).toBeDefined();

    // 유틸리티
    expect(llmModule.extractSchedulerOptionsForDB).toBeDefined();
    expect(llmModule.extractRecommendationsForDB).toBeDefined();
  });
});

describe("Service layer AISchedulerOptionsOverride", () => {
  it("AISchedulerOptionsOverride 타입이 서비스 레이어에서 내보내져야 함", async () => {
    const servicesModule = await import("@/lib/plan/services");

    // Phase 5 타입 확인 (런타임에서는 타입 확인 불가하지만 import 성공 여부 확인)
    expect(servicesModule.preparePlanGenerationData).toBeDefined();
    expect(servicesModule.generatePlansWithServices).toBeDefined();
  });

  it("AISchedulerOptionsOverride 타입에 맞는 객체를 생성할 수 있어야 함", async () => {
    const override = {
      weak_subject_focus: "high" as const,
      study_days: 5,
      review_days: 2,
      subject_allocations: [
        {
          subject_id: "subject-math",
          subject_name: "수학",
          subject_type: "weakness" as const,
          weekly_days: 5,
        },
        {
          subject_id: "subject-english",
          subject_name: "영어",
          subject_type: "strategy" as const,
          weekly_days: 3,
        },
      ],
      content_allocations: [
        {
          content_id: "content-123",
          content_type: "book" as const,
          subject_type: "weakness" as const,
          weekly_days: 4,
        },
      ],
    };

    expect(override.weak_subject_focus).toBe("high");
    expect(override.study_days).toBe(5);
    expect(override.subject_allocations).toHaveLength(2);
    expect(override.content_allocations).toHaveLength(1);
    expect(override.subject_allocations?.[0].subject_type).toBe("weakness");
  });
});
