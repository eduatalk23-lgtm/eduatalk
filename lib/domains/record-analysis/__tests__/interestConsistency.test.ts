// ============================================
// H2 / L3-B Interest Consistency Narrative — 프롬프트/액션/렌더 유닛 테스트
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildInterestConsistencyUserPrompt,
  parseInterestConsistencyResponse,
} from "../llm/prompts/interestConsistency";
import { isInterestConsistencyInputInsufficient } from "../llm/actions/extractInterestConsistency.helpers";
import { renderStudentProfileCard, enrichCardWithInterestConsistency } from "../pipeline/pipeline-task-runners-shared";
import type { InterestConsistencyInput } from "../llm/types";
import type { StudentProfileCard } from "../pipeline/pipeline-types";

vi.mock("../llm/actions/extractInterestConsistency", async (importActual) => {
  const actual = await importActual<typeof import("../llm/actions/extractInterestConsistency")>();
  return {
    ...actual,
    extractInterestConsistency: vi.fn(),
  };
});

import { extractInterestConsistency } from "../llm/actions/extractInterestConsistency";

const baseInput: InterestConsistencyInput = {
  priorSchoolYears: [2024, 2025],
  themes: [
    { id: "social-minority", label: "사회적 약자 이해", years: [2024, 2025], affectedSubjects: ["수학", "사회"] },
  ],
  careerTrajectory: {
    byYear: [
      { year: 2024, averageNumericGrade: 3.0 },
      { year: 2025, averageNumericGrade: 4.5 },
    ],
    trend: "rising",
    growthDelta: 1.5,
  },
  persistentStrengths: [{ competencyItem: "탐구역량", bestGrade: "A+" }],
  persistentWeaknesses: [{ competencyItem: "공동체역량", worstGrade: "C" }],
};

// ============================================
// 1. user prompt builder
// ============================================

describe("buildInterestConsistencyUserPrompt", () => {
  it("renders all sections when full input present", () => {
    const prompt = buildInterestConsistencyUserPrompt(baseInput);
    expect(prompt).toContain("2024~2025학년도");
    expect(prompt).toContain("학년 관통 테마");
    expect(prompt).toContain("`social-minority`");
    expect(prompt).toContain("진로역량 추이");
    expect(prompt).toContain("[상승]");
    expect(prompt).toContain("(Δ +1.5)");
    expect(prompt).toContain("지속 강점");
    expect(prompt).toContain("탐구역량 (A+)");
    expect(prompt).toContain("지속 약점");
    expect(prompt).toContain("공동체역량 (C)");
    expect(prompt).toContain("JSON으로만 응답");
  });

  it("renders single-year label when priorSchoolYears length=1", () => {
    const prompt = buildInterestConsistencyUserPrompt({ ...baseInput, priorSchoolYears: [2025] });
    expect(prompt).toContain("2025학년도 (총 1년)");
    expect(prompt).not.toContain("2025~");
  });

  it("emits '없음' marker when themes empty", () => {
    const prompt = buildInterestConsistencyUserPrompt({ ...baseInput, themes: [] });
    expect(prompt).toContain("이전 학년 dominant 테마 미감지");
  });

  it("includes targetMajor and priorSetekHighlights when provided", () => {
    const prompt = buildInterestConsistencyUserPrompt({
      ...baseInput,
      targetMajor: "사회복지학",
      priorSetekHighlights: [
        { schoolYear: 2024, subjectName: "수학", snippet: "통계로 분배 분석" },
        { schoolYear: 2025, snippet: "정책 비교" },
      ],
    });
    expect(prompt).toContain("목표 전공: 사회복지학");
    expect(prompt).toContain("이전 학년 세특 단서");
    expect(prompt).toContain("2024 | 수학 | 통계로 분배 분석");
    expect(prompt).toContain("2025 | 정책 비교");
  });

  it("omits careerTrajectory section when undefined", () => {
    const prompt = buildInterestConsistencyUserPrompt({ ...baseInput, careerTrajectory: undefined });
    expect(prompt).not.toContain("진로역량 추이");
  });
});

// ============================================
// 2. response parser
// ============================================

describe("parseInterestConsistencyResponse", () => {
  const validIds = new Set(["social-minority", "data-modeling"]);

  it("parses valid response and filters sourceThemeIds against validThemeIds", () => {
    const content = "```json\n" + JSON.stringify({
      narrative: "사회적 약자 통계 분석에서 분배 정책으로 심화됨.",
      sourceThemeIds: ["social-minority", "unknown-theme", "Bad Slug"],
      confidence: 0.85,
    }) + "\n```";
    const result = parseInterestConsistencyResponse(content, validIds);
    expect(result).not.toBeNull();
    expect(result!.narrative).toBe("사회적 약자 통계 분석에서 분배 정책으로 심화됨.");
    expect(result!.sourceThemeIds).toEqual(["social-minority"]);
    expect(result!.confidence).toBe(0.85);
  });

  it("returns null when narrative missing/empty", () => {
    expect(parseInterestConsistencyResponse(JSON.stringify({ narrative: "", confidence: 0.5 }), validIds)).toBeNull();
    expect(parseInterestConsistencyResponse(JSON.stringify({ confidence: 0.5 }), validIds)).toBeNull();
  });

  it("returns null on JSON parse failure", () => {
    expect(parseInterestConsistencyResponse("not json at all", validIds)).toBeNull();
  });

  it("clamps confidence to [0,1] and defaults missing to 0.6", () => {
    const r1 = parseInterestConsistencyResponse(JSON.stringify({ narrative: "x", confidence: 1.5 }), validIds);
    expect(r1!.confidence).toBe(1);
    const r2 = parseInterestConsistencyResponse(JSON.stringify({ narrative: "x", confidence: -0.3 }), validIds);
    expect(r2!.confidence).toBe(0);
    const r3 = parseInterestConsistencyResponse(JSON.stringify({ narrative: "x" }), validIds);
    expect(r3!.confidence).toBe(0.6);
  });

  it("truncates over-long narrative to 400 chars", () => {
    const long = "가".repeat(500);
    const r = parseInterestConsistencyResponse(JSON.stringify({ narrative: long, confidence: 0.5 }), validIds);
    expect(r!.narrative.length).toBe(400);
  });

  it("returns empty sourceThemeIds when field missing", () => {
    const r = parseInterestConsistencyResponse(JSON.stringify({ narrative: "x", confidence: 0.5 }), validIds);
    expect(r!.sourceThemeIds).toEqual([]);
  });
});

// ============================================
// 3. insufficient-input gate
// ============================================

describe("isInterestConsistencyInputInsufficient", () => {
  it("returns true when no themes, no trajectory, no competency signals", () => {
    expect(isInterestConsistencyInputInsufficient({
      priorSchoolYears: [2025],
      themes: [],
      persistentStrengths: [],
      persistentWeaknesses: [],
    })).toBe(true);
  });

  it("returns false when any of themes/trajectory/competency present", () => {
    expect(isInterestConsistencyInputInsufficient({
      priorSchoolYears: [2025],
      themes: [{ id: "x", label: "x", years: [2025], affectedSubjects: ["수학"] }],
      persistentStrengths: [],
      persistentWeaknesses: [],
    })).toBe(false);
    expect(isInterestConsistencyInputInsufficient({
      priorSchoolYears: [2025],
      themes: [],
      careerTrajectory: { byYear: [{ year: 2025, averageNumericGrade: 3 }], trend: "stable", growthDelta: 0 },
      persistentStrengths: [],
      persistentWeaknesses: [],
    })).toBe(false);
    expect(isInterestConsistencyInputInsufficient({
      priorSchoolYears: [2025],
      themes: [],
      persistentStrengths: [{ competencyItem: "탐구역량", bestGrade: "A+" }],
      persistentWeaknesses: [],
    })).toBe(false);
  });
});

// ============================================
// 4. enrichCardWithInterestConsistency (LLM mocked)
// ============================================

const baseCard: StudentProfileCard = {
  priorSchoolYears: [2024, 2025],
  overallAverageGrade: "B+",
  persistentStrengths: [{ competencyItem: "탐구역량", bestGrade: "A+", years: [2024, 2025] }],
  persistentWeaknesses: [{ competencyItem: "공동체역량", worstGrade: "C", years: [2024] }],
  recurringQualityIssues: [],
  averageQualityScore: 70,
  crossGradeThemes: [
    { id: "social-minority", label: "사회적 약자 이해", years: [2024, 2025], affectedSubjects: ["수학", "사회"] },
  ],
};

describe("enrichCardWithInterestConsistency", () => {
  beforeEach(() => {
    vi.mocked(extractInterestConsistency).mockReset();
  });

  it("merges narrative on success", async () => {
    vi.mocked(extractInterestConsistency).mockResolvedValue({
      success: true,
      data: {
        narrative: "분배 문제로 심화됨.",
        sourceThemeIds: ["social-minority"],
        confidence: 0.8,
        elapsedMs: 100,
      },
    });
    const enriched = await enrichCardWithInterestConsistency(baseCard, "사회복지학");
    expect(enriched.interestConsistency).toEqual({
      narrative: "분배 문제로 심화됨.",
      sourceThemeIds: ["social-minority"],
      confidence: 0.8,
    });
    expect(extractInterestConsistency).toHaveBeenCalledTimes(1);
  });

  it("returns card unchanged on LLM failure", async () => {
    vi.mocked(extractInterestConsistency).mockResolvedValue({
      success: false,
      error: "LLM down",
    });
    const enriched = await enrichCardWithInterestConsistency(baseCard);
    expect(enriched.interestConsistency).toBeUndefined();
    expect(enriched).toEqual(baseCard);
  });

  it("returns card unchanged on thrown error (graceful)", async () => {
    vi.mocked(extractInterestConsistency).mockRejectedValue(new Error("boom"));
    const enriched = await enrichCardWithInterestConsistency(baseCard);
    expect(enriched.interestConsistency).toBeUndefined();
  });

  it("skips LLM when input is insufficient", async () => {
    const sparseCard: StudentProfileCard = {
      ...baseCard,
      crossGradeThemes: undefined,
      careerTrajectory: undefined,
      persistentStrengths: [],
      persistentWeaknesses: [],
    };
    const enriched = await enrichCardWithInterestConsistency(sparseCard);
    expect(enriched.interestConsistency).toBeUndefined();
    expect(extractInterestConsistency).not.toHaveBeenCalled();
  });

  it("does not re-call when interestConsistency already set", async () => {
    const existing: StudentProfileCard = {
      ...baseCard,
      interestConsistency: { narrative: "기존", sourceThemeIds: [], confidence: 0.5 },
    };
    const enriched = await enrichCardWithInterestConsistency(existing);
    expect(enriched).toBe(existing);
    expect(extractInterestConsistency).not.toHaveBeenCalled();
  });
});

// ============================================
// 5. renderStudentProfileCard — narrative section
// ============================================

describe("renderStudentProfileCard — interestConsistency", () => {
  it("renders narrative bullet when present", () => {
    const card: StudentProfileCard = {
      ...baseCard,
      interestConsistency: {
        narrative: "사회적 약자 통계 분석에서 분배 정책으로 심화됨.",
        sourceThemeIds: ["social-minority"],
        confidence: 0.85,
      },
    };
    const rendered = renderStudentProfileCard(card);
    expect(rendered).toContain("- 관심 일관성 서사: 사회적 약자 통계 분석에서 분배 정책으로 심화됨.");
    expect(rendered).toContain("'관심 일관성 서사'와 본 텍스트가 정합하면");
  });

  it("omits narrative section when interestConsistency undefined", () => {
    const rendered = renderStudentProfileCard(baseCard);
    expect(rendered).not.toContain("- 관심 일관성 서사");
  });

  it("omits narrative section when narrative is empty string", () => {
    const card: StudentProfileCard = {
      ...baseCard,
      interestConsistency: { narrative: "", sourceThemeIds: [], confidence: 0.5 },
    };
    const rendered = renderStudentProfileCard(card);
    expect(rendered).not.toContain("- 관심 일관성 서사");
  });
});
