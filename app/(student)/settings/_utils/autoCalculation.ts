/**
 * 자동 계산 유틸리티
 */

import {
  calculateExamYear,
  calculateCurriculumRevision,
} from "@/lib/utils/studentProfile";

/**
 * 입시년도 자동 계산
 */
export function calculateExamYearValue(
  grade: string,
  schoolType?: "중학교" | "고등학교" | undefined
): number {
  return calculateExamYear(grade, schoolType);
}

/**
 * 개정교육과정 자동 계산
 */
export function calculateCurriculumRevisionValue(
  grade: string,
  birthDate: string | null,
  schoolType?: "중학교" | "고등학교" | undefined
): "2009 개정" | "2015 개정" | "2022 개정" {
  return calculateCurriculumRevision(grade, birthDate || null, schoolType);
}


