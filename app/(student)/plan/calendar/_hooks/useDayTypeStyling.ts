/**
 * 날짜 타입별 스타일링 로직을 통합한 유틸리티
 * MonthView, WeekView, DayView, DayTimelineModal에서 공통으로 사용하는 스타일링 로직을 추출
 */

import { getDayTypeColor } from "@/lib/constants/colors";
import { isToday } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import type { PlanExclusion } from "@/lib/types/plan";

export interface DayTypeStylingResult {
  bgColorClass: string;
  textColorClass: string;
  boldTextColorClass: string;
  dayTypeBadgeClass: string;
  isHoliday: boolean;
  isToday: boolean;
  dayTypeInfo: DayTypeInfo | undefined;
}

/**
 * 날짜 타입별 스타일링 정보를 계산하는 함수
 * 
 * @param date 날짜 객체
 * @param dayTypeInfo 날짜 타입 정보 (선택)
 * @param exclusions 해당 날짜의 제외일 목록 (선택)
 * @returns 스타일링 정보 객체
 */
export function getDayTypeStyling(
  date: Date,
  dayTypeInfo?: DayTypeInfo,
  exclusions: PlanExclusion[] = []
): DayTypeStylingResult {
  const dayType = dayTypeInfo?.type || "normal";
  const isTodayDate = isToday(date);
  
  // 휴일 여부 계산: dayType이 휴일 관련이거나 제외일이 있는 경우
  const isHoliday =
    dayType === "지정휴일" ||
    dayType === "휴가" ||
    dayType === "개인일정" ||
    exclusions.length > 0;

  // 날짜 타입 색상 가져오기
  const dayTypeColor = getDayTypeColor(
    isHoliday ? "지정휴일" : dayType,
    isTodayDate
  );

  // 스타일 클래스 조합
  const bgColorClass = `${dayTypeColor.border} ${dayTypeColor.bg}`;

  return {
    bgColorClass,
    textColorClass: dayTypeColor.text,
    boldTextColorClass: dayTypeColor.boldText,
    dayTypeBadgeClass: dayTypeColor.badge,
    isHoliday,
    isToday: isTodayDate,
    dayTypeInfo,
  };
}

/**
 * 날짜 타입별 스타일링 정보를 계산하는 훅 (메모이제이션 포함)
 * 컴포넌트 최상위 레벨에서 사용할 때 사용
 * 
 * @deprecated getDayTypeStyling 함수를 사용하세요. 훅이 필요한 경우 useMemo로 감싸서 사용하세요.
 */
export function useDayTypeStyling(
  date: Date,
  dayTypeInfo?: DayTypeInfo,
  exclusions: PlanExclusion[] = []
): DayTypeStylingResult {
  // 훅 규칙 준수를 위해 useMemo 사용 (실제로는 간단한 계산이므로 필요 없을 수도 있음)
  return getDayTypeStyling(date, dayTypeInfo, exclusions);
}

