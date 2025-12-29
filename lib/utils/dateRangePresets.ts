/**
 * 날짜 범위 프리셋 유틸리티
 *
 * 필터 UI에서 사용하는 날짜 프리셋 값을 실제 날짜 범위로 변환합니다.
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from "date-fns";
import { ko } from "date-fns/locale";

export type DateRangePreset =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "";

export type DateRange = {
  start: string;
  end: string;
};

/**
 * 날짜 프리셋을 실제 날짜 범위로 변환
 *
 * @param preset - 날짜 프리셋 값 (today, week, month, quarter)
 * @param referenceDate - 기준 날짜 (기본값: 현재 날짜)
 * @returns 날짜 범위 { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } 또는 null
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset | string | undefined,
  referenceDate: Date = new Date()
): DateRange | null {
  if (!preset || preset === "") {
    return null;
  }

  const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

  switch (preset) {
    case "today":
      return {
        start: formatDate(startOfDay(referenceDate)),
        end: formatDate(endOfDay(referenceDate)),
      };

    case "week":
      return {
        start: formatDate(startOfWeek(referenceDate, { locale: ko })),
        end: formatDate(endOfWeek(referenceDate, { locale: ko })),
      };

    case "month":
      return {
        start: formatDate(startOfMonth(referenceDate)),
        end: formatDate(endOfMonth(referenceDate)),
      };

    case "quarter":
      return {
        start: formatDate(subMonths(referenceDate, 3)),
        end: formatDate(referenceDate),
      };

    default:
      return null;
  }
}

/**
 * 진행률 범위 문자열을 min/max 값으로 변환
 *
 * @param progressPreset - 진행률 프리셋 (0-25, 25-50, 50-75, 75-100, 100)
 * @returns { min: number, max: number } 또는 null
 */
export function getProgressRangeFromPreset(
  progressPreset: string | undefined
): { min: number; max: number } | null {
  if (!progressPreset || progressPreset === "") {
    return null;
  }

  switch (progressPreset) {
    case "0-25":
      return { min: 0, max: 25 };
    case "25-50":
      return { min: 25, max: 50 };
    case "50-75":
      return { min: 50, max: 75 };
    case "75-100":
      return { min: 75, max: 100 };
    case "100":
      return { min: 100, max: 100 };
    default:
      return null;
  }
}

/**
 * 날짜 범위 라벨 반환
 */
export function getDateRangeLabel(preset: DateRangePreset): string {
  switch (preset) {
    case "today":
      return "오늘";
    case "week":
      return "이번 주";
    case "month":
      return "이번 달";
    case "quarter":
      return "최근 3개월";
    default:
      return "전체";
  }
}

/**
 * 날짜가 범위 내에 있는지 확인
 */
export function isDateInRange(
  date: string | Date,
  range: DateRange
): boolean {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const startDate = new Date(range.start);
  const endDate = new Date(range.end);

  // 시간 무시하고 날짜만 비교
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  const normalizedTarget = new Date(targetDate);
  normalizedTarget.setHours(12, 0, 0, 0);

  return normalizedTarget >= startDate && normalizedTarget <= endDate;
}
