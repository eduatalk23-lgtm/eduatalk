// ============================================
// L4-E / Phase 2-1: 가이드 프롬프트에 narrativeContext 주입 검증
// ============================================

import { describe, it, expect } from "vitest";
import { renderNarrativeContextSection } from "../llm/prompts/narrativeContext";
import {
  computePrioritizedWeaknessesFromInputs,
} from "../pipeline/narrative-context";
import { toGuideAnalysisContext } from "../pipeline/pipeline-task-runners-shared";
import { buildUserPrompt as buildSetekGuideUserPrompt } from "../llm/prompts/setekGuide";
import type { GradeAnalysisContext } from "../pipeline/pipeline-types";
import type { GuideAnalysisContext, SetekGuideInput } from "../llm/types";

// ============================================
// 1. computePrioritizedWeaknessesFromInputs
// ============================================

describe("computePrioritizedWeaknessesFromInputs", () => {
  it("converts C/B- competencies and counts issues", () => {
    const out = computePrioritizedWeaknessesFromInputs(
      [
        { item: "career_exploration", grade: "C", reasoning: "탐색 부족" },
        { item: "academic_attitude", grade: "B-", reasoning: null },
        { item: "academic_inquiry", grade: "B", reasoning: null },
      ],
      [
        ["P1", "F10"],
        ["P1", "F10"],
        ["P1"],
        ["P1"], // P1 count=4 → high
        ["X1"],
      ],
    );
    const codes = out.map((w) => `${w.source}:${w.code}`);
    // high competency career_exploration → high issue P1 (competency 우선) →
    // medium competency academic_attitude → medium issue F10 → low issue X1
    expect(codes[0]).toBe("competency:career_exploration");
    expect(codes[1]).toBe("issue:P1");
    expect(codes).toContain("competency:academic_attitude");
    expect(codes).toContain("issue:F10");
    expect(codes).toContain("issue:X1");
    // 낮은 등급 (B) 역량은 제외
    expect(codes).not.toContain("competency:academic_inquiry");
  });

  it("returns empty array when no weakness present", () => {
    expect(computePrioritizedWeaknessesFromInputs([], [])).toEqual([]);
  });
});

// ============================================
// 2. toGuideAnalysisContext — narrativeContext.prioritizedWeaknesses
// ============================================

describe("toGuideAnalysisContext narrativeContext", () => {
  it("populates prioritizedWeaknesses from gradeCtx (no recordPriorityOrder in pipeline path)", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 2,
      qualityIssues: [
        { recordId: "r1", recordType: "setek", issues: ["P1", "P1"], feedback: "fb1", overallScore: 60 },
        { recordId: "r2", recordType: "setek", issues: ["P1"], feedback: "fb2", overallScore: 65 },
      ],
      weakCompetencies: [
        { item: "career_exploration", grade: "C", reasoning: "탐색 부족" },
      ],
    };
    const result = toGuideAnalysisContext(gradeCtx);
    expect(result).toBeDefined();
    expect(result!.narrativeContext).toBeDefined();
    expect(result!.narrativeContext!.prioritizedWeaknesses).toBeDefined();
    expect(result!.narrativeContext!.recordPriorityOrder).toBeUndefined();
    const codes = result!.narrativeContext!.prioritizedWeaknesses!.map((w) => `${w.source}:${w.code}`);
    expect(codes[0]).toBe("competency:career_exploration");
    expect(codes).toContain("issue:P1");
  });

  it("omits narrativeContext when no weakness signals exist", () => {
    const gradeCtx: GradeAnalysisContext = {
      grade: 1,
      qualityIssues: [],
      weakCompetencies: [],
    };
    const result = toGuideAnalysisContext(gradeCtx);
    expect(result).toBeUndefined();
  });
});

// ============================================
// 3. renderNarrativeContextSection
// ============================================

describe("renderNarrativeContextSection", () => {
  it("returns empty string when ctx undefined or empty", () => {
    expect(renderNarrativeContextSection(undefined)).toBe("");
    expect(renderNarrativeContextSection({ prioritizedWeaknesses: [], recordPriorityOrder: [] })).toBe("");
    expect(renderNarrativeContextSection({})).toBe("");
  });

  it("renders prioritizedWeaknesses with severity tags", () => {
    const text = renderNarrativeContextSection({
      prioritizedWeaknesses: [
        { source: "competency", code: "career_exploration", label: "진로 탐색", severity: "high", area: "career", rationale: "C 등급", weight: 3 },
        { source: "issue", code: "P1", label: "P1", severity: "medium", rationale: "총 2건", weight: 2 },
      ],
    });
    expect(text).toContain("## 보강 우선순위");
    expect(text).toContain("**[최우선]** 진로 탐색 · career");
    expect(text).toContain("C 등급");
    expect(text).toContain("**[중요]** P1");
    expect(text).toContain("최우선");
  });

  it("renders recordPriorityOrder with record-type label and reasons (top 5, reasons top 2)", () => {
    const text = renderNarrativeContextSection({
      recordPriorityOrder: [
        {
          recordType: "setek",
          recordId: "r1",
          schoolYear: 2026,
          grade: 3,
          label: "심화수학 1학기",
          subjectName: "심화수학",
          priority: 95,
          reasons: ["진로교과", "약점 보강(진로 탐색)", "가안 미작성"],
          isEmpty: true,
        },
      ],
    });
    expect(text).toContain("## 보강 우선순위");
    expect(text).toContain("[세특] 심화수학 1학기 (3학년, 점수 95)");
    expect(text).toContain("진로교과 · 약점 보강(진로 탐색)");
    // 3번째 reason은 잘려야 함
    expect(text).not.toContain("가안 미작성");
  });

  it("limits to top 5 records", () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      recordType: "setek" as const,
      recordId: `r${i}`,
      schoolYear: 2026,
      grade: 3,
      label: `과목${i}`,
      priority: 100 - i,
      reasons: [`사유${i}`],
      isEmpty: false,
    }));
    const text = renderNarrativeContextSection({ recordPriorityOrder: records });
    expect(text).toContain("과목0");
    expect(text).toContain("과목4");
    expect(text).not.toContain("과목5");
  });
});

// ============================================
// 4. setekGuide 통합 — narrativeContext가 프롬프트 본문에 포함되는지
// ============================================

const baseSetekInput: SetekGuideInput = {
  studentName: "테스트학생",
  grade: 3,
  targetMajor: "사회복지학",
  targetGrades: [3],
  recordDataByGrade: {
    3: { seteks: [], changche: [] },
  },
};

describe("buildSetekGuideUserPrompt — narrativeContext injection", () => {
  it("includes narrative section when analysisContext.narrativeContext present", () => {
    const ctx: GuideAnalysisContext = {
      qualityIssues: [],
      weakCompetencies: [],
      narrativeContext: {
        prioritizedWeaknesses: [
          { source: "competency", code: "career_exploration", label: "진로 탐색", severity: "high", area: "career", rationale: "C", weight: 3 },
        ],
        recordPriorityOrder: [
          {
            recordType: "setek", recordId: "r1", schoolYear: 2026, grade: 3,
            label: "심화수학 1학기", priority: 90, reasons: ["진로교과"], isEmpty: true,
          },
        ],
      },
    };
    const prompt = buildSetekGuideUserPrompt({ ...baseSetekInput, analysisContext: ctx });
    expect(prompt).toContain("## 보강 우선순위");
    expect(prompt).toContain("진로 탐색");
    expect(prompt).toContain("심화수학 1학기");
  });

  it("does NOT include narrative section when analysisContext lacks narrativeContext", () => {
    const ctx: GuideAnalysisContext = {
      qualityIssues: [{ recordType: "setek", issues: ["P1"], feedback: "" }],
      weakCompetencies: [],
    };
    const prompt = buildSetekGuideUserPrompt({ ...baseSetekInput, analysisContext: ctx });
    expect(prompt).not.toContain("## 보강 우선순위");
  });
});
