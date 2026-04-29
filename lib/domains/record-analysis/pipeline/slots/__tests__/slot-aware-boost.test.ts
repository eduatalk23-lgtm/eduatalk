import { describe, expect, it } from "vitest";
import {
  applyDiversityPenalty,
  computeSlotBoost,
  extractBestSlotScoreByGuide,
  extractTop1CountByGuide,
  HARD_PENALTY_FACTOR,
  MAX_PER_GUIDE_TOP1,
  SLOT_BOOST_BONUS_SUM,
  SLOT_BOOST_MAX,
  SOFT_PENALTY_PER_USE,
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

describe("extractTop1CountByGuide", () => {
  it("빈 입력 → 빈 Map", () => {
    expect(extractTop1CountByGuide([]).size).toBe(0);
  });

  it("슬롯별 Top-1 만 카운트 (Top-2 이하 무시)", () => {
    const result = extractTop1CountByGuide([
      {
        candidates: [
          { guideId: "g1" },
          { guideId: "g2" },
        ],
      },
      {
        candidates: [
          { guideId: "g1" },
          { guideId: "g3" },
        ],
      },
      {
        candidates: [
          { guideId: "g3" },
        ],
      },
    ]);
    expect(result.get("g1")).toBe(2);
    expect(result.get("g2")).toBeUndefined();
    expect(result.get("g3")).toBe(1);
  });

  it("빈 candidates 슬롯 skip", () => {
    const result = extractTop1CountByGuide([{ candidates: [] }]);
    expect(result.size).toBe(0);
  });
});

describe("applyDiversityPenalty", () => {
  it("top1Count=0 → 원본 점수 (no penalty)", () => {
    expect(applyDiversityPenalty(40, 0)).toBe(40);
  });

  it("top1Count=1 → soft -5", () => {
    expect(applyDiversityPenalty(40, 1)).toBe(40 - SOFT_PENALTY_PER_USE);
  });

  it("top1Count=MAX → hard ×0.5", () => {
    expect(applyDiversityPenalty(40, MAX_PER_GUIDE_TOP1)).toBeCloseTo(40 * HARD_PENALTY_FACTOR);
  });

  it("top1Count > MAX → hard ×0.5 (변화 없음)", () => {
    expect(applyDiversityPenalty(40, MAX_PER_GUIDE_TOP1 + 3)).toBeCloseTo(40 * HARD_PENALTY_FACTOR);
  });

  it("soft penalty 결과 음수 → 0 으로 clamp", () => {
    expect(applyDiversityPenalty(2, 1)).toBe(0);
  });

  it("페널티 적용 후 boost 도 함께 감소 (통합)", () => {
    const raw = SLOT_BOOST_BONUS_SUM; // 만점
    const boostFull = computeSlotBoost(raw);
    const boostHard = computeSlotBoost(applyDiversityPenalty(raw, MAX_PER_GUIDE_TOP1));
    expect(boostFull).toBeCloseTo(1 + SLOT_BOOST_MAX);
    expect(boostHard).toBeLessThan(boostFull);
    expect(boostHard).toBeGreaterThanOrEqual(1);
  });
});
