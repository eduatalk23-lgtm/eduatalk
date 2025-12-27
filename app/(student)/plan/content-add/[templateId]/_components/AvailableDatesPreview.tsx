"use client";

import { useMemo } from "react";
import { Calendar, BookOpen, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface AvailableDateInfo {
  date: string;
  dayType: "study" | "review" | "exclusion";
  isExclusion: boolean;
  exclusionReason?: string;
}

type RangeUnit = "page" | "episode" | "day" | "chapter" | "unit";

interface AvailableDatesPreviewProps {
  periodStart: string;
  periodEnd: string;
  weekdays: number[]; // 0-6 (일-토)
  totalStudyDays: number;
  dailyAmount: number;
  rangeUnit: RangeUnit;
  className?: string;
}

/**
 * 가용 날짜 미리보기 컴포넌트
 *
 * 콘텐츠 추가 시 학습 가능한 날짜를 시각적으로 보여줍니다.
 * - 선택된 학습 요일 표시
 * - 월별 캘린더 미리보기
 * - 학습/복습일 구분
 */
export function AvailableDatesPreview({
  periodStart,
  periodEnd,
  weekdays,
  totalStudyDays,
  dailyAmount,
  rangeUnit,
  className,
}: AvailableDatesPreviewProps) {
  // 월별로 그룹화된 가용 날짜 계산
  const monthlyDates = useMemo(() => {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const result: Map<string, AvailableDateInfo[]> = new Map();

    let studyDayCount = 0;

    for (
      let current = new Date(start);
      current <= end;
      current.setDate(current.getDate() + 1)
    ) {
      const dateStr = current.toISOString().split("T")[0];
      const dayOfWeek = current.getDay();
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;

      // 선택된 요일인지 확인
      const isStudyDay = weekdays.includes(dayOfWeek);

      if (isStudyDay) {
        studyDayCount++;
        // 6:1 주기로 학습/복습 결정
        const cyclePosition = (studyDayCount - 1) % 7;
        const dayType: "study" | "review" = cyclePosition < 6 ? "study" : "review";

        const existing = result.get(monthKey) || [];
        existing.push({
          date: dateStr,
          dayType,
          isExclusion: false,
        });
        result.set(monthKey, existing);
      }
    }

    return result;
  }, [periodStart, periodEnd, weekdays]);

  // 요일 이름
  const weekdayNames = ["일", "월", "화", "수", "목", "금", "토"];

  // 월 이름 포맷
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    return `${year}년 ${parseInt(month)}월`;
  };

  // 총 학습일 수
  const totalDays = useMemo(() => {
    let count = 0;
    monthlyDates.forEach((dates) => {
      count += dates.filter((d) => d.dayType === "study").length;
    });
    return count;
  }, [monthlyDates]);

  // 총 복습일 수
  const totalReviewDays = useMemo(() => {
    let count = 0;
    monthlyDates.forEach((dates) => {
      count += dates.filter((d) => d.dayType === "review").length;
    });
    return count;
  }, [monthlyDates]);

  const getRangeUnitLabel = (unit: RangeUnit) => {
    switch (unit) {
      case "page":
        return "페이지";
      case "episode":
        return "강";
      case "chapter":
        return "단원";
      case "unit":
        return "유닛";
      case "day":
        return "일";
      default:
        return "개";
    }
  };

  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          가용 날짜 미리보기
        </h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalDays}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">학습일</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {totalReviewDays}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">복습일</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            ~{dailyAmount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            일평균 {getRangeUnitLabel(rangeUnit)}
          </div>
        </div>
      </div>

      {/* Selected Weekdays */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">학습 요일:</span>
          <div className="flex gap-1">
            {weekdayNames.map((name, idx) => (
              <span
                key={idx}
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center text-xs font-medium",
                  weekdays.includes(idx)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                )}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Calendars */}
      <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
        {Array.from(monthlyDates.entries()).map(([monthKey, dates]) => (
          <div key={monthKey}>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {formatMonth(monthKey)}
            </h4>
            <div className="flex flex-wrap gap-1">
              {dates.map((dateInfo) => {
                const day = new Date(dateInfo.date).getDate();
                const dayOfWeek = new Date(dateInfo.date).getDay();

                return (
                  <div
                    key={dateInfo.date}
                    className={cn(
                      "w-8 h-8 rounded flex flex-col items-center justify-center text-xs",
                      dateInfo.dayType === "study" &&
                        "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                      dateInfo.dayType === "review" &&
                        "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
                      dateInfo.isExclusion &&
                        "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 line-through"
                    )}
                    title={`${dateInfo.date} (${weekdayNames[dayOfWeek]}) - ${
                      dateInfo.dayType === "study"
                        ? "학습"
                        : dateInfo.dayType === "review"
                          ? "복습"
                          : "제외"
                    }`}
                  >
                    <span className="font-medium">{day}</span>
                    <span className="text-[8px] opacity-70">
                      {weekdayNames[dayOfWeek]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">학습</span>
          </div>
          <div className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 text-purple-600" />
            <span className="text-gray-600 dark:text-gray-400">복습</span>
          </div>
          <div className="flex items-center gap-1">
            <X className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">제외</span>
          </div>
        </div>
      </div>
    </div>
  );
}
