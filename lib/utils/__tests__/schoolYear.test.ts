import { describe, it, expect } from "vitest";
import { calculateSchoolYear, gradeToSchoolYear, getCurriculumYear } from "../schoolYear";

describe("calculateSchoolYear", () => {
  it("3월 이후는 해당 연도", () => {
    expect(calculateSchoolYear(new Date("2026-03-01"))).toBe(2026);
    expect(calculateSchoolYear(new Date("2026-06-15"))).toBe(2026);
    expect(calculateSchoolYear(new Date("2026-12-31"))).toBe(2026);
  });

  it("1~2월은 전년도", () => {
    expect(calculateSchoolYear(new Date("2026-01-01"))).toBe(2025);
    expect(calculateSchoolYear(new Date("2026-02-28"))).toBe(2025);
  });

  it("3월 1일 경계값", () => {
    expect(calculateSchoolYear(new Date("2026-02-28"))).toBe(2025);
    expect(calculateSchoolYear(new Date("2026-03-01"))).toBe(2026);
  });

  it("인자 없으면 현재 날짜 기준", () => {
    const now = new Date();
    const expected = now.getMonth() + 1 >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    expect(calculateSchoolYear()).toBe(expected);
  });
});

describe("gradeToSchoolYear", () => {
  it("현재 2학년, 2026학년도 → 1학년은 2025학년도", () => {
    expect(gradeToSchoolYear(1, 2, 2026)).toBe(2025);
  });

  it("현재 3학년, 2026학년도 → 1학년은 2024학년도", () => {
    expect(gradeToSchoolYear(1, 3, 2026)).toBe(2024);
  });

  it("현재 학년과 대상 학년이 같으면 현재 학년도", () => {
    expect(gradeToSchoolYear(2, 2, 2026)).toBe(2026);
  });

  it("현재 1학년, 2026학년도 → 1학년은 2026학년도", () => {
    expect(gradeToSchoolYear(1, 1, 2026)).toBe(2026);
  });

  it("3학년 기준 각 학년도 역산", () => {
    expect(gradeToSchoolYear(1, 3, 2026)).toBe(2024);
    expect(gradeToSchoolYear(2, 3, 2026)).toBe(2025);
    expect(gradeToSchoolYear(3, 3, 2026)).toBe(2026);
  });
});

describe("getCurriculumYear", () => {
  it("2025년 이후 입학 → 2022 교육과정", () => {
    expect(getCurriculumYear(2025)).toBe(2022);
    expect(getCurriculumYear(2026)).toBe(2022);
    expect(getCurriculumYear(2030)).toBe(2022);
  });

  it("2024년 이하 입학 → 2015 교육과정", () => {
    expect(getCurriculumYear(2024)).toBe(2015);
    expect(getCurriculumYear(2023)).toBe(2015);
    expect(getCurriculumYear(2020)).toBe(2015);
  });

  it("경계값: 2024 → 2015, 2025 → 2022", () => {
    expect(getCurriculumYear(2024)).toBe(2015);
    expect(getCurriculumYear(2025)).toBe(2022);
  });
});
