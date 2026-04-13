// ============================================
// L4-D / L1 Deterministic Validator — suggestStrategies 출력 검증 단위 테스트
// diagnosis-validator 테스트 패턴 횡전개.
// ============================================

import { describe, it, expect } from "vitest";
import { validateStrategyOutput } from "../llm/validators/strategy-validator";
import type { SuggestStrategiesResult, StrategySuggestion } from "../llm/types";

function makeSuggestion(overrides: Partial<StrategySuggestion> = {}): StrategySuggestion {
  return {
    targetArea: "setek",
    strategyContent:
      "2학년 물리학 세특에서 의료영상 원리(CT/MRI) 탐구 보고서 작성. Beer-Lambert 법칙을 중심으로 심화 탐구.",
    priority: "high",
    reasoning: "탐구력 B- 등급으로 교과 심화 근거가 부족. 진로(의료공학)와 연계 보강 가능.",
    ...overrides,
  };
}

function makeValid(): SuggestStrategiesResult {
  return {
    suggestions: [
      makeSuggestion(),
      makeSuggestion({
        targetArea: "career",
        strategyContent:
          "진로활동에서 의공학 관련 직업인 인터뷰 + 탐구 결과 발표, 2학기 중 2회 진행.",
        priority: "medium",
        reasoning: "진로탐색 C등급. 구체적 직업 인터뷰로 역량 보강.",
      }),
      makeSuggestion({
        targetArea: "club",
        strategyContent:
          "의학탐구 동아리에서 학술지 리뷰 세션 주도, 10월까지 2편의 리뷰 발표 진행.",
        priority: "high",
        reasoning: "동아리 활동의 주도성 부족. 주도적 운영으로 자기주도성 역량 확보.",
      }),
    ],
    summary:
      "탐구력과 진로탐색 역량을 중심으로 교과 세특과 진로활동을 강화하는 전략을 제안합니다.",
  };
}

// ============================================
// 1. 정상 케이스
// ============================================

describe("validateStrategyOutput — 정상 케이스", () => {
  it("clean output passes with no violations", () => {
    const result = validateStrategyOutput(makeValid());
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });
});

// ============================================
// 2. 포맷 검증 (targetArea, priority)
// ============================================

describe("validateStrategyOutput — 포맷 검증", () => {
  it("invalid targetArea → error", () => {
    const out = makeValid();
    (out.suggestions[0] as { targetArea: string }).targetArea = "invalid_area";
    const result = validateStrategyOutput(out);
    expect(result.passed).toBe(false);
    expect(result.violations.find((v) => v.rule === "SUGGESTION_TARGET_AREA_INVALID")).toBeDefined();
  });

  it("invalid priority → error", () => {
    const out = makeValid();
    (out.suggestions[0] as { priority: string }).priority = "urgent";
    const result = validateStrategyOutput(out);
    expect(result.violations.find((v) => v.rule === "SUGGESTION_PRIORITY_INVALID")).toBeDefined();
  });
});

// ============================================
// 3. 길이/공허 (TOO_SHORT / GENERIC / EMPTY)
// ============================================

describe("validateStrategyOutput — 길이·공허 문구", () => {
  it("strategyContent empty → SUGGESTION_CONTENT_EMPTY error", () => {
    const out = makeValid();
    out.suggestions[0] = makeSuggestion({ strategyContent: "   " });
    const result = validateStrategyOutput(out);
    const v = result.violations.find((x) => x.rule === "SUGGESTION_CONTENT_EMPTY");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("error");
  });

  it("strategyContent too short → SUGGESTION_CONTENT_TOO_SHORT warning", () => {
    const out = makeValid();
    out.suggestions[0] = makeSuggestion({ strategyContent: "탐구 보고서 작성" });
    const result = validateStrategyOutput(out);
    const v = result.violations.find((x) => x.rule === "SUGGESTION_CONTENT_TOO_SHORT");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("warning");
  });

  it("strategyContent generic phrase → SUGGESTION_CONTENT_GENERIC warning", () => {
    const out = makeValid();
    out.suggestions[0] = makeSuggestion({
      strategyContent: "더 열심히 공부하고 탐구 보고서도 잘 쓰도록 노력하기",
    });
    const result = validateStrategyOutput(out);
    expect(
      result.violations.find((v) => v.rule === "SUGGESTION_CONTENT_GENERIC"),
    ).toBeDefined();
  });

  it("reasoning empty → SUGGESTION_REASONING_EMPTY error", () => {
    const out = makeValid();
    out.suggestions[0] = makeSuggestion({ reasoning: "" });
    const result = validateStrategyOutput(out);
    expect(result.violations.find((v) => v.rule === "SUGGESTION_REASONING_EMPTY")).toBeDefined();
  });

  it("reasoning too short → SUGGESTION_REASONING_TOO_SHORT warning", () => {
    const out = makeValid();
    out.suggestions[0] = makeSuggestion({ reasoning: "필요함" });
    const result = validateStrategyOutput(out);
    expect(
      result.violations.find((v) => v.rule === "SUGGESTION_REASONING_TOO_SHORT"),
    ).toBeDefined();
  });

  it("summary too short → SUMMARY_TOO_SHORT warning", () => {
    const out = makeValid();
    out.summary = "짧음";
    const result = validateStrategyOutput(out);
    expect(result.violations.find((v) => v.rule === "SUMMARY_TOO_SHORT")).toBeDefined();
  });

  it("summary empty → SUMMARY_EMPTY warning", () => {
    const out = makeValid();
    out.summary = "   ";
    const result = validateStrategyOutput(out);
    expect(result.violations.find((v) => v.rule === "SUMMARY_EMPTY")).toBeDefined();
  });
});

// ============================================
// 4. 중복
// ============================================

describe("validateStrategyOutput — 중복", () => {
  it("duplicate strategyContent → SUGGESTION_DUPLICATE error", () => {
    const out = makeValid();
    out.suggestions[1] = makeSuggestion({
      strategyContent: out.suggestions[0].strategyContent,
      targetArea: "career",
    });
    const result = validateStrategyOutput(out);
    const v = result.violations.find((x) => x.rule === "SUGGESTION_DUPLICATE");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("error");
  });
});

// ============================================
// 5. 개수 제약
// ============================================

describe("validateStrategyOutput — 개수 제약", () => {
  it("suggestions empty → SUGGESTIONS_EMPTY error", () => {
    const out: SuggestStrategiesResult = { suggestions: [], summary: "전략 도출 불가 안내 문장입니다 ..." };
    const result = validateStrategyOutput(out);
    const v = result.violations.find((x) => x.rule === "SUGGESTIONS_EMPTY");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("error");
  });

  it("suggestions < 3 → SUGGESTIONS_COUNT_TOO_FEW warning", () => {
    const out = makeValid();
    out.suggestions = [out.suggestions[0]];
    const result = validateStrategyOutput(out);
    const v = result.violations.find((x) => x.rule === "SUGGESTIONS_COUNT_TOO_FEW");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("warning");
  });

  it("suggestions > 6 → SUGGESTIONS_COUNT_TOO_MANY warning", () => {
    const out = makeValid();
    out.suggestions = Array.from({ length: 7 }, (_, i) =>
      makeSuggestion({
        strategyContent: `보완전략 ${i} — 구체적인 활동 설명과 대상 과목·시기를 포함한 세부 안.`,
      }),
    );
    const result = validateStrategyOutput(out);
    const v = result.violations.find((x) => x.rule === "SUGGESTIONS_COUNT_TOO_MANY");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("warning");
  });
});
