// ============================================
// L4-D / L3 Targeted Repair — ai_diagnosis 단위 테스트
//
// Flash LLM을 mock하여 수리 대상 필드 추출, 프롬프트 빌더, 병합 로직 검증.
// ============================================

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import type { CompetencyScore } from "@/lib/domains/student-record/types";
import type { DiagnosisGenerationResult } from "../llm/actions/generateDiagnosis";
import type { Violation } from "../llm/validators/types";

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

function makeDiagnosis(overrides: Partial<DiagnosisGenerationResult> = {}): DiagnosisGenerationResult {
  return {
    overallGrade: "B+",
    recordDirection: "물리 탐구 진로 일관성 양호",
    directionStrength: "moderate",
    directionReasoning: "물리 세특 반복 등장",
    strengths: [
      "[탐구역량] 물리 세특 심화 탐구 근거 명확",
      "[학업역량] 수학 모델링 활발",
    ],
    weaknesses: [
      "[탐구역량] 결론 미기술",
      "[학업역량] 자기주도성 부족",
    ],
    improvements: [
      {
        priority: "높음",
        area: "탐구역량",
        gap: "결론 명시 부재",
        action: "모든 탐구 보고서에 결론·제언 1문장 명시",
        outcome: "F10 해소",
      },
    ],
    recommendedMajors: ["물리학과"],
    strategyNotes: "결론 명시화 우선. 자기주도성 서술도 병행 강화. 충분한 서술 필요.",
    ...overrides,
  };
}

function v(rule: string, severity: "error" | "warning", fieldPath?: string): Violation {
  return { rule, severity, message: `${rule} msg`, fieldPath };
}

// ─────────────────────────────────────────────
// extractRepairTargetFields
// ─────────────────────────────────────────────

describe("extractRepairTargetFields", () => {
  it("error 위반의 최상위 필드만 추출 (repairable 필드 한정)", async () => {
    const { extractRepairTargetFields } = await import(
      "../llm/validators/diagnosis-repair"
    );
    const fields = extractRepairTargetFields([
      v("STRENGTHS_NEGATIVE_WORD", "error", "strengths[0]"),
      v("IMPROVEMENTS_WEAKNESS_LINK", "error", "improvements[1].action"),
      v("STRATEGY_NOTES_ALIGNMENT", "error", "strategyNotes"),
    ]);
    expect(fields).toEqual(["improvements", "strategyNotes", "strengths"]);
  });

  it("repairable 필드가 아닌 위반은 제외", async () => {
    const { extractRepairTargetFields } = await import(
      "../llm/validators/diagnosis-repair"
    );
    // overallGrade / directionStrength는 fallback 처리 — repair 대상 아님
    const fields = extractRepairTargetFields([
      v("OVERALL_GRADE_INVALID", "error", "overallGrade"),
      v("DIRECTION_STRENGTH_INVALID", "error", "directionStrength"),
    ]);
    expect(fields).toEqual([]);
  });

  it("warning severity는 error 필터 이전 단계에서 제외됨 — 호출자가 필터링 필요", async () => {
    const { extractRepairTargetFields } = await import(
      "../llm/validators/diagnosis-repair"
    );
    // 함수는 전달된 violations에서 repairable 필드만 추출. severity 필터링은 repairDiagnosis 쪽 책임.
    const fields = extractRepairTargetFields([
      v("STRENGTHS_TOO_SHORT", "warning", "strengths[0]"),
    ]);
    expect(fields).toEqual(["strengths"]);
  });
});

// ─────────────────────────────────────────────
// repairDiagnosis — 전체 흐름
// ─────────────────────────────────────────────

describe("repairDiagnosis — 기본 동작", () => {
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

  it("error 없으면 repair 건너뜀, LLM 호출 0회", async () => {
    const { repairDiagnosis } = await import("../llm/validators/diagnosis-repair");
    const result = await repairDiagnosis(
      makeDiagnosis(),
      [v("STRENGTHS_TOO_SHORT", "warning", "strengths[0]")],
      [],
      [],
    );
    expect(result.repaired).toBe(false);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("repairable 필드가 아닌 error만 있으면 repair 건너뜀", async () => {
    const { repairDiagnosis } = await import("../llm/validators/diagnosis-repair");
    const result = await repairDiagnosis(
      makeDiagnosis(),
      [v("OVERALL_GRADE_INVALID", "error", "overallGrade")],
      [],
      [],
    );
    expect(result.repaired).toBe(false);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("strengths error 시 LLM 호출 + strengths 필드만 병합", async () => {
    llmMock.mockResolvedValue({
      object: {
        strengths: [
          "[탐구역량] 물리 CT 심화 탐구 우수 — 광학 원리 설명 명료",
          "[학업역량] 모델링 활용 꾸준",
        ],
      },
      usage: { inputTokens: 400, outputTokens: 80 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { repairDiagnosis } = await import("../llm/validators/diagnosis-repair");
    const original = makeDiagnosis();
    const result = await repairDiagnosis(
      original,
      [v("STRENGTHS_NEGATIVE_WORD", "error", "strengths[0]")],
      [makeScore("academic_inquiry", "A-")],
      [],
      { targetMajor: "물리학" },
    );

    expect(result.repaired).toBe(true);
    expect(result.repairedFieldPaths).toEqual(["strengths"]);
    expect(result.output.strengths[0]).toContain("CT 심화");
    // 다른 필드는 원본 그대로
    expect(result.output.weaknesses).toEqual(original.weaknesses);
    expect(result.output.improvements).toEqual(original.improvements);
    expect(result.output.strategyNotes).toEqual(original.strategyNotes);
    expect(result.usage.inputTokens).toBe(400);
  });

  it("여러 필드 동시 repair", async () => {
    llmMock.mockResolvedValue({
      object: {
        weaknesses: ["[탐구역량] 결론·제언 누락 — 서술 보강 필요"],
        strategyNotes:
          "결론 명시화를 최우선으로 진행하고, 자기주도성 서술은 2학기 탐구 프로젝트에서 강화합니다. 구체 사례 병행.",
      },
      usage: { inputTokens: 500, outputTokens: 120 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { repairDiagnosis } = await import("../llm/validators/diagnosis-repair");
    const result = await repairDiagnosis(
      makeDiagnosis(),
      [
        v("WEAKNESSES_SCORE_MISMATCH", "error", "weaknesses[0]"),
        v("STRATEGY_NOTES_ALIGNMENT", "error", "strategyNotes"),
      ],
      [],
      [],
    );

    expect(result.repaired).toBe(true);
    expect(result.repairedFieldPaths).toEqual(["strategyNotes", "weaknesses"]);
    expect(result.output.weaknesses[0]).toContain("결론·제언 누락");
    expect(result.output.strategyNotes).toContain("결론 명시화");
  });

  it("LLM 호출 파라미터: fast tier, temperature 0.2, timeoutMs 90s", async () => {
    llmMock.mockResolvedValue({
      object: { strengths: ["재생성된 강점 항목 — 충분한 길이로 서술"] },
      usage: { inputTokens: 100, outputTokens: 30 },
    } as Awaited<ReturnType<typeof llmMock>>);

    const { repairDiagnosis } = await import("../llm/validators/diagnosis-repair");
    await repairDiagnosis(
      makeDiagnosis(),
      [v("STRENGTHS_NEGATIVE_WORD", "error", "strengths[0]")],
      [],
      [],
    );

    const call = llmMock.mock.calls[0][0];
    expect(call.modelTier).toBe("fast");
    expect(call.temperature).toBe(0.2);
    expect(call.timeoutMs).toBe(90_000);
    expect(call.maxTokens).toBe(3072);
  });

  it("LLM 실패 시 예외 throw (호출부에서 non-fatal 처리)", async () => {
    llmMock.mockRejectedValue(new Error("rate limit"));

    const { repairDiagnosis } = await import("../llm/validators/diagnosis-repair");
    await expect(
      repairDiagnosis(
        makeDiagnosis(),
        [v("STRENGTHS_NEGATIVE_WORD", "error", "strengths[0]")],
        [],
        [],
      ),
    ).rejects.toThrow("rate limit");
  });
});

// ─────────────────────────────────────────────
// buildUserPrompt
// ─────────────────────────────────────────────

describe("buildUserPrompt", () => {
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
      object: {},
      usage: { inputTokens: 0, outputTokens: 0 },
    } as Awaited<ReturnType<typeof llmMock>>);
  });

  it("원본 진단 전체 + 위반 + targetMajor가 프롬프트에 포함", async () => {
    const { repairDiagnosis } = await import("../llm/validators/diagnosis-repair");
    await repairDiagnosis(
      makeDiagnosis(),
      [v("STRENGTHS_NEGATIVE_WORD", "error", "strengths[0]")],
      [makeScore("academic_inquiry", "A-"), makeScore("career_exploration", "B-")],
      [],
      { targetMajor: "물리학" },
    );

    const call = llmMock.mock.calls[0][0];
    const userContent = (call.messages as Array<{ content: string }>)[0].content;

    expect(userContent).toContain("물리학");
    expect(userContent).toContain("강한 역량");
    expect(userContent).toContain("약한 역량");
    expect(userContent).toContain("[0] [탐구역량] 물리 세특 심화 탐구");
    expect(userContent).toContain("strengths");
    expect(userContent).toContain("STRENGTHS_NEGATIVE_WORD");
    expect(userContent).toContain("요청된 필드만");
  });
});
