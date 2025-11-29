/**
 * 학년도 계산 헬퍼 함수
 * 
 * 현재 날짜를 기준으로 학년도를 계산합니다.
 * 한국의 학년도는 3월부터 시작하므로, 3월~12월은 해당 연도, 1월~2월은 전년도입니다.
 * 
 * 클라이언트와 서버 모두에서 사용 가능한 순수 함수입니다.
 * 
 * @param date - 기준 날짜 (기본값: 현재 날짜)
 * @returns 학년도 (예: 2024)
 * 
 * @example
 * ```ts
 * // 현재 날짜 기준
 * const year = calculateSchoolYear(); // 2024
 * 
 * // 특정 날짜 기준
 * const year = calculateSchoolYear(new Date('2024-03-01')); // 2024
 * const year = calculateSchoolYear(new Date('2024-02-28')); // 2023
 * ```
 */
export function calculateSchoolYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1~12

  // 3월~12월: 해당 연도, 1월~2월: 전년도
  if (month >= 3) {
    return year;
  } else {
    return year - 1;
  }
}

