import { getWeekRange, formatWeekRangeKorean } from "./weekRange";

/**
 * 리포트용 날짜 범위 계산 유틸리티
 */
export function getReportDateRange(
  period: "weekly" | "monthly",
  date?: Date
): {
  start: Date;
  end: Date;
  label: string;
} {
  const baseDate = date || new Date();

  if (period === "weekly") {
    const { weekStart, weekEnd } = getWeekRange(baseDate);
    return {
      start: weekStart,
      end: weekEnd,
      label: formatWeekRangeKorean(weekStart, weekEnd),
    };
  } else {
    const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth() + 1;
    return {
      start: monthStart,
      end: monthEnd,
      label: `${year}년 ${month}월`,
    };
  }
}

/**
 * 리포트 기간 레이블 생성 (주간)
 */
export function formatWeeklyPeriodLabel(startDate: Date): string {
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1;
  const weekNumber = Math.ceil((startDate.getDate() + (7 - startDate.getDay())) / 7);
  return `${year}년 ${month}월 ${weekNumber}주차`;
}

/**
 * 리포트 기간 레이블 생성 (월간)
 */
export function formatMonthlyPeriodLabel(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}년 ${month}월`;
}

