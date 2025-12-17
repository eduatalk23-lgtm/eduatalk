/**
 * 플랜 관련 포맷팅 유틸리티 함수
 * 
 * 플랜 표시에 필요한 시간, 학습 분량, 날짜 포맷팅 함수를 통합 제공합니다.
 */

/**
 * 소요시간 포맷팅 (분 단위 → 시간 문자열)
 * 
 * @param minutes - 분 단위 시간 (예: 90)
 * @returns 포맷팅된 시간 문자열 (예: "1시간 30분", "2시간", "45분")
 * 
 * @example
 * ```typescript
 * formatPlanTime(90) // "1시간 30분"
 * formatPlanTime(120) // "2시간"
 * formatPlanTime(45) // "45분"
 * formatPlanTime(0) // "0분"
 * ```
 */
export function formatPlanTime(minutes: number): string {
  if (minutes === 0) return "0분";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}시간 ${mins}분`;
  } else if (hours > 0) {
    return `${hours}시간`;
  } else {
    return `${mins}분`;
  }
}

/**
 * 학습 분량 포맷팅
 * 
 * @param plan - 플랜 객체 (content_type, planned_start_page_or_time, planned_end_page_or_time 포함)
 * @returns 포맷팅된 학습 분량 문자열
 * 
 * @example
 * ```typescript
 * // 교재: "10-50p (41쪽)" 또는 "10p (1쪽)"
 * formatPlanLearningAmount({ content_type: "book", planned_start_page_or_time: 10, planned_end_page_or_time: 50 })
 * 
 * // 강의: "8-10강 (3강)" 또는 "8강 (1강)"
 * formatPlanLearningAmount({ content_type: "lecture", planned_start_page_or_time: 8, planned_end_page_or_time: 10 })
 * 
 * // 커스텀: "10-50" 또는 "10"
 * formatPlanLearningAmount({ content_type: "custom", planned_start_page_or_time: 10, planned_end_page_or_time: 50 })
 * ```
 */
export function formatPlanLearningAmount(plan: {
  content_type: string;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
}): string {
  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null
  ) {
    return "-";
  }

  const start = plan.planned_start_page_or_time;
  const end = plan.planned_end_page_or_time;
  const isSingle = start === end;
  const amount = end - start + 1; // Assuming inclusive range for books/episodes

  if (plan.content_type === "book") {
    // 교재: 페이지 범위 (예: "10-50p (41쪽)")
    // 페이지는 amount가 쪽수
    return isSingle 
      ? `${start}p (1쪽)` 
      : `${start}-${end}p (${amount}쪽)`;
  } else if (plan.content_type === "lecture") {
    // 강의: 회차 범위 (예: "8-10강 (3강)")
    // 에피소드는 amount가 강의 수
    return isSingle 
      ? `${start}강 (1강)` 
      : `${start}-${end}강 (${amount}강)`;
  }

  // 커스텀: 범위 (예: "10-50" 또는 "10")
  return isSingle ? `${start}` : `${start}-${end}`;
}

/**
 * 날짜 포맷팅 (요일 포함)
 * 
 * @param date - 날짜 문자열 (YYYY-MM-DD 형식)
 * @returns 포맷팅된 날짜 문자열 (예: "2024년 1월 15일 (월)")
 * 
 * @example
 * ```typescript
 * formatPlanDate("2024-01-15") // "2024년 1월 15일 (월)"
 * formatPlanDate("2024-12-25") // "2024년 12월 25일 (수)"
 * ```
 */
export function formatPlanDate(date: string): string {
  const dateObj = new Date(date + "T00:00:00");
  if (isNaN(dateObj.getTime())) {
    return "-";
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const dayOfWeek = dateObj.getDay();

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = dayNames[dayOfWeek] ?? "";

  return `${year}년 ${month}월 ${day}일 (${dayName})`;
}

/**
 * 간단한 날짜 포맷팅 (요일만 포함, 짧은 형식)
 * 
 * @param date - 날짜 문자열 (YYYY-MM-DD 형식)
 * @returns 포맷팅된 날짜 문자열 (예: "1월 15일 (월)")
 * 
 * @example
 * ```typescript
 * formatPlanDateShort("2024-01-15") // "1월 15일 (월)"
 * formatPlanDateShort("2024-12-25") // "12월 25일 (수)"
 * ```
 */
export function formatPlanDateShort(date: string): string {
  const dateObj = new Date(date + "T00:00:00");
  if (isNaN(dateObj.getTime())) {
    return "-";
  }

  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const dayOfWeek = dateObj.getDay();

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = dayNames[dayOfWeek] ?? "";

  return `${month}월 ${day}일 (${dayName})`;
}

