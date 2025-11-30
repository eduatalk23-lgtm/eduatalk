/**
 * 학년 범위를 포맷팅하는 유틸리티 함수
 * @param gradeMin 최소 학년 (1-3)
 * @param gradeMax 최대 학년 (1-3)
 * @returns 포맷팅된 학년 문자열 (예: "1학년", "1-2학년", "1-3학년")
 */
export function formatGradeLevel(
  gradeMin: number | null,
  gradeMax: number | null
): string | null {
  if (!gradeMin && !gradeMax) {
    return null;
  }

  if (gradeMin && gradeMax) {
    if (gradeMin === gradeMax) {
      return `${gradeMin}학년`;
    }
    return `${gradeMin}-${gradeMax}학년`;
  }

  if (gradeMin) {
    return `${gradeMin}학년`;
  }

  if (gradeMax) {
    return `${gradeMax}학년`;
  }

  return null;
}

