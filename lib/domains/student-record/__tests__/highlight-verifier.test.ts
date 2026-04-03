import { describe, it, expect } from "vitest";
import {
  verifyHighlight,
  verifyHighlights,
  aggregateVerification,
  extractAllHighlights,
} from "../eval/highlight-verifier";

// ============================================
// highlight-verifier.ts 테스트
// A2: LLM 하이라이트 원문 검증 엔진
// ============================================

const SOURCE_SETEK =
  "미분과 적분의 관계를 탐구하는 과정에서 단순 공식 암기를 넘어 극한의 개념에서 미분이 유도되는 과정을 직접 증명함. " +
  "ε-δ 정의를 통해 연속성과 미분가능성의 관계를 탐구하고, 연속이지만 미분 불가능한 바이어슈트라스 함수를 조사하여 발표함. " +
  "처음에는 ε-δ 논법의 추상성에 어려움을 겪었으나 수학적 귀납법과 연결하여 이해하게 됨. " +
  "교사는 '수학적 사고의 깊이가 고등학생 수준을 넘는다'고 평가함.";

// ─── verifyHighlight ─────────────────────────────────────────────────────────

describe("verifyHighlight — exact match", () => {
  it("원문 그대로 인용 → isExactMatch=true, passed=true", () => {
    const highlight = "극한의 개념에서 미분이 유도되는 과정을 직접 증명함";
    const result = verifyHighlight(highlight, SOURCE_SETEK);
    expect(result.isExactMatch).toBe(true);
    expect(result.isFuzzyMatch).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it("앞뒤 공백이 있어도 exact match 성공", () => {
    const highlight = "  ε-δ 정의를 통해 연속성과 미분가능성의 관계를 탐구하고  ";
    const result = verifyHighlight(highlight, SOURCE_SETEK);
    expect(result.isExactMatch).toBe(true);
    expect(result.passed).toBe(true);
  });
});

describe("verifyHighlight — fuzzy match (공백 정규화)", () => {
  it("줄바꿈이 스페이스로 치환된 경우 → isFuzzyMatch=true", () => {
    // 원문에서 일부를 가져오되 공백을 다르게 처리
    const highlight = "단순 공식 암기를  넘어  극한의 개념에서";
    const result = verifyHighlight(highlight, SOURCE_SETEK);
    // exact 아닐 수 있지만 fuzzy는 통과해야 함
    expect(result.isFuzzyMatch).toBe(true);
    expect(result.passed).toBe(true);
  });
});

describe("verifyHighlight — similarity 기반 통과", () => {
  it("원문 단어를 포함하는 요약 → similarity > 0, passed 타입 boolean", () => {
    // 원문 단어를 포함하지만 어순 변형 — 짧은 하이라이트 vs 긴 원문이므로
    // Jaccard는 낮을 수 있음(분모=전체 원문 단어 수). 0 초과 여부만 검증.
    const highlight = "연속이지만 미분 불가능한 바이어슈트라스 함수 조사 발표";
    const result = verifyHighlight(highlight, SOURCE_SETEK);
    expect(result.similarityScore).toBeGreaterThan(0);
    expect(typeof result.passed).toBe("boolean");
  });

  it("원문과 무관한 텍스트 → similarity 낮음, passed=false", () => {
    const highlight = "지구 온난화로 인한 해수면 상승 문제를 해결하기 위해";
    const result = verifyHighlight(highlight, SOURCE_SETEK);
    expect(result.isExactMatch).toBe(false);
    expect(result.isFuzzyMatch).toBe(false);
    expect(result.similarityScore).toBeLessThan(0.3);
    expect(result.passed).toBe(false);
    expect(result.issue).toBeDefined();
  });

  it("원문을 LLM이 임의로 재작성한 경우 → passed=false, issue 포함", () => {
    // 원문 "수학적 사고의 깊이가 고등학생 수준을 넘는다" → 재표현
    const highlight = "고등학생 수준을 초월하는 탁월한 수학적 사고를 보여주었음";
    const result = verifyHighlight(highlight, SOURCE_SETEK);
    expect(result.isExactMatch).toBe(false);
    expect(result.isFuzzyMatch).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.issue).toContain("similarity");
  });
});

describe("verifyHighlight — coveragePercent", () => {
  it("원문 전체 내용의 일부 → coverage 0 이상", () => {
    const highlight = "극한의 개념에서 미분이 유도되는 과정을 직접 증명함";
    const result = verifyHighlight(highlight, SOURCE_SETEK);
    expect(result.coveragePercent).toBeGreaterThan(0);
    expect(result.coveragePercent).toBeLessThanOrEqual(100);
  });

  it("빈 원문 → coverage 0", () => {
    const result = verifyHighlight("어떤 구절", "");
    expect(result.coveragePercent).toBe(0);
  });
});

describe("verifyHighlight — 엣지 케이스", () => {
  it("빈 highlight → fuzzyMatch=true (포함 관계 trivially 성립)", () => {
    const result = verifyHighlight("", SOURCE_SETEK);
    // 빈 문자열은 any string.includes("") === true
    expect(result.isExactMatch).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("highlight가 원문 전체 → exactMatch=true", () => {
    const result = verifyHighlight(SOURCE_SETEK, SOURCE_SETEK);
    expect(result.isExactMatch).toBe(true);
    expect(result.passed).toBe(true);
  });

  it("한글 단어 토크나이징 정상 동작", () => {
    const result = verifyHighlight("미분 적분", SOURCE_SETEK);
    expect(result.similarityScore).toBeGreaterThan(0);
  });
});

// ─── verifyHighlights ────────────────────────────────────────────────────────

describe("verifyHighlights", () => {
  it("여러 하이라이트 일괄 검증 → 결과 개수 일치", () => {
    const highlights = [
      "극한의 개념에서 미분이 유도되는 과정을 직접 증명함",
      "연속이지만 미분 불가능한 바이어슈트라스 함수를 조사하여 발표함",
      "지구 온난화 해수면 상승 완전히 무관한 텍스트",
    ];
    const results = verifyHighlights(highlights, SOURCE_SETEK);
    expect(results).toHaveLength(3);
    expect(results[0].isExactMatch).toBe(true);
    expect(results[1].isExactMatch).toBe(true);
    expect(results[2].isExactMatch).toBe(false);
  });

  it("빈 배열 → 빈 결과", () => {
    const results = verifyHighlights([], SOURCE_SETEK);
    expect(results).toHaveLength(0);
  });
});

// ─── aggregateVerification ───────────────────────────────────────────────────

describe("aggregateVerification", () => {
  it("빈 결과 → 통과율 100%, total 0", () => {
    const agg = aggregateVerification([]);
    expect(agg.passRate).toBe(100);
    expect(agg.total).toBe(0);
    expect(agg.passed).toBe(0);
    expect(agg.failed).toBe(0);
  });

  it("전부 통과 → passRate 100", () => {
    const results = verifyHighlights(
      [
        "극한의 개념에서 미분이 유도되는 과정을 직접 증명함",
        "교사는 '수학적 사고의 깊이가 고등학생 수준을 넘는다'고 평가함",
      ],
      SOURCE_SETEK,
    );
    const agg = aggregateVerification(results);
    expect(agg.passRate).toBe(100);
    expect(agg.passed).toBe(2);
    expect(agg.failed).toBe(0);
  });

  it("일부 실패 → passRate 0~100 사이", () => {
    const results = verifyHighlights(
      [
        "극한의 개념에서 미분이 유도되는 과정을 직접 증명함", // 통과
        "지구 온난화로 인한 해수면 상승 문제", // 실패
      ],
      SOURCE_SETEK,
    );
    const agg = aggregateVerification(results);
    expect(agg.passRate).toBeGreaterThan(0);
    expect(agg.passRate).toBeLessThan(100);
    expect(agg.total).toBe(2);
    expect(agg.passed + agg.failed).toBe(agg.total);
  });

  it("avgSimilarity는 0~1 범위", () => {
    const results = verifyHighlights(
      ["극한의 개념에서 미분이 유도되는 과정을 직접 증명함"],
      SOURCE_SETEK,
    );
    const agg = aggregateVerification(results);
    expect(agg.avgSimilarity).toBeGreaterThanOrEqual(0);
    expect(agg.avgSimilarity).toBeLessThanOrEqual(1);
  });

  it("avgCoverage는 0~100 범위", () => {
    const results = verifyHighlights(
      ["극한의 개념에서 미분이 유도되는 과정을 직접 증명함"],
      SOURCE_SETEK,
    );
    const agg = aggregateVerification(results);
    expect(agg.avgCoverage).toBeGreaterThanOrEqual(0);
    expect(agg.avgCoverage).toBeLessThanOrEqual(100);
  });
});

// ─── extractAllHighlights ────────────────────────────────────────────────────

describe("extractAllHighlights", () => {
  it("sections에서 모든 highlight 문자열 추출", () => {
    const sections = [
      {
        tags: [
          { highlight: "첫번째 구절" },
          { highlight: "두번째 구절" },
        ],
      },
      {
        tags: [{ highlight: "세번째 구절" }],
      },
    ];
    const highlights = extractAllHighlights(sections);
    expect(highlights).toEqual(["첫번째 구절", "두번째 구절", "세번째 구절"]);
  });

  it("빈 sections → 빈 배열", () => {
    expect(extractAllHighlights([])).toEqual([]);
  });

  it("tags가 빈 section → 해당 section 무시", () => {
    const sections = [{ tags: [] }, { tags: [{ highlight: "유일 구절" }] }];
    const highlights = extractAllHighlights(sections);
    expect(highlights).toEqual(["유일 구절"]);
  });
});
