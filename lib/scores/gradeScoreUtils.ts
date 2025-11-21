/**
 * 성취도 등급 변환 유틸리티
 * UI에서는 알파벳(A~E, P)을 선택하고, DB에는 숫자로 저장
 */

/**
 * 숫자 등급을 알파벳 등급으로 변환 (기존 데이터 호환성)
 * @param numericGrade 1~9 숫자 등급
 * @returns 알파벳 대문자 등급 (A, B, C, D, E)
 */
export function numericToAlphabetGrade(numericGrade: number | null | undefined): string {
  if (numericGrade === null || numericGrade === undefined) {
    return "";
  }

  const grade = Number(numericGrade);
  if (isNaN(grade) || grade < 1 || grade > 9) {
    return "";
  }

  // 1~2: A, 3~4: B, 5~6: C, 7~8: D, 9: E
  if (grade <= 2) return "A";
  if (grade <= 4) return "B";
  if (grade <= 6) return "C";
  if (grade <= 8) return "D";
  return "E";
}

/**
 * 알파벳 등급을 숫자 등급으로 변환 (DB 저장용)
 * @param alphabetGrade 알파벳 대문자 등급 (A, B, C, D, E, P)
 * @returns 1~9 숫자 등급 (P는 0으로 저장)
 */
export function alphabetToNumericGrade(alphabetGrade: string | null | undefined): number {
  if (!alphabetGrade) {
    return 0;
  }

  const grade = alphabetGrade.toUpperCase().trim();
  
  switch (grade) {
    case "A":
      return 2; // A의 중간값
    case "B":
      return 4; // B의 중간값
    case "C":
      return 6; // C의 중간값
    case "D":
      return 8; // D의 중간값
    case "E":
      return 9;
    case "P":
      return 0; // P (Pass)는 0으로 저장
    default:
      return 0;
  }
}

/**
 * 알파벳 등급 목록 (A, B, C, D, E, P)
 */
export const ALPHABET_GRADES = ["A", "B", "C", "D", "E", "P"] as const;

export type AlphabetGrade = typeof ALPHABET_GRADES[number];

