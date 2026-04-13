// ============================================
// L4-D / L2 Coherence Checker — ai_diagnosis 의미 정합성 검증 단위 테스트
//
// Flash LLM 응답을 mock하여 프롬프트 빌더와 violation 변환 로직을 검증한다.
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import type { CompetencyScore, ActivityTag } from "@/lib/domains/student-record/types";
import type { DiagnosisGenerationResult } from "../llm/actions/generateDiagnosis";

// Flash LLM mock (ai-client는 plan ai-sdk를 재export)
vi.mock("@/lib/domains/plan/llm/ai-sdk", () => ({
  generateObjectWithRateLimit: vi.fn(),
  generateTextWithRateLimit: vi.fn(),
}));

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

function makeScore(code: string, grade: string): CompetencyScore {
  return {
    id: `score-${code}`,
    student_id: "stu-1",
    grade_level: 2,
    competency_item: code as CompetencyScore["competency_item"],
    grade_value: grade as CompetencyScore["grade_value"],
    source: "ai",
    rubric_scores: [],
    scope: "yearly",
    reasoning: null,
    evaluation: null,
    evidence: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as CompetencyScore;
}

function makeTag(competencyItem: string, evaluation: "positive" | "negative"): ActivityTag {
  return {
    id: `tag-${competencyItem}-${evaluation}`,
    student_id: "stu-1",
    record_type: "setek",
    record_id: "rec-1",
    competency_item: competencyItem,
    evaluation,
    status: "suggested",
    evidence_summary: "예시 태그",
    tag_context: "analysis",
  } as unknown as ActivityTag;
}

function makeDiagnosis(overrides: Partial<DiagnosisGenerationResult> = {}): DiagnosisGenerationResult {
  return {
    overallGrade: "B+",
    recordDirection: "물리·천문 진로 일관성 양호",
    directionStrength: "moderate",
    directionReasoning: "진로교과 세특에 천문학 주제 반복 등장",
    strengths: [
      "[탐구역량] 물리 세특에서 광통신 심화 탐구 근거 명확",
      "[학업역량] 수학 모델링 활용 활발",
    ],
    weaknesses: [
      "[탐구역량] 결론 미기술 — 결론·제언 명시 필요",
      "[학업역량] 자기주도성 부족",
    ],
    improvements: [
      {
        priority: "높음",
        area: "탐구역량",
        gap: "결론이 명시되지 않음",
        action: "모든 탐구 보고서에 결론·제언 1문장 명시",
        outcome: "F10 해소",
      },
    ],
    recommendedMajors: ["천문우주학과", "물리학과"],
    strategyNotes: "결론 명시화 우선. 자기주도성 서술도 병행 강화.",
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("checkDiagnosisCoherence — 기본 동작", () => {
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
      usage: { inputTokens: 300, outputTokens: 50 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    const result = await checkDiagnosisCoherence(
      makeDiagnosis(),
      [makeScore("academic_inquiry", "B+")],
      [makeTag("academic_inquiry", "positive")],
    );
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.errorCount).toBe(0);
    expect(result.usage?.inputTokens).toBe(300);
  });

  it("error 위반 1건 → passed=false, errorCount=1", async () => {
    llmMock.mockResolvedValue({
      object: {
        violations: [
          {
            rule: "STRENGTHS_SCORE_MISMATCH",
            severity: "error",
            message: "탐구력 B- 등급인데 강점으로 주장",
            fieldPath: "strengths[0]",
          },
        ],
      },
      usage: { inputTokens: 300, outputTokens: 50 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    const result = await checkDiagnosisCoherence(
      makeDiagnosis(),
      [makeScore("academic_inquiry", "B-")],
      [],
    );
    expect(result.passed).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(0);
    expect(result.violations[0].rule).toBe("STRENGTHS_SCORE_MISMATCH");
    expect(result.violations[0].fieldPath).toBe("strengths[0]");
  });

  it("warning만 → passed=true, warningCount>0", async () => {
    llmMock.mockResolvedValue({
      object: {
        violations: [
          {
            rule: "DIRECTION_REASONING_EVIDENCE",
            severity: "warning",
            message: "근거가 피상적",
          },
        ],
      },
      usage: { inputTokens: 300, outputTokens: 30 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    const result = await checkDiagnosisCoherence(makeDiagnosis(), [], []);
    expect(result.passed).toBe(true);
    expect(result.warningCount).toBe(1);
  });
});

describe("checkDiagnosisCoherence — 프롬프트 빌더", () => {
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

  it("강한 역량(A+/A-)과 약한 역량(B-/C)이 프롬프트에 포함된다", async () => {
    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    await checkDiagnosisCoherence(
      makeDiagnosis(),
      [
        makeScore("academic_inquiry", "A-"),
        makeScore("career_exploration", "B-"),
        makeScore("academic_achievement", "B+"), // 중간 — 제외
      ],
      [],
      { targetMajor: "천문우주" },
    );

    expect(llmMock).toHaveBeenCalledOnce();
    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("천문우주");
    expect(userContent).toContain("탐구력 (A-)");
    expect(userContent).toContain("진로 탐색 활동과 경험 (B-)");
    expect(userContent).not.toContain("학업성취도 (B+)");
  });

  it("진단 출력의 strengths/weaknesses/improvements가 프롬프트에 인덱스와 함께 포함된다", async () => {
    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    await checkDiagnosisCoherence(makeDiagnosis(), [], []);

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("[0] [탐구역량] 물리 세특에서");
    expect(userContent).toContain("[0] [탐구역량] 결론 미기술");
    expect(userContent).toContain("priority=높음");
    expect(userContent).toContain('action="모든 탐구 보고서에 결론');
    expect(userContent).toContain("천문우주학과, 물리학과");
  });

  it("태그 긍정/부정 카운트가 영역별로 집계된다", async () => {
    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    await checkDiagnosisCoherence(
      makeDiagnosis(),
      [],
      [
        makeTag("academic_inquiry", "positive"),
        makeTag("academic_inquiry", "positive"),
        makeTag("career_exploration", "negative"),
      ],
    );

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("학업역량");
    expect(userContent).toContain("긍정 2");
    expect(userContent).toContain("진로역량");
    expect(userContent).toContain("부정 1");
  });

  it("LLM 호출 파라미터: fast tier, temperature 0.1, timeoutMs 60s", async () => {
    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    await checkDiagnosisCoherence(makeDiagnosis(), [], []);

    const call = llmMock.mock.calls[0][0];
    expect(call.modelTier).toBe("fast");
    expect(call.temperature).toBe(0.1);
    expect(call.timeoutMs).toBe(60_000);
    expect(call.maxTokens).toBe(2048);
  });
});

describe("checkDiagnosisCoherence — 에러 전파", () => {
  it("LLM 호출 실패 시 예외가 그대로 throw (호출부에서 non-fatal 처리)", async () => {
    const aiSdk = await import("@/lib/domains/plan/llm/ai-sdk");
    const llmMock = aiSdk.generateObjectWithRateLimit as MockedFunction<
      typeof aiSdk.generateObjectWithRateLimit
    >;
    llmMock.mockRejectedValue(new Error("rate limit"));

    const { checkDiagnosisCoherence } = await import(
      "../llm/validators/diagnosis-coherence-checker"
    );
    await expect(checkDiagnosisCoherence(makeDiagnosis(), [], [])).rejects.toThrow(
      "rate limit",
    );
  });
});
