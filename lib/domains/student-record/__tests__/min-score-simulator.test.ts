import { describe, it, expect } from "vitest";
import { simulateMinScore, analyzeSubjectImpact } from "../min-score-simulator";
import type { MinScoreCriteria } from "../types";

// ============================================
// 1. simulateMinScore — 등급합 (grade_sum)
// ============================================

describe("simulateMinScore — grade_sum", () => {
  const criteria3합6: MinScoreCriteria = {
    type: "grade_sum",
    subjects: ["국어", "수학", "영어", "탐구1"],
    count: 3,
    maxSum: 6,
    additional: [],
  };

  it("3합6 충족 (1+2+3=6)", () => {
    const result = simulateMinScore(criteria3합6, { "국어": 1, "수학": 2, "영어": 3, "탐구1": 4 });
    expect(result.isMet).toBe(true);
    expect(result.gradeSum).toBe(6); // 최소 3개: 1+2+3
    expect(result.gap).toBe(0);
  });

  it("3합6 여유 (1+1+2=4)", () => {
    const result = simulateMinScore(criteria3합6, { "국어": 1, "수학": 1, "영어": 2, "탐구1": 3 });
    expect(result.isMet).toBe(true);
    expect(result.gradeSum).toBe(4);
    expect(result.gap).toBe(2);
  });

  it("3합6 미달 (2+3+3=8)", () => {
    const result = simulateMinScore(criteria3합6, { "국어": 2, "수학": 3, "영어": 3, "탐구1": 4 });
    expect(result.isMet).toBe(false);
    expect(result.gradeSum).toBe(8);
    expect(result.gap).toBe(-2);
    expect(result.bottleneckSubjects.length).toBeGreaterThan(0);
  });

  it("최적 조합 선택 (4개 중 3개 최소)", () => {
    // 1, 2, 4, 5 → 최소 3개 = 1+2+4=7 → 미달
    const result = simulateMinScore(criteria3합6, { "국어": 1, "수학": 2, "영어": 4, "탐구1": 5 });
    expect(result.gradeSum).toBe(7); // 최소 조합
    expect(result.isMet).toBe(false);
  });

  const criteria2합5: MinScoreCriteria = {
    type: "grade_sum",
    subjects: ["국어", "수학", "영어", "탐구1"],
    count: 2,
    maxSum: 5,
    additional: [],
  };

  it("2합5 충족 (1+3=4)", () => {
    const result = simulateMinScore(criteria2합5, { "국어": 1, "수학": 3, "영어": 4, "탐구1": 5 });
    expect(result.isMet).toBe(true);
    expect(result.gradeSum).toBe(4);
  });

  it("2합5 미달 (3+3=6)", () => {
    const result = simulateMinScore(criteria2합5, { "국어": 3, "수학": 3, "영어": 4, "탐구1": 5 });
    expect(result.isMet).toBe(false);
    expect(result.gradeSum).toBe(6);
    expect(result.gap).toBe(-1);
  });
});

// ============================================
// 2. simulateMinScore — 추가 조건 (한국사 등)
// ============================================

describe("simulateMinScore — additional conditions", () => {
  const criteriaWithHistory: MinScoreCriteria = {
    type: "grade_sum",
    subjects: ["국어", "수학", "영어"],
    count: 3,
    maxSum: 6,
    additional: [{ subject: "한국사", maxGrade: 4 }],
  };

  it("등급합 충족 + 한국사 충족", () => {
    const result = simulateMinScore(criteriaWithHistory, {
      "국어": 1, "수학": 2, "영어": 3, "한국사": 2,
    });
    expect(result.isMet).toBe(true);
  });

  it("등급합 충족 but 한국사 미달", () => {
    const result = simulateMinScore(criteriaWithHistory, {
      "국어": 1, "수학": 2, "영어": 3, "한국사": 5,
    });
    expect(result.isMet).toBe(false);
    expect(result.bottleneckSubjects).toContain("한국사");
  });

  it("등급합 미달 + 한국사도 미달", () => {
    const result = simulateMinScore(criteriaWithHistory, {
      "국어": 3, "수학": 3, "영어": 3, "한국사": 5,
    });
    expect(result.isMet).toBe(false);
    expect(result.bottleneckSubjects).toContain("한국사");
    expect(result.gap).toBeLessThan(0);
  });

  it("한국사 미응시 (등급 없음)", () => {
    const result = simulateMinScore(criteriaWithHistory, {
      "국어": 1, "수학": 2, "영어": 3,
    });
    expect(result.isMet).toBe(false);
    expect(result.bottleneckSubjects).toContain("한국사");
  });
});

// ============================================
// 3. simulateMinScore — 최저 없음 (none)
// ============================================

describe("simulateMinScore — none", () => {
  it("최저 없는 전형은 항상 충족", () => {
    const criteria: MinScoreCriteria = {
      type: "none",
      subjects: [],
      count: 0,
      maxSum: 0,
      additional: [],
    };
    const result = simulateMinScore(criteria, { "국어": 5, "수학": 6 });
    expect(result.isMet).toBe(true);
    expect(result.gradeSum).toBeNull();
  });
});

// ============================================
// 4. simulateMinScore — what-if 시나리오
// ============================================

describe("simulateMinScore — what-if", () => {
  it("수학 3→2 개선 시 what-if 생성", () => {
    const criteria: MinScoreCriteria = {
      type: "grade_sum",
      subjects: ["국어", "수학", "영어"],
      count: 3,
      maxSum: 6,
      additional: [],
    };
    const result = simulateMinScore(criteria, { "국어": 1, "수학": 3, "영어": 3 });
    expect(result.isMet).toBe(false); // 1+3+3=7
    expect(result.whatIf).toHaveProperty("if_수학_2");
    expect(result.whatIf["if_수학_2"].isMet).toBe(true); // 1+2+3=6
    expect(result.whatIf["if_수학_2"].newSum).toBe(6);
  });

  it("이미 1등급인 과목은 what-if 없음", () => {
    const criteria: MinScoreCriteria = {
      type: "grade_sum",
      subjects: ["국어", "수학"],
      count: 2,
      maxSum: 4,
      additional: [],
    };
    const result = simulateMinScore(criteria, { "국어": 1, "수학": 3 });
    expect(result.whatIf).not.toHaveProperty("if_국어_0");
    expect(result.whatIf).toHaveProperty("if_수학_2");
  });
});

// ============================================
// 5. analyzeSubjectImpact
// ============================================

describe("analyzeSubjectImpact", () => {
  const targets = [
    {
      criteria: {
        type: "grade_sum" as const,
        subjects: ["국어", "수학", "영어"],
        count: 3, maxSum: 6, additional: [],
      },
    },
    {
      criteria: {
        type: "grade_sum" as const,
        subjects: ["국어", "수학", "영어"],
        count: 2, maxSum: 4, additional: [],
      },
    },
  ];

  it("수학 3→2 개선 시 추가 충족 대학 계산", () => {
    const grades = { "국어": 1, "수학": 3, "영어": 3 };
    const result = analyzeSubjectImpact(targets, grades, "수학", 2);
    // 현재: 3합6 미달(7), 2합4 충족(1+3=4) → 1개 충족
    // 개선: 3합6 충족(1+2+3=6), 2합4 충족(1+2=3) → 2개 충족
    expect(result.currentMet).toBe(1);
    expect(result.afterMet).toBe(2);
    expect(result.additionalMet).toBe(1);
  });
});
