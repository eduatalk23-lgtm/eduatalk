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

/**
 * KST(UTC+9) 기준으로 학년도를 계산합니다.
 *
 * GitHub Actions 등 UTC 환경에서 실행 시 `calculateSchoolYear()`는
 * 로컬 시스템 시간 기준이므로 2월 28일 한국 시각이 UTC 2월 27일로
 * 처리될 수 있습니다. 배치 스크립트는 이 함수를 사용해야 합니다.
 *
 * @param date - 기준 날짜 (기본값: 현재 날짜)
 * @returns 학년도 (예: 2024)
 */
export function calculateSchoolYearKST(date: Date = new Date()): number {
  // KST = UTC+9: UTC 기준 ms에 9시간을 더해 KST 날짜로 환산
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + kstOffset);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1; // 1~12

  // 3월~12월: 해당 연도, 1월~2월: 전년도
  return month >= 3 ? year : year - 1;
}

/**
 * 학년 → 학년도 변환 (입학년도 역산)
 *
 * @param grade - 대상 학년 (1, 2, 3)
 * @param studentCurrentGrade - 학생의 현재 학년
 * @param currentSchoolYear - 현재 학년도
 * @returns 해당 학년의 학년도
 *
 * @example
 * ```ts
 * // 현재 2학년, 2026학년도인 학생의 1학년 학년도
 * gradeToSchoolYear(1, 2, 2026); // 2025
 * ```
 */
export function gradeToSchoolYear(
  grade: number,
  studentCurrentGrade: number,
  currentSchoolYear: number,
): number {
  return currentSchoolYear - (studentCurrentGrade - grade);
}

/**
 * 학생의 입학 연도로부터 적용 교육과정 연도를 결정합니다.
 * - 2025년 이후 입학 → 2022 개정 교육과정
 * - 2024년 이하 입학 → 2015 개정 교육과정
 *
 * @param enrollmentYear - 고1 입학 연도 (schoolYear - grade + 1)
 */
export function getCurriculumYear(enrollmentYear: number): number {
  return enrollmentYear >= 2025 ? 2022 : 2015;
}

