/**
 * 캘린더 관련 날짜 유틸리티 함수
 */

/**
 * 월/년 포맷팅 (예: "2024년 1월")
 */
export function formatMonthYear(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

/**
 * 주 범위 포맷팅 (짧은 형식, 예: "1/1 ~ 1/7")
 */
export function formatWeekRangeShort(date: Date): string {
  const startOfWeek = getWeekStart(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} ~ ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;
}

/**
 * 일 포맷팅 (예: "1월 1일 (월)")
 */
export function formatDay(date: Date): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

/**
 * 전체 날짜 포맷팅 (예: "2024년 1월 1일 (월)")
 */
export function formatDateFull(date: Date): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

/**
 * 날짜가 오늘인지 확인
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * 주의 시작일 계산 (월요일)
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환 (로컬 타임존 기준)
 * toISOString()을 사용하면 UTC로 변환되어 날짜가 하루 전으로 바뀔 수 있으므로
 * 로컬 타임존 기준으로 변환합니다.
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD 형식 문자열을 Date 객체로 변환 (로컬 타임존 기준)
 * UTC가 아닌 로컬 타임존으로 파싱하여 날짜가 변경되지 않도록 합니다.
 */
export function parseDateString(dateStr: string): Date {
  // 로컬 타임존 기준으로 Date 객체 생성
  // dateStr이 "YYYY-MM-DD" 형식이므로 직접 파싱
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

