// ============================================
// L4-D / L3 Targeted Repair — suggestStrategies 단위 테스트
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import type {
  SuggestStrategiesInput,
  SuggestStrategiesResult,
  StrategySuggestion,
} from "../llm/types";
import type { Violation } from "../llm/validators/types";

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
    reasoning:
      "탐구력 B- 등급으로 교과 심화 근거가 부족. 진로(의공학)와 연계 보강 가능.",
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
        reasoning: "진로탐색 C등급. 직업 인터뷰로 역량 보강.",
      }),
      makeSuggestion({
        targetArea: "reading",
        strategyContent: "의료영상 원리 관련 서적 2권 독서 후 보고서 작성.",
        priority: "low",
        reasoning: "지식 보강 필요.",
      }),
    ],
    summary: "탐구력·진로·독서 영역 보강 전략 3건.",
    ...overrides,
  };
}

function makeInput(overrides: Partial<SuggestStrategiesInput> = {}): SuggestStrategiesInput {
  return {
    weaknesses: ["탐구 결론 미기술 — F10", "진로탐색 빈도 부족"],
    weakCompetencies: [
      { item: "academic_inquiry", grade: "B-", label: "탐구력" },
      { item: "career_exploration", grade: "C", label: "진로 탐색 활동과 경험" },
    ],
    rubricWeaknesses: ["탐구력 Q2: 결론 명시"],
    grade: 2,
    targetMajor: "의공학",
    notTakenSubjects: ["생명과학II"],
    ...overrides,
  };
}

function v(rule: string, severity: "error" | "warning", fieldPath?: string): Violation {
  return { rule, severity, message: `${rule} msg`, fieldPath };
}

// ─────────────────────────────────────────────
// extractRepairTargetIndices
// ─────────────────────────────────────────────

describe("extractRepairTargetIndices", () => {
  it("suggestions[i] 위반의 인덱스만 수집 (정렬)", async () => {
    const { extractRepairTargetIndices } = await import(
      "../llm/validators/strategy-repair"
    );
    const indices = extractRepairTargetIndices(
      [
        v("SUGGESTION_WEAKNESS_ALIGNMENT", "error", "suggestions[2].reasoning"),
        v("SUGGESTION_DUPLICATE", "error", "suggestions[0].strategyContent"),
        v("TARGET_AREA_WEAKNESS_MATCH", "error", "suggestions[0].targetArea"),
      ],
      3,
    );
    expect(indices).toEqual([0, 2]);
  });

  it("suggestions 범위 밖 인덱스는 제외", async () => {
    const { extractRepairTargetIndices } = await import(
      "../llm/validators/strategy-repair"
    );
    const indices = extractRepairTargetIndices(
      [
        v("SUGGESTION_DUPLICATE", "error", "suggestions[5]"),
        v("SUGGESTION_CONTENT_EMPTY", "error", "suggestions[1]"),
      ],
      3,
    );
    expect(indices).toEqual([1]);
  });

  it("suggestions 외 필드 위반은 무시", async () => {
    const { extractRepairTargetIndices } = await import(
      "../llm/validators/strategy-repair"
    );
    const indices = extractRepairTargetIndices(
      [
        v("SUMMARY_EMPTY", "error", "summary"),
        v("SUGGESTIONS_EMPTY", "error", "suggestions"),
      ],
      3,
    );
    expect(indices).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// repairStrategies — 전체 흐름
// ─────────────────────────────────────────────

describe("repairStrategies — 기본 동작", () => {
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

  it("error 없으면 repair 건너뜀", async () => {
    const { repairStrategies } = await import("../llm/validators/strategy-repair");
    const result = await repairStrategies(
      makeOutput(),
      [v("SUGGESTION_CONTENT_TOO_SHORT", "warning", "suggestions[0]")],
      makeInput(),
    );
    expect(result.repaired).toBe(false);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("suggestions[i] 위반만 있을 때 해당 인덱스만 재생성·병합", async () => {
    llmMock.mockResolvedValue({
      object: {
        repairedSuggestions: [
          {
            index: 0,
            targetArea: "setek",
            priority: "high",
            strategyContent:
              "물리II 세특: CT/MRI 원리 탐구 보고서 작성, 결론·제언 1문장 명시. 생명과학II 이수 병행.",
            reasoning:
              "탐구력 B- + 결론 미기술(F10) 약점을 직접 해결. 의공학 진로와 직결.",
          },
        ],
      },
      usage: { inputTokens: 320, outputTokens: 100 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { repairStrategies } = await import("../llm/validators/strategy-repair");
    const original = makeOutput();
    const result = await repairStrategies(
      original,
      [
        v("SUGGESTION_WEAKNESS_ALIGNMENT", "error", "suggestions[0].reasoning"),
      ],
      makeInput(),
    );

    expect(result.repaired).toBe(true);
    expect(result.repairedFieldPaths).toEqual(["suggestions[0]"]);
    expect(result.output.suggestions[0].strategyContent).toContain("CT/MRI");
    expect(result.output.suggestions[0].reasoning).toContain("F10");
    // 다른 suggestion은 원본 유지
    expect(result.output.suggestions[1]).toEqual(original.suggestions[1]);
    expect(result.output.suggestions[2]).toEqual(original.suggestions[2]);
    expect(result.output.summary).toEqual(original.summary);
  });

  it("여러 인덱스 동시 repair", async () => {
    llmMock.mockResolvedValue({
      object: {
        repairedSuggestions: [
          {
            index: 0,
            targetArea: "setek",
            priority: "high",
            strategyContent: "세특 보강 — 결론 명시화 구체 실행 계획 수립",
            reasoning: "탐구력 B-, 결론 미기술 해결 타겟",
          },
          {
            index: 2,
            targetArea: "reading",
            priority: "medium",
            strategyContent: "의료영상 원리 서적 정독 후 서평 작성 — 진로 연계",
            reasoning: "진로탐색 C 약점 보강, 지식 기반 확보",
          },
        ],
      },
      usage: { inputTokens: 500, outputTokens: 150 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { repairStrategies } = await import("../llm/validators/strategy-repair");
    const result = await repairStrategies(
      makeOutput(),
      [
        v("SUGGESTION_DUPLICATE", "error", "suggestions[0]"),
        v("SUGGESTION_WEAKNESS_ALIGNMENT", "error", "suggestions[2].reasoning"),
      ],
      makeInput(),
    );

    expect(result.repaired).toBe(true);
    expect(result.repairedFieldPaths).toEqual(["suggestions[0]", "suggestions[2]"]);
    expect(result.output.suggestions[0].strategyContent).toContain("결론 명시화");
    expect(result.output.suggestions[2].strategyContent).toContain("서평");
  });

  it("LLM 파라미터: fast tier, temperature 0.2, timeoutMs 90s", async () => {
    llmMock.mockResolvedValue({
      object: {
        repairedSuggestions: [
          {
            index: 0,
            targetArea: "setek",
            priority: "high",
            strategyContent: "충분한 길이의 수리된 전략 내용으로 30자 이상 서술합니다.",
            reasoning: "약점 직접 해결 근거 제시",
          },
        ],
      },
      usage: { inputTokens: 0, outputTokens: 0 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { repairStrategies } = await import("../llm/validators/strategy-repair");
    await repairStrategies(
      makeOutput(),
      [v("SUGGESTION_WEAKNESS_ALIGNMENT", "error", "suggestions[0]")],
      makeInput(),
    );

    const call = llmMock.mock.calls[0][0];
    expect(call.modelTier).toBe("fast");
    expect(call.temperature).toBe(0.2);
    expect(call.timeoutMs).toBe(90_000);
    expect(call.maxTokens).toBe(2560);
  });

  it("LLM 실패 시 예외 throw", async () => {
    llmMock.mockRejectedValue(new Error("timeout"));

    const { repairStrategies } = await import("../llm/validators/strategy-repair");
    await expect(
      repairStrategies(
        makeOutput(),
        [v("SUGGESTION_WEAKNESS_ALIGNMENT", "error", "suggestions[0]")],
        makeInput(),
      ),
    ).rejects.toThrow("timeout");
  });
});

// ─────────────────────────────────────────────
// buildUserPrompt
// ─────────────────────────────────────────────

describe("buildUserPrompt — 프롬프트 내용", () => {
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
      object: {
        repairedSuggestions: [
          {
            index: 0,
            targetArea: "setek",
            priority: "high",
            strategyContent: "30자 이상의 충분한 길이 전략 내용을 채워 넣습니다.",
            reasoning: "충분한 근거 제시",
          },
        ],
      },
      usage: { inputTokens: 0, outputTokens: 0 },
    } as Awaited<ReturnType<typeof llmMock>>);
  });

  it("입력 약점·부족역량·미이수과목·희망전공이 프롬프트 포함", async () => {
    const { repairStrategies } = await import("../llm/validators/strategy-repair");
    await repairStrategies(
      makeOutput(),
      [v("SUGGESTION_WEAKNESS_ALIGNMENT", "error", "suggestions[0]")],
      makeInput(),
    );

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("의공학");
    expect(userContent).toContain("탐구 결론 미기술");
    expect(userContent).toContain("탐구력 (B-)");
    expect(userContent).toContain("생명과학II");
    expect(userContent).toContain("suggestions[0]");
    expect(userContent).toContain("SUGGESTION_WEAKNESS_ALIGNMENT");
  });

  it("원본 suggestions가 인덱스와 함께 프롬프트 포함", async () => {
    const { repairStrategies } = await import("../llm/validators/strategy-repair");
    await repairStrategies(
      makeOutput(),
      [v("SUGGESTION_DUPLICATE", "error", "suggestions[1]")],
      makeInput(),
    );

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("[0] targetArea=setek priority=high");
    expect(userContent).toContain("[1] targetArea=career priority=medium");
    expect(userContent).toContain("[2] targetArea=reading priority=low");
  });
});
