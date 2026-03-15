/**
 * 주간 그리드 뷰용 날짜 유틸리티
 */

/** 주어진 날짜가 포함된 주의 7일 배열 반환 (YYYY-MM-DD)
 * @param weekStartsOn 주 시작 요일 (0=일, 1=월, ..., 6=토). 기본값 0(일요일)
 */
export function getWeekDates(selectedDate: string, weekStartsOn = 0): string[] {
  const date = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = date.getDay(); // 0=일, 1=월, ..., 6=토
  const offset = -((dayOfWeek - weekStartsOn + 7) % 7);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() + offset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

/** 커스텀 N일 배열 반환 (selectedDate 중심, weekStartsOn 기반 시작)
 * dayCount=7이면 getWeekDates와 동일. 2~6이면 selectedDate 중심 N일.
 */
export function getCustomDayDates(selectedDate: string, dayCount: number, weekStartsOn = 0): string[] {
  if (dayCount >= 7) return getWeekDates(selectedDate, weekStartsOn);
  const date = new Date(selectedDate + 'T00:00:00');
  // selectedDate 기준 앞뒤로 균등 배치 (앞쪽 우선)
  const before = Math.floor((dayCount - 1) / 2);
  const start = new Date(date);
  start.setDate(date.getDate() - before);
  const dates: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

/** 커스텀 N일 범위 반환 */
export function getCustomDayRange(selectedDate: string, dayCount: number, weekStartsOn = 0): { start: string; end: string } {
  const dates = getCustomDayDates(selectedDate, dayCount, weekStartsOn);
  return { start: dates[0], end: dates[dates.length - 1] };
}

/** 커스텀 N일 뷰에서 N일 앞/뒤로 이동 */
export function shiftCustomDays(date: string, direction: 1 | -1, dayCount: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + direction * dayCount);
  return formatDate(d);
}

/** 주간 시작~끝 날짜 범위 */
export function getWeekRange(date: string, weekStartsOn = 0): { start: string; end: string } {
  const dates = getWeekDates(date, weekStartsOn);
  return { start: dates[0], end: dates[6] };
}

/**
 * 주간 범위 반환 (weekStartsOn 기반)
 *
 * calendarEvents.ts의 getWeekRange(월~일)와 구분하기 위한 명시적 네이밍.
 * weeklyCalendarEventsQueryOptions에 직접 전달 가능.
 */
export function getWeekRangeSunSat(dateStr: string, weekStartsOn = 0): { start: string; end: string } {
  const dates = getWeekDates(dateStr, weekStartsOn);
  return { start: dates[0], end: dates[6] };
}

/** 날짜 헤더 표시용 포맷 */
export function formatDayHeader(date: string): {
  dayName: string;
  dateNum: number;
  isToday: boolean;
  isPast: boolean;
  fullDate: string;
} {
  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date(date + 'T00:00:00');
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  // 오늘 자정 기준으로 과거 판별
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isPast = d.getTime() < todayStart.getTime();

  return {
    dayName: DAY_NAMES[d.getDay()],
    dateNum: d.getDate(),
    isToday,
    isPast,
    fullDate: date,
  };
}

/** 두 날짜가 같은 주에 속하는지 확인 */
export function isSameWeek(dateA: string, dateB: string, weekStartsOn = 0): boolean {
  const weekA = getWeekDates(dateA, weekStartsOn);
  const weekB = getWeekDates(dateB, weekStartsOn);
  return weekA[0] === weekB[0];
}

/** 주간 범위 텍스트 포맷 (예: "2026년 2월 16일 ~ 22일") */
export function formatWeekRangeText(dates: string[]): string {
  if (dates.length === 0) return '';
  const start = new Date(dates[0] + 'T00:00:00');
  const end = new Date(dates[dates.length - 1] + 'T00:00:00');

  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const startDay = start.getDate();
  const endMonth = end.getMonth() + 1;
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startYear}년 ${startMonth}월 ${startDay}일 ~ ${endDay}일`;
  }
  return `${startYear}년 ${startMonth}월 ${startDay}일 ~ ${endMonth}월 ${endDay}일`;
}

/** Date → YYYY-MM-DD */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 일간 뷰에서 1일 앞/뒤로 이동 */
export function shiftDay(date: string, direction: 1 | -1): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + direction);
  return formatDate(d);
}

/** 월간 뷰에서 1월 앞/뒤로 이동 */
export function shiftMonth(date: string, direction: 1 | -1): string {
  const d = new Date(date + 'T00:00:00');
  d.setMonth(d.getMonth() + direction);
  return formatDate(d);
}

/** "2026년 2월" 형태 월/년 표시 */
export function formatMonthYear(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** 주간을 1주 앞/뒤로 이동 */
export function shiftWeek(date: string, direction: 1 | -1): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + direction * 7);
  return formatDate(d);
}

/** 연도를 1년 앞/뒤로 이동 */
export function shiftYear(date: string, direction: 1 | -1): string {
  const d = new Date(date + 'T00:00:00');
  d.setFullYear(d.getFullYear() + direction);
  return formatDate(d);
}

/** 2주간 뷰: 이번 주 + 다음 주의 14일 배열 반환 */
export function getTwoWeekDates(selectedDate: string, weekStartsOn = 0): [string[], string[]] {
  const week1 = getWeekDates(selectedDate, weekStartsOn);
  const nextWeekStart = new Date(week1[6] + 'T00:00:00');
  nextWeekStart.setDate(nextWeekStart.getDate() + 1);
  const week2 = getWeekDates(formatDate(nextWeekStart), weekStartsOn);
  return [week1, week2];
}

/** 2주간 뷰: 전체 범위 반환 */
export function getTwoWeekRange(selectedDate: string, weekStartsOn = 0): { start: string; end: string } {
  const [week1, week2] = getTwoWeekDates(selectedDate, weekStartsOn);
  return { start: week1[0], end: week2[6] };
}

/** 오늘 날짜 반환 (YYYY-MM-DD) */
export function getTodayString(): string {
  return formatDate(new Date());
}

const BASE_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** weekStartsOn에 맞게 회전된 요일 라벨 반환 */
export function getRotatedWeekdayLabels(weekStartsOn = 0): string[] {
  if (weekStartsOn === 0) return BASE_WEEKDAY_LABELS;
  return [
    ...BASE_WEEKDAY_LABELS.slice(weekStartsOn),
    ...BASE_WEEKDAY_LABELS.slice(0, weekStartsOn),
  ];
}
