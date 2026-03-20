import { describe, it, expect } from "vitest";
import { generateExplanation } from "../explanation-generator";

describe("generateExplanation", () => {
  it("3필터 전부 있을 때 3줄 생성", () => {
    const text = generateExplanation({
      targetDeptName: "경영학과",
      candidateDeptName: "경제학과",
      candidateUnivName: "서울대학교",
      curriculumSimilarity: 45.5,
      sharedCourseCount: 12,
      topSharedCourses: ["미적분", "확률통계", "경제학원론"],
      placementGrade: "possible",
      competencyFitScore: 72.3,
      competencyHighlights: ["탐구력", "학업성취도"],
    });
    expect(text).toContain("교육과정 유사도 45.5%");
    expect(text).toContain("12개 공통 과목");
    expect(text).toContain("배치 판정: 적정");
    expect(text).toContain("역량 적합도 72.3점");
    expect(text).toContain("탐구력");
  });

  it("커리큘럼만 있을 때", () => {
    const text = generateExplanation({
      targetDeptName: "물리학과",
      candidateDeptName: "천문학과",
      candidateUnivName: "연세대학교",
      curriculumSimilarity: 30,
      sharedCourseCount: 5,
      topSharedCourses: ["일반물리"],
      placementGrade: null,
      competencyFitScore: null,
      competencyHighlights: [],
    });
    expect(text).toContain("교육과정 유사도 30%");
    expect(text).not.toContain("배치 판정");
    expect(text).not.toContain("역량 적합도");
  });

  it("공통 과목 0건이면 커리큘럼 줄 생략", () => {
    const text = generateExplanation({
      targetDeptName: "A",
      candidateDeptName: "B",
      candidateUnivName: "C",
      curriculumSimilarity: 0,
      sharedCourseCount: 0,
      topSharedCourses: [],
      placementGrade: "safe",
      competencyFitScore: null,
      competencyHighlights: [],
    });
    expect(text).not.toContain("교육과정");
    expect(text).toContain("배치 판정: 안정");
  });
});
