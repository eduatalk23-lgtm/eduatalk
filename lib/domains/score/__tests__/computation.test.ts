/**
 * 성적 산출 엔진 단계별 검증 테스트
 *
 * 엑셀 T열 수식 기반 검산 데이터와 시스템 산출값을 비교합니다.
 */
import { describe, it, expect } from "vitest";
import {
  normSInv,
  estimatePercentile,
  estimateStdDev,
  percentileToGrade9,
  computeAdjustedGrade,
  computeRankBasedPercentile,
  computeScoreAnalysis,
} from "../computation";

// ============================================
// 1. 수학 함수 기본 검증
// ============================================
describe("normSInv (NORM.S.INV 근사)", () => {
  it("p=0.5 → z=0", () => {
    expect(normSInv(0.5)).toBeCloseTo(0, 5);
  });

  it("p=0.8413 → z≈1.0", () => {
    expect(normSInv(0.8413)).toBeCloseTo(1.0, 2);
  });

  it("p=0.1587 → z≈-1.0", () => {
    expect(normSInv(0.1587)).toBeCloseTo(-1.0, 2);
  });

  it("p=0.9772 → z≈2.0", () => {
    expect(normSInv(0.9772)).toBeCloseTo(2.0, 1);
  });

  it("극단값 처리", () => {
    expect(normSInv(0)).toBeNaN();
    expect(normSInv(1)).toBeNaN();
    expect(normSInv(-0.1)).toBeNaN();
    expect(normSInv(1.1)).toBeNaN();
  });
});

// ============================================
// 2. percentileToGrade9 경계값 테스트
// ============================================
describe("percentileToGrade9 경계값", () => {
  it("상위 4% 이하 → 1등급", () => {
    expect(percentileToGrade9(0.01)).toBe(1);
    expect(percentileToGrade9(0.04)).toBe(1);
  });

  it("상위 4% 초과 11% 이하 → 2등급", () => {
    expect(percentileToGrade9(0.05)).toBe(2);
    expect(percentileToGrade9(0.11)).toBe(2);
  });

  it("상위 11% 초과 23% 이하 → 3등급", () => {
    expect(percentileToGrade9(0.12)).toBe(3);
    expect(percentileToGrade9(0.23)).toBe(3);
  });

  it("상위 23% 초과 40% 이하 → 4등급", () => {
    expect(percentileToGrade9(0.24)).toBe(4);
    expect(percentileToGrade9(0.40)).toBe(4);
  });

  it("상위 96% 초과 → 9등급", () => {
    expect(percentileToGrade9(0.97)).toBe(9);
    expect(percentileToGrade9(1.0)).toBe(9);
  });

  it("정확히 0 → 1등급", () => {
    expect(percentileToGrade9(0)).toBe(1);
  });
});

// ============================================
// 3. estimatePercentile — 엑셀 T열 수식 검증
// ============================================
describe("estimatePercentile — 엑셀 T열 선형보간", () => {
  it("A등급, rawScore=96, ratioA=14.8 → 0.0592 (5등급 grade1)", () => {
    // 엑셀: (14.8/100) × ((100-96)/10) = 0.148 × 0.4 = 0.0592
    // 5등급 grade1 bounds: [0+0.001, 0.1-0.001] = [0.001, 0.099]
    // MEDIAN(0.0592, 0.001, 0.099) = 0.0592
    const result = estimatePercentile({
      rawScore: 96,
      achievementLevel: "A",
      ratioA: 14.8,
      ratioB: 22.1,
      ratioC: 32.2,
      ratioD: 30.2,
      ratioE: 0.7,
      rankGrade: 1,
      gradeSystem: 5,
    });
    expect(result).toBeCloseTo(0.0592, 3);
  });

  it("A등급, rawScore=96, ratioA=14.8 → 0.039 (9등급 grade1)", () => {
    // 엑셀: achievementPct = 0.0592
    // 9등급 grade1 bounds: [0+0.001, 0.04-0.001] = [0.001, 0.039]
    // MEDIAN(0.0592, 0.001, 0.039) = 0.039 (clamped to upper bound)
    const result = estimatePercentile({
      rawScore: 96,
      achievementLevel: "A",
      ratioA: 14.8,
      ratioB: 22.1,
      ratioC: 32.2,
      ratioD: 30.2,
      ratioE: 0.7,
      rankGrade: 1,
      gradeSystem: 9,
    });
    expect(result).toBeCloseTo(0.039, 3);
  });

  it("B등급, rawScore=81, 통합과학 데이터 (9등급 grade3)", () => {
    // 엑셀: rA + rB × ((90-81)/10) = 0.328 + 0.29 × 0.9 = 0.589
    // 9등급 grade3 bounds: [0.11+0.001, 0.23-0.001] = [0.111, 0.229]
    // MEDIAN(0.589, 0.111, 0.229) = 0.229
    const result = estimatePercentile({
      rawScore: 81,
      achievementLevel: "B",
      ratioA: 32.8,
      ratioB: 29,
      ratioC: 6.6,
      ratioD: 11.6,
      ratioE: 20.1,
      rankGrade: 3,
      gradeSystem: 9,
    });
    expect(result).toBeCloseTo(0.229, 3);
  });

  it("B등급, rawScore=85, 구간 내 위치 확인", () => {
    // rA + rB × ((90-85)/10) = 0.328 + 0.29 × 0.5 = 0.473
    const result = estimatePercentile({
      rawScore: 85,
      achievementLevel: "B",
      ratioA: 32.8,
      ratioB: 29,
      ratioC: 6.6,
      ratioD: 11.6,
      ratioE: 20.1,
      rankGrade: null,
      gradeSystem: 9,
    });
    expect(result).toBeCloseTo(0.473, 3);
  });

  it("C등급, rawScore=75 → (rA+rB) + rC × ((80-75)/10)", () => {
    // (0.328 + 0.29) + 0.066 × 0.5 = 0.618 + 0.033 = 0.651
    const result = estimatePercentile({
      rawScore: 75,
      achievementLevel: "C",
      ratioA: 32.8,
      ratioB: 29,
      ratioC: 6.6,
      ratioD: 11.6,
      ratioE: 20.1,
      rankGrade: null,
      gradeSystem: 9,
    });
    expect(result).toBeCloseTo(0.651, 3);
  });

  it("E등급, rawScore=30 → (rA+rB+rC+rD) + rE × ((60-30)/60)", () => {
    // (0.328+0.29+0.066+0.116) + 0.201 × (30/60) = 0.8 + 0.1005 = 0.9005
    const result = estimatePercentile({
      rawScore: 30,
      achievementLevel: "E",
      ratioA: 32.8,
      ratioB: 29,
      ratioC: 6.6,
      ratioD: 11.6,
      ratioE: 20.1,
      rankGrade: null,
      gradeSystem: 9,
    });
    expect(result).toBeCloseTo(0.9005, 3);
  });

  it("rankGrade 없으면 보간값 직접 반환", () => {
    const result = estimatePercentile({
      rawScore: 96,
      achievementLevel: "A",
      ratioA: 14.8,
      ratioB: 22.1,
      ratioC: 32.2,
      ratioD: 30.2,
      ratioE: 0.7,
      rankGrade: null,
      gradeSystem: 9,
    });
    expect(result).toBeCloseTo(0.0592, 3);
  });
});

// ============================================
// 4. computeAdjustedGrade — 엑셀 R열 검증
// ============================================
describe("computeAdjustedGrade — career 변환석차등급 (엑셀 R열)", () => {
  it("experiment → null", () => {
    const result = computeAdjustedGrade({
      subjectCategory: "experiment",
      rawScore: 85, avgScore: 70, stdDev: null, rankGrade: null,
      achievementLevel: "A", ratioA: 30, ratioB: 20, ratioC: 20, ratioD: 20, ratioE: 10,
    });
    expect(result).toBeNull();
  });

  it("career A → 항상 1", () => {
    const result = computeAdjustedGrade({
      subjectCategory: "career",
      rawScore: null, avgScore: null, stdDev: null, rankGrade: null,
      achievementLevel: "A", ratioA: 3, ratioB: 20, ratioC: 30, ratioD: 30, ratioE: 17,
    });
    expect(result).toBe(1);
  });

  it("career B → LOOKUP(ratioA) + (ratioA+ratioB)/100 (소수점)", () => {
    // ratioA=32.8 → MATCH([4,11,23,40,...], ≤32.8) → 23 → grade 3
    // + (32.8+29)/100 = 0.618
    // = 3.618
    const result = computeAdjustedGrade({
      subjectCategory: "career",
      rawScore: null, avgScore: null, stdDev: null, rankGrade: null,
      achievementLevel: "B", ratioA: 32.8, ratioB: 29, ratioC: 6.6, ratioD: 11.6, ratioE: 20.1,
    });
    expect(result).toBeCloseTo(3.618, 3);
  });

  it("career B — ratioA=5 → LOOKUP(5) → grade 1 + (5+10)/100 = 1.15", () => {
    const result = computeAdjustedGrade({
      subjectCategory: "career",
      rawScore: null, avgScore: null, stdDev: null, rankGrade: null,
      achievementLevel: "B", ratioA: 5, ratioB: 10, ratioC: 30, ratioD: 30, ratioE: 25,
    });
    // MATCH(5, [4,11,23,...], ≤5) → 4 → grade 1
    // + (5+10)/100 = 0.15
    expect(result).toBeCloseTo(1.15, 3);
  });

  it("career B — ratioA=3 → LOOKUP(3) < 4 → null (MATCH 실패)", () => {
    const result = computeAdjustedGrade({
      subjectCategory: "career",
      rawScore: null, avgScore: null, stdDev: null, rankGrade: null,
      achievementLevel: "B", ratioA: 3, ratioB: 20, ratioC: 30, ratioD: 30, ratioE: 17,
    });
    expect(result).toBeNull();
  });

  it("career C → LOOKUP(ratioA+ratioB) + 1", () => {
    // ratioA+ratioB = 32.8+29 = 61.8
    // MATCH(61.8, [4,11,23,40,60,...], ≤61.8) → 60 → grade 5
    // + 1 = 6
    const result = computeAdjustedGrade({
      subjectCategory: "career",
      rawScore: null, avgScore: null, stdDev: null, rankGrade: null,
      achievementLevel: "C", ratioA: 32.8, ratioB: 29, ratioC: 6.6, ratioD: 11.6, ratioE: 20.1,
    });
    expect(result).toBe(6);
  });

  it("career D → null", () => {
    const result = computeAdjustedGrade({
      subjectCategory: "career",
      rawScore: null, avgScore: null, stdDev: null, rankGrade: null,
      achievementLevel: "D", ratioA: 10, ratioB: 20, ratioC: 30, ratioD: 25, ratioE: 15,
    });
    expect(result).toBeNull();
  });

  it("career E → null", () => {
    const result = computeAdjustedGrade({
      subjectCategory: "career",
      rawScore: null, avgScore: null, stdDev: null, rankGrade: null,
      achievementLevel: "E", ratioA: 10, ratioB: 20, ratioC: 30, ratioD: 25, ratioE: 15,
    });
    expect(result).toBeNull();
  });
});

describe("computeAdjustedGrade — regular (엑셀 R열)", () => {
  it("표준편차 있음 + 석차등급 없음 → null", () => {
    const result = computeAdjustedGrade({
      subjectCategory: "regular",
      rawScore: 85, avgScore: 70, stdDev: 12.5, rankGrade: null,
      achievementLevel: "B", ratioA: 30, ratioB: 20, ratioC: 20, ratioD: 20, ratioE: 10,
    });
    expect(result).toBeNull();
  });

  it("Z등급 < 석차등급 → Z등급 (유리한 값)", () => {
    // Z = (96-76.3)/12.64 ≈ 1.559 → percentile ≈ 0.060 → grade 2
    // min(rankGrade=3, zGrade=2) = 2
    const result = computeAdjustedGrade({
      subjectCategory: "regular",
      rawScore: 96, avgScore: 76.3, stdDev: 12.64, rankGrade: 3,
      achievementLevel: "A", ratioA: 14.8, ratioB: 22.1, ratioC: 32.2, ratioD: 30.2, ratioE: 0.7,
    });
    expect(result).toBeLessThanOrEqual(3);
  });

  it("Z등급 > 석차등급 → 석차등급 (유리한 값)", () => {
    // Z = (81-78.4)/12.5 = 0.208 → percentile ≈ 0.418 → grade 5
    // min(rankGrade=3, zGrade=5) = 3
    const result = computeAdjustedGrade({
      subjectCategory: "regular",
      rawScore: 81, avgScore: 78.4, stdDev: 12.5, rankGrade: 3,
      achievementLevel: "B", ratioA: 32.8, ratioB: 29, ratioC: 6.6, ratioD: 11.6, ratioE: 20.1,
    });
    expect(result).toBe(3);
  });
});

// ============================================
// 5. 국어 1-1 검증 — stdDev=null → "career" (5등급)
// ============================================
describe("국어 1-1 — 5등급, stdDev=null (career)", () => {
  const input = {
    rawScore: 96,
    avgScore: 76.3,
    stdDev: null as number | null,
    rankGrade: 1,
    achievementLevel: "A",
    ratioA: 14.8,
    ratioB: 22.1,
    ratioC: 32.2,
    ratioD: 30.2,
    ratioE: 0.7,
    totalStudents: 298,
    classRank: null as number | null,
    subjectCategory: "career" as const, // stdDev=null → career
    gradeSystem: 5 as const,
  };

  it("기대값: 백분위≈0.059, 추정표준편차≈12.64, 9등급변환=2, 조정등급=1", () => {
    const result = computeScoreAnalysis(input);

    expect(result.estimatedPercentile).toBeCloseTo(0.0592, 3);
    expect(result.estimatedStdDev).toBeCloseTo(12.64, 0);
    expect(result.convertedGrade9).toBe(2);
    // career + A = 1
    expect(result.adjustedGrade).toBe(1);
  });
});

// ============================================
// 6. 국어 1-1 — 9등급 (경계 클램핑)
// ============================================
describe("국어 1-1 — 9등급, stdDev=null (career)", () => {
  const input = {
    rawScore: 96,
    avgScore: 76.3,
    stdDev: null as number | null,
    rankGrade: 1,
    achievementLevel: "A",
    ratioA: 14.8,
    ratioB: 22.1,
    ratioC: 32.2,
    ratioD: 30.2,
    ratioE: 0.7,
    totalStudents: 298,
    classRank: null as number | null,
    subjectCategory: "career" as const, // stdDev=null → career
    gradeSystem: 9 as const,
  };

  it("9등급 grade1에서는 MEDIAN이 0.039로 클램핑", () => {
    const result = computeScoreAnalysis(input);

    expect(result.estimatedPercentile).toBeCloseTo(0.039, 3);
    expect(result.convertedGrade9).toBe(1);
    // career + A = 1
    expect(result.adjustedGrade).toBe(1);
  });
});

// ============================================
// 7. 통합과학 — 핵심 시나리오 검증
// ============================================
describe("통합과학 데이터 검증", () => {
  const baseInput = {
    rawScore: 81,
    avgScore: 78.4,
    rankGrade: 3,
    achievementLevel: "B",
    ratioA: 32.8,
    ratioB: 29,
    ratioC: 6.6,
    ratioD: 11.6,
    ratioE: 20.1,
    totalStudents: 259,
    classRank: null as number | null,
    subjectCategory: "regular" as const,
    gradeSystem: 9 as const,
  };

  it("stdDev=12.5 입력 시", () => {
    const result = computeScoreAnalysis({ ...baseInput, stdDev: 12.5 });

    expect(result.estimatedStdDev).toBe(12.5);
    // achievementPct=0.589, 9등급 grade3: [0.111, 0.229]
    // MEDIAN(0.589, 0.111, 0.229) = 0.229
    expect(result.estimatedPercentile).toBeCloseTo(0.229, 3);
    expect(result.convertedGrade9).toBe(3);
    expect(result.adjustedGrade).toBe(3);
  });

  it("stdDev=null 시 — career 경로 (표준편차 추정 + 조정등급=career B)", () => {
    const result = computeScoreAnalysis({
      ...baseInput,
      stdDev: null,
      subjectCategory: "career" as const, // stdDev=null → career
    });

    expect(result.estimatedPercentile).toBeCloseTo(0.229, 3);
    expect(result.convertedGrade9).toBe(3);
    expect(result.estimatedStdDev).not.toBeNull();
    // career B: LOOKUP(32.8) + (32.8+29)/100 = 3 + 0.618 = 3.618
    expect(result.adjustedGrade).toBeCloseTo(3.618, 3);
  });
});

// ============================================
// 7-2. 통합과학 — 5등급 (올바른 gradeSystem)
// ============================================
describe("통합과학 — 5등급 (gradeSystem=5)", () => {
  const input = {
    rawScore: 81,
    avgScore: 78.4,
    stdDev: 11.57929946,
    rankGrade: 3,
    achievementLevel: "B",
    ratioA: 32.8,
    ratioB: 29,
    ratioC: 6.6,
    ratioD: 11.6,
    ratioE: 20.1,
    totalStudents: 259,
    classRank: null as number | null,
    subjectCategory: "regular" as const,
    gradeSystem: 5 as const,
  };

  it("엑셀 일치: percentile=0.589, stdDev=11.579, grade9=5, adjustedGrade=3", () => {
    const result = computeScoreAnalysis(input);

    // T열: achievementPct = 0.328 + 0.29×0.9 = 0.589
    // 5등급 grade3 bounds: [0.34+0.001, 0.66-0.001] = [0.341, 0.659]
    // MEDIAN(0.589, 0.341, 0.659) = 0.589 (구간 내)
    expect(result.estimatedPercentile).toBeCloseTo(0.589, 3);

    // stdDev는 사용자 입력값 그대로
    expect(result.estimatedStdDev).toBeCloseTo(11.579, 2);

    // V열: percentileToGrade9(0.589) = 5 (0.589 ≤ 0.60)
    expect(result.convertedGrade9).toBe(5);

    // R열: regular, MIN(zGrade, rankGrade)
    // Z = (81-78.4)/11.579 ≈ 0.2245 → normalCdf ≈ 0.589
    // percentile = 1-0.589 = 0.411 → grade 5
    // MIN(3, 5) = 3
    expect(result.adjustedGrade).toBe(3);
  });

  it("stdDev=null → career 경로 (5등급)", () => {
    const result = computeScoreAnalysis({
      ...input,
      stdDev: null,
      subjectCategory: "career" as const,
    });

    // T열: 동일하게 0.589
    expect(result.estimatedPercentile).toBeCloseTo(0.589, 3);

    // V열: 5
    expect(result.convertedGrade9).toBe(5);

    // R열: career B → LOOKUP(32.8) + (32.8+29)/100 = 3.618
    expect(result.adjustedGrade).toBeCloseTo(3.618, 3);

    // U열: 추정 표준편차 계산됨
    expect(result.estimatedStdDev).not.toBeNull();
  });
});

// ============================================
// 8. 석차 활용 백분위 검증
// ============================================
describe("computeRankBasedPercentile", () => {
  it("석차 있으면 (rank - 0.5) / total", () => {
    const result = computeRankBasedPercentile({
      classRank: 5,
      totalStudents: 100,
      fallbackPercentile: 0.5,
    });
    expect(result).toBeCloseTo(0.045, 4);
  });

  it("석차 없으면 fallback 사용", () => {
    const result = computeRankBasedPercentile({
      classRank: null,
      totalStudents: 100,
      fallbackPercentile: 0.23,
    });
    expect(result).toBe(0.23);
  });
});

// ============================================
// 9. estimateStdDev 검증
// ============================================
describe("estimateStdDev", () => {
  it("기본 추정 (percentile=0.229)", () => {
    const result = estimateStdDev({
      rawScore: 81,
      avgScore: 78.4,
      percentile: 0.229,
      totalStudents: 259,
    });

    // |81-78.4| = 2.6
    // normSInv(0.771) ≈ 0.743
    // bessel = √(259/258) ≈ 1.00194
    // 2.6 / 0.743 × 1.00194 ≈ 3.50
    expect(result).toBeCloseTo(3.50, 0);
  });

  it("percentile 0.5 → null (Z=0)", () => {
    const result = estimateStdDev({
      rawScore: 78.4,
      avgScore: 78.4,
      percentile: 0.5,
      totalStudents: 100,
    });
    expect(result).toBeNull();
  });

  it("totalStudents <= 1 → null", () => {
    const result = estimateStdDev({
      rawScore: 90,
      avgScore: 80,
      percentile: 0.1,
      totalStudents: 1,
    });
    expect(result).toBeNull();
  });
});
