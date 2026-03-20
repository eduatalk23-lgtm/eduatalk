import { describe, it, expect } from "vitest";
import {
  calculateCurriculumSimilarity,
  calculateWeightedCurriculumSimilarity,
  normalizeCourseNameForComparison,
  COURSE_TYPE_WEIGHTS,
  DEFAULT_COURSE_TYPE_WEIGHT,
  type CourseWithType,
} from "../similarity-engine";

describe("normalizeCourseNameForComparison", () => {
  it("공백/특수문자/로마 숫자 정규화", () => {
    expect(normalizeCourseNameForComparison("미적분 Ⅰ")).toBe("미적분1");
    expect(normalizeCourseNameForComparison("물리학 Ⅱ")).toBe("물리학2");
  });

  it("괄호 내용 제거", () => {
    expect(normalizeCourseNameForComparison("전기와자기(필수)")).toBe("전기와자기");
  });
});

describe("calculateCurriculumSimilarity (비가중)", () => {
  it("동일 과목 100%", () => {
    const courses = ["미적분", "선형대수", "확률통계"];
    const result = calculateCurriculumSimilarity(courses, courses);
    expect(result.overlapScore).toBe(100);
    expect(result.sharedCourses).toHaveLength(3);
  });

  it("겹침 없음 0%", () => {
    const result = calculateCurriculumSimilarity(["미적분"], ["한국사"]);
    expect(result.overlapScore).toBe(0);
  });

  it("빈 배열", () => {
    const result = calculateCurriculumSimilarity([], []);
    expect(result.overlapScore).toBe(0);
  });
});

describe("calculateWeightedCurriculumSimilarity (가중치)", () => {
  const makeCourse = (name: string, type: string | null): CourseWithType => ({
    courseName: name,
    courseType: type,
  });

  it("전공필수 겹침이 교양 겹침보다 높은 점수", () => {
    const target: CourseWithType[] = [
      makeCourse("미적분", "전공필수"),
      makeCourse("영어회화", "교양필수"),
    ];
    const candidateA: CourseWithType[] = [
      makeCourse("미적분", "전공필수"),
      makeCourse("한국사", "교양필수"),
    ];
    const candidateB: CourseWithType[] = [
      makeCourse("물리학", "전공필수"),
      makeCourse("영어회화", "교양필수"),
    ];

    const resultA = calculateWeightedCurriculumSimilarity(target, candidateA);
    const resultB = calculateWeightedCurriculumSimilarity(target, candidateB);

    // 전공필수 겹침(가중치 3.0) > 교양필수 겹침(가중치 1.0)
    expect(resultA.weightedOverlapScore).toBeGreaterThan(resultB.weightedOverlapScore);
  });

  it("비가중 overlapScore도 함께 반환", () => {
    const a: CourseWithType[] = [makeCourse("미적분", "전공필수")];
    const b: CourseWithType[] = [makeCourse("미적분", "전공필수")];
    const result = calculateWeightedCurriculumSimilarity(a, b);
    expect(result.overlapScore).toBe(100);
    expect(result.weightedOverlapScore).toBe(100);
  });

  it("course_type null → 기본 가중치 적용", () => {
    const a: CourseWithType[] = [makeCourse("미적분", null)];
    const b: CourseWithType[] = [makeCourse("미적분", null)];
    const result = calculateWeightedCurriculumSimilarity(a, b);
    expect(result.weightedOverlapScore).toBe(100);
    expect(result.sharedCoursesDetail[0].weight).toBe(DEFAULT_COURSE_TYPE_WEIGHT);
  });

  it("빈 배열 → 0점", () => {
    const result = calculateWeightedCurriculumSimilarity([], []);
    expect(result.weightedOverlapScore).toBe(0);
    expect(result.overlapScore).toBe(0);
  });

  it("sharedCoursesDetail에 가중치 포함", () => {
    const a: CourseWithType[] = [
      makeCourse("미적분", "전공필수"),
      makeCourse("선형대수", "전공선택"),
    ];
    const b: CourseWithType[] = [
      makeCourse("미적분", "전공필수"),
      makeCourse("선형대수", "전공기초"),
    ];
    const result = calculateWeightedCurriculumSimilarity(a, b);
    expect(result.sharedCoursesDetail).toHaveLength(2);
    // 미적분: max(전공필수 3.0, 전공필수 3.0) = 3.0
    const calcItem = result.sharedCoursesDetail.find((d) => d.name === "미적분");
    expect(calcItem?.weight).toBe(COURSE_TYPE_WEIGHTS["전공필수"]);
    // 선형대수: max(전공선택 1.5, 전공기초 2.0) = 2.0
    const laItem = result.sharedCoursesDetail.find((d) => d.name === "선형대수");
    expect(laItem?.weight).toBe(COURSE_TYPE_WEIGHTS["전공기초"]);
  });
});
