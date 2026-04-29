import { describe, expect, it } from "vitest";
import {
  computeSlotBoost,
  extractBestSlotScoreByGuide,
  SLOT_BOOST_BONUS_SUM,
  SLOT_BOOST_MAX,
} from "../slot-aware-boost";

describe("computeSlotBoost", () => {
  it("0 점 → 1.0 (no boost)", () => {
    expect(computeSlotBoost(0)).toBeCloseTo(1.0);
  });

  it("최대치(67) → 1 + MAX", () => {
    expect(computeSlotBoost(SLOT_BOOST_BONUS_SUM)).toBeCloseTo(1 + SLOT_BOOST_MAX);
  });

  it("중간(33.5) → 1 + MAX/2", () => {
    expect(computeSlotBoost(SLOT_BOOST_BONUS_SUM / 2)).toBeCloseTo(1 + SLOT_BOOST_MAX / 2);
  });

  it("음수 → 1.0 (clamp)", () => {
    expect(computeSlotBoost(-10)).toBeCloseTo(1.0);
  });

  it("초과(100) → 1 + MAX (clamp)", () => {
    expect(computeSlotBoost(100)).toBeCloseTo(1 + SLOT_BOOST_MAX);
  });
});

describe("extractBestSlotScoreByGuide", () => {
  it("빈 입력 → 빈 Map", () => {
    expect(extractBestSlotScoreByGuide([]).size).toBe(0);
  });

  it("가이드 별 max(totalScore) 추출", () => {
    const result = extractBestSlotScoreByGuide([
      {
        candidates: [
          { guideId: "g1", breakdown: { totalScore: 30 } },
          { guideId: "g2", breakdown: { totalScore: 50 } },
        ],
      },
      {
        candidates: [
          { guideId: "g1", breakdown: { totalScore: 45 } },
          { guideId: "g2", breakdown: { totalScore: 20 } },
        ],
      },
    ]);
    expect(result.get("g1")).toBe(45);
    expect(result.get("g2")).toBe(50);
  });

  it("동일 가이드 여러 슬롯 — 최대 채택", () => {
    const result = extractBestSlotScoreByGuide([
      { candidates: [{ guideId: "g1", breakdown: { totalScore: 10 } }] },
      { candidates: [{ guideId: "g1", breakdown: { totalScore: 5 } }] },
      { candidates: [{ guideId: "g1", breakdown: { totalScore: 25 } }] },
    ]);
    expect(result.get("g1")).toBe(25);
  });
});
