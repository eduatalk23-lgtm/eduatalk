// ============================================
// M2 Reliability 신뢰도 밴드 primitive — 단위 테스트 (2026-04-20)
// ============================================

import { describe, it, expect } from "vitest";
import {
  bandFromScore,
  clamp01,
  deriveBandFromAnswerQuality,
  deriveConfidenceFromLlmMeta,
  scoreFromSignals,
  CONFIDENCE_THRESHOLDS,
} from "../reliability/confidence-band";

describe("bandFromScore", () => {
  it("임계값 경계: 0.85 → high", () => {
    expect(bandFromScore(0.85)).toBe("high");
    expect(bandFromScore(0.9)).toBe("high");
    expect(bandFromScore(1.0)).toBe("high");
  });
  it("0.6 ~ 0.849 → medium", () => {
    expect(bandFromScore(CONFIDENCE_THRESHOLDS.medium)).toBe("medium");
    expect(bandFromScore(0.7)).toBe("medium");
    expect(bandFromScore(0.849)).toBe("medium");
  });
  it("<0.6 → low", () => {
    expect(bandFromScore(0)).toBe("low");
    expect(bandFromScore(0.5)).toBe("low");
    expect(bandFromScore(0.599)).toBe("low");
  });
  it("NaN/Infinity → low", () => {
    expect(bandFromScore(Number.NaN)).toBe("low");
    expect(bandFromScore(Number.POSITIVE_INFINITY)).toBe("low");
  });
});

describe("clamp01 / scoreFromSignals", () => {
  it("clamp01 기본 동작", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });
  it("scoreFromSignals: weight 순차 곱", () => {
    const s = scoreFromSignals(1.0, [
      { code: "a", description: "", weight: 0.5 },
      { code: "b", description: "", weight: 0.8 },
    ]);
    expect(s).toBeCloseTo(0.4);
  });
  it("scoreFromSignals: weight 초과 범위 clamp", () => {
    const s = scoreFromSignals(1.0, [
      { code: "a", description: "", weight: 1.5 },
    ]);
    expect(s).toBeCloseTo(1.0);
  });
});

describe("deriveConfidenceFromLlmMeta", () => {
  it("llm_v1 advanced + 정상 → high", () => {
    const r = deriveConfidenceFromLlmMeta({
      engine: "llm_v1",
      tier: "advanced",
      fallbackOccurred: false,
      engineError: null,
      outputTokens: 500,
    });
    expect(r.band).toBe("high");
    expect(r.reasons).toHaveLength(0);
    expect(r.deferToConsultant).toBe(false);
  });

  it("llm_v1 standard + 정상 → medium", () => {
    const r = deriveConfidenceFromLlmMeta({
      engine: "llm_v1",
      tier: "standard",
      fallbackOccurred: false,
      engineError: null,
      outputTokens: 200,
    });
    expect(r.band).toBe("medium");
  });

  it("rule_v1 + 정상 → medium", () => {
    const r = deriveConfidenceFromLlmMeta({
      engine: "rule_v1",
      tier: null,
      fallbackOccurred: false,
    });
    expect(r.band).toBe("medium");
  });

  it("fallback 발생 → 감점으로 band 하락", () => {
    const r = deriveConfidenceFromLlmMeta({
      engine: "llm_v1",
      tier: "advanced",
      fallbackOccurred: true,
    });
    // 0.92 * 0.7 = 0.644 → medium
    expect(r.band).toBe("medium");
    expect(r.reasons.some((x) => x.code === "fallback_occurred")).toBe(true);
  });

  it("engineError + 낮은 token + 느린 실행 → low 로 defer", () => {
    const r = deriveConfidenceFromLlmMeta({
      engine: "llm_v1",
      tier: "standard",
      fallbackOccurred: false,
      engineError: "rate limit hit",
      outputTokens: 20,
      elapsedMs: 70_000,
    });
    // 0.82 * 0.85 * 0.88 * 0.92 ≈ 0.564
    expect(r.band).toBe("low");
    expect(r.deferToConsultant).toBe(true);
    expect(r.reasons.map((x) => x.code).sort()).toEqual([
      "engine_error",
      "low_token_usage",
      "slow_execution",
    ]);
  });

  it("missing tier 는 standard fallback", () => {
    const r = deriveConfidenceFromLlmMeta({
      engine: "llm_v1",
    });
    expect(r.band).toBe("medium"); // 0.82
  });

  it("guidance 문구는 band 별 상이", () => {
    const high = deriveConfidenceFromLlmMeta({
      engine: "llm_v1",
      tier: "advanced",
    });
    const low = deriveConfidenceFromLlmMeta({
      engine: "llm_v1",
      tier: "standard",
      fallbackOccurred: true,
      engineError: "x",
      outputTokens: 10,
    });
    expect(high.guidance).toMatch(/안정적/);
    expect(low.guidance).toMatch(/defer/);
  });
});

describe("deriveBandFromAnswerQuality", () => {
  it("consistency+authenticity 평균 + gap 없음 → score 그대로", () => {
    const r = deriveBandFromAnswerQuality({
      consistencyScore: 90,
      authenticityScore: 80,
      gapCount: 0,
    });
    // avg = 85 → 0.85 → high
    expect(r.band).toBe("high");
  });

  it("gap 1~2건 → 약간 감점", () => {
    const r = deriveBandFromAnswerQuality({
      consistencyScore: 80,
      authenticityScore: 80,
      gapCount: 2,
    });
    // 0.8 * 0.95 = 0.76 → medium
    expect(r.band).toBe("medium");
    expect(r.reasons[0].code).toBe("some_gaps");
  });

  it("gap 3+ → 강한 감점", () => {
    const r = deriveBandFromAnswerQuality({
      consistencyScore: 80,
      authenticityScore: 70,
      gapCount: 5,
    });
    // avg=75 → 0.75 * 0.85 = 0.6375 → medium (경계 근처)
    expect(r.band).toBe("medium");
    expect(r.reasons[0].code).toBe("many_gaps");
  });

  it("0 점 답변 → low", () => {
    const r = deriveBandFromAnswerQuality({
      consistencyScore: 0,
      authenticityScore: 0,
    });
    expect(r.band).toBe("low");
  });
});
