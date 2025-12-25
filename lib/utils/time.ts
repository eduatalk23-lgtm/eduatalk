/**
 * 시간 변환 유틸리티 함수
 *
 * 플랜 생성 및 스케줄링에서 사용하는 시간 변환 함수를 통합 제공합니다.
 */

// ============================================
// 시간 관련 상수
// ============================================

/** 1시간 = 60분 */
export const MINUTES_PER_HOUR = 60;

/** 1일 = 24시간 */
export const HOURS_PER_DAY = 24;

/** 1주일 = 7일 */
export const DAYS_PER_WEEK = 7;

/** 1초 = 1000밀리초 */
export const MILLISECONDS_PER_SECOND = 1000;

/** 1분 = 60000밀리초 */
export const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * MINUTES_PER_HOUR;

/** 1시간 = 3600000밀리초 */
export const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR;

/** 1일 = 86400000밀리초 */
export const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * HOURS_PER_DAY;

/** 기본 이동 시간 (분) - 학원 등 일정 간 이동 시간 */
export const DEFAULT_TRAVEL_TIME_MINUTES = 60;

// ============================================
// 날짜 계산 유틸리티 함수
// ============================================

/**
 * 두 날짜 사이의 일수 차이를 계산합니다.
 * 시간대에 관계없이 날짜만 비교하여 일수 차이를 반환합니다.
 *
 * @param startDate - 시작 날짜 (Date 객체 또는 ISO 문자열)
 * @param endDate - 종료 날짜 (Date 객체 또는 ISO 문자열)
 * @returns 일수 차이 (종료 - 시작)
 *
 * @example
 * ```typescript
 * getDaysDifference("2025-01-01", "2025-01-08") // 7
 * getDaysDifference(new Date("2025-01-01"), new Date("2025-01-03")) // 2
 * ```
 */
export function getDaysDifference(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = typeof startDate === "string" ? new Date(startDate) : new Date(startDate);
  const end = typeof endDate === "string" ? new Date(endDate) : new Date(endDate);

  // 시간 정보 제거 (자정으로 설정)
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / MILLISECONDS_PER_DAY);
}

/**
 * 날짜로부터 요일을 계산합니다 (1-7, 월요일=1).
 * 플랜 시작일 기준 몇 번째 요일인지 계산합니다.
 *
 * @param date - 현재 날짜
 * @param periodStart - 기간 시작일
 * @returns 요일 번호 (1-7)
 *
 * @example
 * ```typescript
 * getWeekDayFromPeriod("2025-01-08", "2025-01-01") // 1 (첫째 주 같은 요일)
 * ```
 */
export function getWeekDayFromPeriod(
  date: Date | string,
  periodStart: Date | string
): number {
  const diffDays = getDaysDifference(periodStart, date);
  return (diffDays % DAYS_PER_WEEK) + 1;
}

// ============================================
// 시간 변환 함수
// ============================================

/**
 * 시간 문자열을 분 단위로 변환
 * 
 * @param time - 시간 문자열 (HH:mm 형식, 예: "09:30")
 * @returns 분 단위 시간 (예: "09:30" → 570)
 * 
 * @example
 * ```typescript
 * timeToMinutes("09:30") // 570
 * timeToMinutes("13:45") // 825
 * ```
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열로 변환
 * 
 * @param minutes - 분 단위 시간 (예: 570)
 * @returns 시간 문자열 (HH:mm 형식, 예: "09:30")
 * 
 * @example
 * ```typescript
 * minutesToTime(570) // "09:30"
 * minutesToTime(825) // "13:45"
 * ```
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

