// ============================================
// grade-themes-section.ts 회귀 테스트
// ============================================

import { describe, it, expect } from "vitest";
import { buildGradeThemesSection } from "../llm/grade-themes-section";
import type { GradeThemeExtractionResult } from "../llm/types";

const BASE_RESULT: GradeThemeExtractionResult = {
  themes: [
    {
      id: "data-modeling",
      label: "데이터 모델링",
      keywords: ["회귀분석", "머신러닝", "파이썬"],
      records: [],
      affectedSubjects: ["수학Ⅱ", "정보"],
      subjectCount: 2,
      confidence: 0.9,
    },
    {
      id: "social-inequality",
      label: "사회적 불평등",
      keywords: ["빈곤", "복지"],
      records: [],
      affectedSubjects: ["사회문화"],
      subjectCount: 1,
      confidence: 0.75,
    },
  ],
  themeCount: 2,
  crossSubjectPatternCount: 1,
  dominantThemeIds: ["data-modeling", "social-inequality"],
  elapsedMs: 1200,
};

describe("buildGradeThemesSection", () => {
  it("dominantThemeIds 있을 때 섹션 헤더와 각 테마 라인이 포함된다", () => {
    const section = buildGradeThemesSection(BASE_RESULT);
    expect(section).toBeDefined();
    expect(section).toContain("## 이번 실행 학년별 지배 교과 교차 테마");
    expect(section).toContain("데이터 모델링");
    expect(section).toContain("회귀분석");
    expect(section).toContain("수학Ⅱ");
    expect(section).toContain("사회적 불평등");
  });

  it("gradeThemes가 undefined이면 undefined 반환 (첫 실행 no-op)", () => {
    expect(buildGradeThemesSection(undefined)).toBeUndefined();
  });

  it("gradeThemes가 null이면 undefined 반환", () => {
    expect(buildGradeThemesSection(null)).toBeUndefined();
  });

  it("dominantThemeIds가 빈 배열이면 undefined 반환", () => {
    const result = { ...BASE_RESULT, dominantThemeIds: [] };
    expect(buildGradeThemesSection(result)).toBeUndefined();
  });

  it("dominantThemeIds에 있으나 themes 목록에 없는 id는 조용히 생략한다", () => {
    const result = { ...BASE_RESULT, dominantThemeIds: ["unknown-id"] };
    expect(buildGradeThemesSection(result)).toBeUndefined();
  });

  it("dominantThemeIds 순서대로 라인이 출력된다", () => {
    const result: GradeThemeExtractionResult = {
      ...BASE_RESULT,
      dominantThemeIds: ["social-inequality", "data-modeling"],
    };
    const section = buildGradeThemesSection(result)!;
    const lines = section.split("\n");
    const dataIdx = lines.findIndex((l) => l.includes("데이터 모델링"));
    const socialIdx = lines.findIndex((l) => l.includes("사회적 불평등"));
    expect(socialIdx).toBeLessThan(dataIdx);
  });
});
