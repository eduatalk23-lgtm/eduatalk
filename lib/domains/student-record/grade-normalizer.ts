// ============================================
// 9등급↔5등급 등급 정규화
// 2015 교육과정(9등급) vs 2022 교육과정(5등급) 혼재 처리
// 기존 lib/domains/score/computation.ts의 determineGradeSystem 재활용
// ============================================

import { GRADE_9_TO_5_MAP, GRADE_5_TO_9_MAP } from "./constants";
import type { NormalizedGrade } from "./types";

/** 9등급 → 5등급 백분위 범위 */
const GRADE_9_PERCENTILE_RANGES: Record<number, [number, number]> = {
  1: [0, 4],
  2: [4, 11],
  3: [11, 23],
  4: [23, 40],
  5: [40, 60],
  6: [60, 77],
  7: [77, 89],
  8: [89, 96],
  9: [96, 100],
};

/** 5등급 → 백분위 범위 */
const GRADE_5_PERCENTILE_RANGES: Record<string, [number, number]> = {
  A: [0, 10],
  B: [10, 34],
  C: [34, 66],
  D: [66, 90],
  E: [90, 100],
};

/**
 * 교육과정 연도 → 등급 체계 판별
 */
export function determineGradeSystem(curriculumYear: number | null | undefined): 5 | 9 {
  if (!curriculumYear) return 9;
  return curriculumYear >= 2022 ? 5 : 9;
}

/**
 * 9등급 → 5등급 환산
 */
export function grade9To5(grade9: number): string {
  if (grade9 < 1 || grade9 > 9) return "?";
  return GRADE_9_TO_5_MAP[grade9];
}

/**
 * 5등급 → 9등급 근사 환산 (대표값)
 */
export function grade5To9(grade5: string): number {
  const mapping = GRADE_5_TO_9_MAP[grade5.toUpperCase()];
  if (!mapping) return 0;
  return mapping.typical;
}

/**
 * 5등급 → 9등급 범위 환산
 */
export function grade5To9Range(grade5: string): { min: number; max: number } | null {
  const mapping = GRADE_5_TO_9_MAP[grade5.toUpperCase()];
  return mapping ? { min: mapping.min, max: mapping.max } : null;
}

/**
 * 등급 정규화 (학년 간 성적 비교용)
 *
 * @param grade - 원래 등급 (9등급: 1~9 숫자, 5등급: "A"~"E" 문자)
 * @param curriculumYear - 교육과정 연도 (2015 or 2022)
 */
export function normalizeGrade(
  grade: number | string,
  curriculumYear: number,
): NormalizedGrade {
  const gradeSystem = determineGradeSystem(curriculumYear);

  if (gradeSystem === 9) {
    const g = typeof grade === "string" ? parseInt(grade, 10) : grade;
    if (isNaN(g) || g < 1 || g > 9) {
      return {
        original: String(grade),
        gradeSystem: 9,
        normalizedTo9: null,
        normalizedTo5: null,
        percentileRange: [0, 0],
        displayLabel: `${grade}등급 (환산 불가)`,
      };
    }
    const to5 = grade9To5(g);
    return {
      original: String(g),
      gradeSystem: 9,
      normalizedTo9: g,
      normalizedTo5: to5,
      percentileRange: GRADE_9_PERCENTILE_RANGES[g],
      displayLabel: `${g}등급`,
    };
  }

  // 5등급
  const g = typeof grade === "number" ? String.fromCharCode(64 + grade) : grade.toUpperCase();
  const to9 = grade5To9(g);
  const range = GRADE_5_PERCENTILE_RANGES[g];
  return {
    original: g,
    gradeSystem: 5,
    normalizedTo9: to9 || null,
    normalizedTo5: g,
    percentileRange: range ?? [0, 0],
    displayLabel: `${g}(≈${to9}등급)`,
  };
}
