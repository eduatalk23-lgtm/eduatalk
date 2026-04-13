// ============================================
// L4-D / L1 Deterministic Validator — diagnosis 출력 검증 단위 테스트
// ============================================

import { describe, it, expect } from "vitest";
import { validateDiagnosisOutput } from "../llm/validators/diagnosis-validator";
import { formatViolationLabels, summarizeViolations } from "../llm/validators/types";
import type { DiagnosisGenerationResult } from "../llm/actions/generateDiagnosis";

const validImprovement = {
  priority: "높음" as const,
  area: "탐구역량",
  gap: "탐구의 결론 부분이 명시적으로 기술되지 않음",
  action: "연구 주제마다 결론·제언을 1문장 명시하도록 구조화",
  outcome: "F10 성장부재 해소, 면접 답변 가능",
};

function makeValid(): DiagnosisGenerationResult {
  return {
    overallGrade: "B+",
    recordDirection: "물리·천문 진로 일관성 양호",
    directionStrength: "moderate",
    directionReasoning: "진로교과 세특에 천문학 주제 반복 등장",
    strengths: [
      "[학업역량] 수학 — A-. 근거: 모델링 활용 활발. 증거: 태그 5건",
      "[탐구역량] 물리 — B+. 근거: 광통신 심화 탐구. 증거: 태그 4건",
      "[진로역량] 진로교과 — B+. 근거: 천문 주제 일관. 증거: 태그 6건",
    ],
    weaknesses: [
      "[탐구역량] 결론 미기술 — B. 개선: 연구 결론·제언 명시 필요",
      "[학업역량] 자기주도성 부족 — B-. 개선: 동기·과정 자기 서술 강화",
    ],
    improvements: [validImprovement, { ...validImprovement, area: "학업역량" }],
    recommendedMajors: ["천문우주학과", "물리학과"],
    strategyNotes: "진로교과 세특의 결론 명시화로 F10 해소가 1순위. 자기주도성 서술 강화는 학업역량 보강에 직결.",
  };
}

// ============================================
// 1. 정상 케이스
// ============================================

describe("validateDiagnosisOutput — 정상 케이스", () => {
  it("clean output passes with no violations", () => {
    const result = validateDiagnosisOutput(makeValid());
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });
});

// ============================================
// 2. 포맷 검증 (overallGrade, directionStrength, priority)
// ============================================

describe("validateDiagnosisOutput — 포맷 검증", () => {
  it("invalid overallGrade → error", () => {
    const out = makeValid();
    out.overallGrade = "S";
    const result = validateDiagnosisOutput(out);
    expect(result.passed).toBe(false);
    expect(result.violations.find((v) => v.rule === "OVERALL_GRADE_INVALID")).toBeDefined();
  });

  it("invalid directionStrength → error", () => {
    const out = makeValid();
    (out as { directionStrength: string }).directionStrength = "very-strong";
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "DIRECTION_STRENGTH_INVALID")).toBeDefined();
  });

  it("invalid improvement.priority → error", () => {
    const out = makeValid();
    out.improvements[0] = { ...out.improvements[0], priority: "긴급" as never };
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "IMPROVEMENT_PRIORITY_INVALID")).toBeDefined();
  });
});

// ============================================
// 3. 의미어 충돌 (강점에 부정어 / 약점에 강한 칭찬어)
// ============================================

describe("validateDiagnosisOutput — 의미어 충돌", () => {
  it("strength with negative word → STRENGTHS_NEGATIVE_WORD error", () => {
    const out = makeValid();
    out.strengths[0] = "[탐구역량] 수학 - 결론 부족하지만 시도는 활발";
    const result = validateDiagnosisOutput(out);
    const v = result.violations.find((x) => x.rule === "STRENGTHS_NEGATIVE_WORD");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("error");
    expect(v?.fieldPath).toBe("strengths[0]");
  });

  it("weakness with strong-positive word → WEAKNESSES_POSITIVE_WORD warning", () => {
    const out = makeValid();
    out.weaknesses[0] = "[탐구역량] 탁월한 시작이지만 마무리가 약함";
    const result = validateDiagnosisOutput(out);
    const v = result.violations.find((x) => x.rule === "WEAKNESSES_POSITIVE_WORD");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("warning");
  });
});

// ============================================
// 4. 길이/공허 (TOO_SHORT / GENERIC_ACTION / EMPTY)
// ============================================

describe("validateDiagnosisOutput — 길이·공허 문구", () => {
  it("strength too short → warning", () => {
    const out = makeValid();
    out.strengths[0] = "수학 잘함";
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "STRENGTHS_TOO_SHORT")).toBeDefined();
  });

  it("strength empty string → STRENGTHS_EMPTY error", () => {
    const out = makeValid();
    out.strengths[0] = "   ";
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "STRENGTHS_EMPTY")).toBeDefined();
  });

  it("improvement.action generic phrase → IMPROVEMENT_ACTION_GENERIC warning", () => {
    const out = makeValid();
    out.improvements[0] = { ...out.improvements[0], action: "더 열심히 노력하기" };
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "IMPROVEMENT_ACTION_GENERIC")).toBeDefined();
  });

  it("improvement.action too short → IMPROVEMENT_ACTION_TOO_SHORT warning", () => {
    const out = makeValid();
    out.improvements[0] = { ...out.improvements[0], action: "노력" };
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "IMPROVEMENT_ACTION_TOO_SHORT")).toBeDefined();
  });

  it("strategyNotes too short → warning", () => {
    const out = makeValid();
    out.strategyNotes = "짧음";
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "STRATEGY_NOTES_TOO_SHORT")).toBeDefined();
  });

  it("recommendedMajors empty → RECOMMENDED_MAJORS_MIN warning", () => {
    const out = makeValid();
    out.recommendedMajors = [];
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "RECOMMENDED_MAJORS_MIN")).toBeDefined();
  });
});

// ============================================
// 5. 중복
// ============================================

describe("validateDiagnosisOutput — 중복", () => {
  it("duplicate strengths → STRENGTHS_DUPLICATE error", () => {
    const out = makeValid();
    out.strengths[1] = out.strengths[0];
    const result = validateDiagnosisOutput(out);
    const v = result.violations.find((x) => x.rule === "STRENGTHS_DUPLICATE");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("error");
  });

  it("duplicate weaknesses → WEAKNESSES_DUPLICATE error", () => {
    const out = makeValid();
    out.weaknesses[1] = out.weaknesses[0];
    const result = validateDiagnosisOutput(out);
    expect(result.violations.find((v) => v.rule === "WEAKNESSES_DUPLICATE")).toBeDefined();
  });
});

// ============================================
// 6. summarize / format helpers
// ============================================

describe("violation 헬퍼", () => {
  it("summarizeViolations counts errors and warnings separately", () => {
    const r = summarizeViolations([
      { rule: "X", severity: "error", message: "" },
      { rule: "Y", severity: "warning", message: "" },
      { rule: "Z", severity: "warning", message: "" },
    ]);
    expect(r.passed).toBe(false);
    expect(r.errorCount).toBe(1);
    expect(r.warningCount).toBe(2);
  });

  it("summarizeViolations passes when no errors (warnings allowed)", () => {
    const r = summarizeViolations([
      { rule: "Y", severity: "warning", message: "warn" },
    ]);
    expect(r.passed).toBe(true);
    expect(r.errorCount).toBe(0);
    expect(r.warningCount).toBe(1);
  });

  it("formatViolationLabels yields readable strings", () => {
    const labels = formatViolationLabels([
      { rule: "STRENGTHS_NEGATIVE_WORD", severity: "error", message: "부정어 포함", fieldPath: "strengths[0]" },
    ]);
    expect(labels[0]).toContain("STRENGTHS_NEGATIVE_WORD");
    expect(labels[0]).toContain("부정어 포함");
    expect(labels[0]).toContain("strengths[0]");
  });
});
