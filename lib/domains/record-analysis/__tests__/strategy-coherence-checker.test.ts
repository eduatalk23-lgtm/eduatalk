// ============================================
// L4-D / L2 Coherence Checker — suggestStrategies 의미 정합성 검증 단위 테스트
//
// Flash LLM 응답을 mock하여 프롬프트 빌더와 violation 변환 로직을 검증한다.
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import type {
  SuggestStrategiesInput,
  SuggestStrategiesResult,
  StrategySuggestion,
} from "../llm/types";

// Flash LLM mock (ai-client는 plan ai-sdk를 재export)
vi.mock("@/lib/domains/plan/llm/ai-sdk", () => ({
  generateObjectWithRateLimit: vi.fn(),
  generateTextWithRateLimit: vi.fn(),
}));

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

function makeSuggestion(overrides: Partial<StrategySuggestion> = {}): StrategySuggestion {
  return {
    targetArea: "setek",
    strategyContent:
      "2학년 물리학 세특에서 의료영상 원리(CT/MRI) 탐구 보고서 작성. Beer-Lambert 법칙 중심 심화 탐구.",
    priority: "high",
    reasoning: "탐구력 B- 등급으로 교과 심화 근거가 부족. 진로(의료공학)와 연계 보강 가능.",
    ...overrides,
  };
}

function makeOutput(overrides: Partial<SuggestStrategiesResult> = {}): SuggestStrategiesResult {
  return {
    suggestions: [
      makeSuggestion(),
      makeSuggestion({
        targetArea: "career",
        strategyContent: "진로활동에서 의공학 직업인 인터뷰 2회, 탐구결과 발표 병행.",
        priority: "medium",
        reasoning: "진로탐색 C등급. 구체적 직업 인터뷰로 역량 보강.",
      }),
    ],
    summary: "탐구력과 진로탐색 역량 중심 보강 전략 제안.",
    ...overrides,
  };
}

function makeInput(overrides: Partial<SuggestStrategiesInput> = {}): SuggestStrategiesInput {
  return {
    weaknesses: ["탐구 결론 미기술 — F10 성장부재", "진로탐색 활동 빈도 부족"],
    weakCompetencies: [
      { item: "academic_inquiry", grade: "B-", label: "탐구력" },
      { item: "career_exploration", grade: "C", label: "진로 탐색 활동과 경험" },
    ],
    rubricWeaknesses: ["탐구력 Q2: 연구 결론을 명시적으로 기술하는가?"],
    grade: 2,
    targetMajor: "의공학",
    notTakenSubjects: ["생명과학II"],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("checkStrategyCoherence — 기본 동작", () => {
  let llmMock: MockedFunction<
    typeof import("@/lib/domains/plan/llm/ai-sdk").generateObjectWithRateLimit
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const aiSdk = await import("@/lib/domains/plan/llm/ai-sdk");
    llmMock = aiSdk.generateObjectWithRateLimit as MockedFunction<
      typeof aiSdk.generateObjectWithRateLimit
    >;
  });

  it("위반 없음 — passed=true, violations 빈 배열", async () => {
    llmMock.mockResolvedValue({
      object: { violations: [] },
      usage: { inputTokens: 280, outputTokens: 40 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    const result = await checkStrategyCoherence(makeOutput(), makeInput());
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.usage?.inputTokens).toBe(280);
  });

  it("error 위반 → passed=false, errorCount 증가", async () => {
    llmMock.mockResolvedValue({
      object: {
        violations: [
          {
            rule: "SUGGESTION_WEAKNESS_ALIGNMENT",
            severity: "error",
            message: "reasoning에 입력 약점과의 연결이 없음",
            fieldPath: "suggestions[0].reasoning",
          },
        ],
      },
      usage: { inputTokens: 280, outputTokens: 40 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    const result = await checkStrategyCoherence(makeOutput(), makeInput());
    expect(result.passed).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.violations[0].rule).toBe("SUGGESTION_WEAKNESS_ALIGNMENT");
    expect(result.violations[0].fieldPath).toBe("suggestions[0].reasoning");
  });

  it("warning만 → passed=true, warningCount 증가", async () => {
    llmMock.mockResolvedValue({
      object: {
        violations: [
          {
            rule: "NOT_TAKEN_COURSE_COVERAGE",
            severity: "warning",
            message: "생명과학II 이수 제안이 없음",
          },
        ],
      },
      usage: { inputTokens: 280, outputTokens: 20 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    const result = await checkStrategyCoherence(makeOutput(), makeInput());
    expect(result.passed).toBe(true);
    expect(result.warningCount).toBe(1);
  });
});

describe("checkStrategyCoherence — 프롬프트 빌더", () => {
  let llmMock: MockedFunction<
    typeof import("@/lib/domains/plan/llm/ai-sdk").generateObjectWithRateLimit
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const aiSdk = await import("@/lib/domains/plan/llm/ai-sdk");
    llmMock = aiSdk.generateObjectWithRateLimit as MockedFunction<
      typeof aiSdk.generateObjectWithRateLimit
    >;
    llmMock.mockResolvedValue({
      object: { violations: [] },
      usage: { inputTokens: 0, outputTokens: 0 },
    } as Awaited<ReturnType<typeof llmMock>>);
  });

  it("약점·부족역량·targetMajor가 프롬프트에 포함된다", async () => {
    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    await checkStrategyCoherence(makeOutput(), makeInput());

    expect(llmMock).toHaveBeenCalledOnce();
    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("의공학");
    expect(userContent).toContain("탐구 결론 미기술");
    expect(userContent).toContain("탐구력 (B-)");
    expect(userContent).toContain("진로 탐색 활동과 경험 (C)");
    expect(userContent).toContain("생명과학II");
  });

  it("suggestions의 targetArea/priority/content/reasoning이 인덱스와 함께 포함된다", async () => {
    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    await checkStrategyCoherence(makeOutput(), makeInput());

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("[0] targetArea=setek priority=high");
    expect(userContent).toContain("[1] targetArea=career priority=medium");
    expect(userContent).toContain("Beer-Lambert");
    expect(userContent).toContain("의공학");
  });

  it("diagnosisImprovements가 제공되면 프롬프트에 포함된다", async () => {
    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    await checkStrategyCoherence(
      makeOutput(),
      makeInput({
        diagnosisImprovements: [
          {
            priority: "높음",
            area: "탐구역량",
            gap: "결론 미기술",
            action: "결론·제언 1문장 명시",
            outcome: "F10 해소",
          },
        ],
      }),
    );

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("AI 진단 개선 전략");
    expect(userContent).toContain("priority=높음");
    expect(userContent).toContain('action="결론·제언 1문장 명시"');
  });

  it("qualityPatterns가 제공되면 포함된다", async () => {
    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    await checkStrategyCoherence(
      makeOutput(),
      makeInput({
        qualityPatterns: [
          { pattern: "P1_나열식", count: 11, subjects: ["물리", "수학"] },
        ],
      }),
    );

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("세특 품질 반복 패턴");
    expect(userContent).toContain("P1_나열식 (11건)");
  });

  it("LLM 호출 파라미터: fast tier, temperature 0.1, timeoutMs 60s, maxTokens 2048", async () => {
    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    await checkStrategyCoherence(makeOutput(), makeInput());

    const call = llmMock.mock.calls[0][0];
    expect(call.modelTier).toBe("fast");
    expect(call.temperature).toBe(0.1);
    expect(call.timeoutMs).toBe(60_000);
    expect(call.maxTokens).toBe(2048);
  });
});

describe("checkStrategyCoherence — 에러 전파", () => {
  it("LLM 호출 실패 시 예외가 그대로 throw (호출부에서 non-fatal 처리)", async () => {
    const aiSdk = await import("@/lib/domains/plan/llm/ai-sdk");
    const llmMock = aiSdk.generateObjectWithRateLimit as MockedFunction<
      typeof aiSdk.generateObjectWithRateLimit
    >;
    llmMock.mockRejectedValue(new Error("timeout"));

    const { checkStrategyCoherence } = await import(
      "../llm/validators/strategy-coherence-checker"
    );
    await expect(checkStrategyCoherence(makeOutput(), makeInput())).rejects.toThrow(
      "timeout",
    );
  });
});
