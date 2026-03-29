import { describe, it, expect } from "vitest";
import {
  calculateCompetencyFitScore,
  resolveCareerField,
  getTopCompetencyItems,
} from "../competency-matcher";

describe("resolveCareerField", () => {
  it("알려진 중분류 매핑", () => {
    expect(resolveCareerField("경영ㆍ경제")).toBe("경영·경제");
    expect(resolveCareerField("전기ㆍ전자ㆍ컴퓨터")).toBe("컴퓨터·정보");
    expect(resolveCareerField("의료")).toBe("의학·약학");
  });

  it("예체능 → 매핑된 전공 반환", () => {
    expect(resolveCareerField("미술")).toBe("미술");
    expect(resolveCareerField("음악")).toBe("음악");
    expect(resolveCareerField("무용ㆍ체육")).toBe("체육");
  });

  it("null → null", () => {
    expect(resolveCareerField(null)).toBeNull();
  });

  it("미등록 → null", () => {
    expect(resolveCareerField("알수없는분류")).toBeNull();
  });
});

describe("calculateCompetencyFitScore", () => {
  const fullScores = [
    { competency_item: "academic_achievement", grade_value: "A+" },
    { competency_item: "academic_attitude", grade_value: "A-" },
    { competency_item: "academic_inquiry", grade_value: "B+" },
    { competency_item: "career_course_effort", grade_value: "B" },
    { competency_item: "career_course_achievement", grade_value: "B+" },
    { competency_item: "career_exploration", grade_value: "A-" },
    { competency_item: "community_collaboration", grade_value: "B" },
    { competency_item: "community_caring", grade_value: "B+" },
    { competency_item: "community_integrity", grade_value: "B" },
    { competency_item: "community_leadership", grade_value: "B-" },
  ];

  it("빈 점수 → null", () => {
    expect(calculateCompetencyFitScore([], "의학·약학")).toBeNull();
  });

  it("의학·약학 계열 — 학업성취도 가중치 높음", () => {
    const medScore = calculateCompetencyFitScore(fullScores, "의학·약학");
    const defaultScore = calculateCompetencyFitScore(fullScores, null);
    // 의학·약학은 학업성취도(A+, 1.8배) 가중치 때문에 기본보다 높아야 함
    expect(medScore).not.toBeNull();
    expect(defaultScore).not.toBeNull();
    expect(medScore!).toBeGreaterThan(defaultScore!);
  });

  it("컴퓨터·정보 계열 — 탐구력 가중치 높음", () => {
    const csScore = calculateCompetencyFitScore(fullScores, "컴퓨터·정보");
    expect(csScore).not.toBeNull();
    expect(csScore!).toBeGreaterThan(0);
  });

  it("미등록 계열 → 균등 가중치 사용", () => {
    const score = calculateCompetencyFitScore(fullScores, "알수없는계열");
    const defaultScore = calculateCompetencyFitScore(fullScores, null);
    expect(score).toBe(defaultScore);
  });
});

describe("getTopCompetencyItems", () => {
  it("상위 3개 항목 반환", () => {
    const scores = [
      { competency_item: "academic_achievement", grade_value: "A+" },
      { competency_item: "academic_inquiry", grade_value: "A+" },
      { competency_item: "community_caring", grade_value: "C" },
    ];
    const top = getTopCompetencyItems(scores, "의학·약학", 2);
    expect(top).toHaveLength(2);
    expect(top[0]).toBe("학업성취도"); // 가중치 1.8 × 100
    expect(top[1]).toBe("탐구력"); // 가중치 1.5 × 100
  });
});
