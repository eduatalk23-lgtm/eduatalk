/**
 * 날짜 관련 유틸리티
 *
 * UI 컴포넌트에서 사용하던 날짜 관련 로직을 추출했습니다.
 */

/**
 * 오늘 날짜의 연/월/일 반환
 */
export function getTodayParts(): { year: number; month: number; day: number } {
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

/**
 * 날짜 문자열(YYYY-MM-DD)을 연/월/일로 파싱
 */
export function parseDateString(
  dateStr: string
): { year: number; month: number; day: number } {
  if (!dateStr) return getTodayParts();
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

/**
 * 연/월/일을 날짜 문자열(YYYY-MM-DD)로 변환
 */
export function formatDateString(
  year: number,
  month: number,
  day: number
): string {
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  return `${year}-${monthStr}-${dayStr}`;
}

/**
 * 해당 월의 마지막 일 계산 (윤년 고려)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 두 날짜 사이의 일 수 계산
 */
export function getDaysDifference(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 두 날짜 사이의 주 수 계산
 */
export function getWeeksDifference(startDate: string, endDate: string): number {
  const days = getDaysDifference(startDate, endDate);
  return Math.floor(days / 7);
}

/**
 * 시작 날짜와 주 수로 종료 날짜 계산
 * 타임존 문제를 방지하기 위해 YYYY-MM-DD 문자열을 직접 파싱합니다.
 */
export function calculateEndDate(startDate: string, weeks: number): string {
  // YYYY-MM-DD 형식 문자열을 직접 파싱하여 타임존 문제 방지
  const startParts = parseDateString(startDate);
  const start = new Date(startParts.year, startParts.month - 1, startParts.day);
  
  const end = new Date(start);
  end.setDate(start.getDate() + weeks * 7);
  return formatDateFromDate(end);
}

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환
 */
export function formatDateFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return formatDateString(year, month, day);
}

/**
 * 날짜 문자열에 일수를 더하거나 빼기 (타임존 문제 방지)
 * @param dateStr YYYY-MM-DD 형식의 날짜 문자열
 * @param days 더하거나 빼고 싶은 일수 (음수 가능)
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const parts = parseDateString(dateStr);
  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + days);
  return formatDateFromDate(date);
}

/**
 * 특정 날짜까지 D-day 계산
 */
export function calculateDday(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 날짜 유효성 검사
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * 시작 날짜와 종료 날짜 유효성 검사 (시작 <= 종료)
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return false;
  }
  return new Date(startDate) <= new Date(endDate);
}

/**
 * 주어진 날짜가 오늘 이후인지 확인
 */
export function isFutureDate(dateStr: string): boolean {
  if (!isValidDateString(dateStr)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target >= today;
}

/**
 * 요일 번호를 한글 요일로 변환 (0: 일요일)
 */
export function getDayOfWeekName(dayNumber: number): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[dayNumber] ?? "";
}

/**
 * 날짜에서 요일 번호 추출 (0: 일요일)
 */
export function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr);
  return date.getDay();
}

