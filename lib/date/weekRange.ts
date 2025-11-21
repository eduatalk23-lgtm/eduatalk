/**
 * 주간 날짜 범위 계산 유틸리티
 * 한국 시간(KST, UTC+9) 기준으로 처리
 */

/**
 * 주어진 날짜가 속한 주의 월요일과 일요일을 반환
 * @param date 기준 날짜 (기본값: 오늘)
 * @returns { weekStart: Date, weekEnd: Date }
 */
export function getWeekRange(date?: Date): { weekStart: Date; weekEnd: Date } {
  const targetDate = date ? new Date(date) : new Date();
  
  // 한국 시간으로 변환
  const koreaTime = new Date(
    targetDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  
  // 월요일로 조정 (0=일요일, 1=월요일, ...)
  const dayOfWeek = koreaTime.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const weekStart = new Date(koreaTime);
  weekStart.setDate(koreaTime.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
}

/**
 * 지난 주의 월요일과 일요일을 반환
 * @returns { weekStart: Date, weekEnd: Date }
 */
export function getLastWeekRange(): { weekStart: Date; weekEnd: Date } {
  const today = new Date();
  const lastWeekDate = new Date(today);
  lastWeekDate.setDate(today.getDate() - 7);
  
  return getWeekRange(lastWeekDate);
}

/**
 * 주간 범위를 문자열로 포맷팅
 * @param weekStart 주 시작일
 * @param weekEnd 주 종료일
 * @returns "YYYY-MM-DD ~ YYYY-MM-DD" 형식
 */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const startStr = weekStart.toISOString().slice(0, 10);
  const endStr = weekEnd.toISOString().slice(0, 10);
  return `${startStr} ~ ${endStr}`;
}

/**
 * 주간 범위를 한국어로 포맷팅
 * @param weekStart 주 시작일
 * @param weekEnd 주 종료일
 * @returns "YYYY년 M월 D일 ~ YYYY년 M월 D일" 형식
 */
export function formatWeekRangeKorean(weekStart: Date, weekEnd: Date): string {
  const startYear = weekStart.getFullYear();
  const startMonth = weekStart.getMonth() + 1;
  const startDay = weekStart.getDate();
  
  const endYear = weekEnd.getFullYear();
  const endMonth = weekEnd.getMonth() + 1;
  const endDay = weekEnd.getDate();
  
  if (startYear === endYear && startMonth === endMonth) {
    return `${startYear}년 ${startMonth}월 ${startDay}일 ~ ${endDay}일`;
  } else if (startYear === endYear) {
    return `${startYear}년 ${startMonth}월 ${startDay}일 ~ ${endMonth}월 ${endDay}일`;
  } else {
    return `${startYear}년 ${startMonth}월 ${startDay}일 ~ ${endYear}년 ${endMonth}월 ${endDay}일`;
  }
}

