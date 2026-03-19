import { describe, it, expect } from "vitest";
import {
  parseReplacementCounts,
  calculateReplacementProbability,
  buildReplacementInfo,
} from "../placement/engine";

// ─── parseReplacementCounts ─────────────────────

describe("parseReplacementCounts", () => {
  it("정상 3개년 파싱 → 연도 내림차순", () => {
    const result = parseReplacementCounts({ "2025": "5", "2024": "3", "2023": "7" });
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ year: "2025", count: 5 });
    expect(result[1]).toEqual({ year: "2024", count: 3 });
    expect(result[2]).toEqual({ year: "2023", count: 7 });
  });

  it("비숫자 값 스킵 ('-', '해당없음')", () => {
    const result = parseReplacementCounts({ "2025": "5", "2024": "-", "2023": "해당없음" });
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(5);
  });

  it("null → 빈 배열", () => {
    expect(parseReplacementCounts(null)).toEqual([]);
  });

  it("undefined → 빈 배열", () => {
    expect(parseReplacementCounts(undefined)).toEqual([]);
  });

  it("빈 객체 → 빈 배열", () => {
    expect(parseReplacementCounts({})).toEqual([]);
  });

  it("소수점 충원 인원 파싱", () => {
    const result = parseReplacementCounts({ "2025": "3.5" });
    expect(result[0].count).toBe(3.5);
  });
});

// ─── calculateReplacementProbability ────────────

describe("calculateReplacementProbability", () => {
  it("빈 데이터 → 0", () => {
    expect(calculateReplacementProbability([], 300, 320)).toBe(0);
  });

  it("직접 합격 (studentScore ≥ admissionAvg) → 1", () => {
    const counts = [{ year: "2025", count: 5 }];
    expect(calculateReplacementProbability(counts, 320, 320)).toBe(1);
    expect(calculateReplacementProbability(counts, 330, 320)).toBe(1);
  });

  it("높은 충원 (10명+) → 높은 base probability", () => {
    const counts = [{ year: "2025", count: 10 }, { year: "2024", count: 10 }];
    // 학생이 cutoff 바로 아래 (gap 매우 작음)
    const prob = calculateReplacementProbability(counts, 319, 320);
    expect(prob).toBeGreaterThan(0.5);
  });

  it("낮은 충원 (1명) → 낮은 base probability", () => {
    const counts = [{ year: "2025", count: 1 }];
    const prob = calculateReplacementProbability(counts, 319, 320);
    expect(prob).toBeLessThan(0.2);
  });

  it("입결 대비 5% 이상 부족 → gapFactor 0", () => {
    const counts = [{ year: "2025", count: 20 }];
    // 320 * 0.95 = 304 → 300은 5% 이상 부족
    const prob = calculateReplacementProbability(counts, 300, 320);
    expect(prob).toBe(0);
  });

  it("높은 분산 → 확률 감소", () => {
    const stableCounts = [{ year: "2025", count: 5 }, { year: "2024", count: 5 }];
    const volatileCounts = [{ year: "2025", count: 1 }, { year: "2024", count: 9 }];
    // 동일 평균(5), 다른 분산
    const stableProb = calculateReplacementProbability(stableCounts, 318, 320);
    const volatileProb = calculateReplacementProbability(volatileCounts, 318, 320);
    expect(stableProb).toBeGreaterThan(volatileProb);
  });

  it("admissionAvg null → 0", () => {
    const counts = [{ year: "2025", count: 10 }];
    expect(calculateReplacementProbability(counts, 300, null)).toBe(0);
  });

  it("admissionAvg 0 → 0", () => {
    const counts = [{ year: "2025", count: 10 }];
    expect(calculateReplacementProbability(counts, 300, 0)).toBe(0);
  });
});

// ─── buildReplacementInfo ───────────────────────

describe("buildReplacementInfo", () => {
  it("충원 데이터 없음 → null", () => {
    expect(buildReplacementInfo(null, 300, 320)).toBeNull();
    expect(buildReplacementInfo({}, 300, 320)).toBeNull();
  });

  it("정상 3개년 데이터 → 구조 검증", () => {
    const info = buildReplacementInfo(
      { "2025": "5", "2024": "3", "2023": "7" },
      315,
      320,
    );

    expect(info).not.toBeNull();
    expect(info!.historicalCounts).toHaveLength(3);
    expect(info!.averageCount).toBe(5); // (5+3+7)/3 = 5
    expect(info!.probability).toBeGreaterThanOrEqual(0);
    expect(info!.probability).toBeLessThanOrEqual(1);
    expect(["high", "moderate", "low", "none"]).toContain(info!.probabilityLevel);
    expect(info!.message).toBeTruthy();
  });

  it("직접 합격 시 메시지", () => {
    const info = buildReplacementInfo(
      { "2025": "5" },
      325,
      320,
    );

    expect(info!.probability).toBe(1);
    expect(info!.message).toBe("직접 합격 가능 (충원 불필요)");
  });

  it("확률 등급 경계 — high (≥70%)", () => {
    // 충원 많고 (20명), cutoff 바로 아래
    const info = buildReplacementInfo(
      { "2025": "20", "2024": "20" },
      319.5,
      320,
    );

    expect(info!.probabilityLevel).toBe("high");
    expect(info!.message).toContain("높음");
  });

  it("확률 등급 — none (충원 0명)", () => {
    const info = buildReplacementInfo(
      { "2025": "0", "2024": "0" },
      315,
      320,
    );

    expect(info!.probabilityLevel).toBe("none");
    expect(info!.message).toBe("충원 없음");
  });

  it("averageCount 반올림 (소수점 1자리)", () => {
    const info = buildReplacementInfo(
      { "2025": "4", "2024": "3", "2023": "5" },
      310,
      320,
    );

    expect(info!.averageCount).toBe(4); // (4+3+5)/3 = 4.0
  });
});
