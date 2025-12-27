"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { PlanWithContent } from "../_types/plan";

type MiniCalendarProps = {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  plans?: PlanWithContent[];
  minDate?: string;
  maxDate?: string;
  className?: string;
};

/**
 * 미니 캘린더 네비게이션
 *
 * 빠른 날짜 선택을 위한 소형 캘린더 위젯입니다.
 */
export function MiniCalendar({
  currentDate,
  onDateSelect,
  plans = [],
  minDate,
  maxDate,
  className,
}: MiniCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  });

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  // 월의 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];

    // 이전 달의 마지막 날들
    const prevMonth = new Date(year, month, 0);
    const daysFromPrevMonth = startingDayOfWeek;
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }

    // 현재 달
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // 다음 달의 첫 날들 (6주 완성)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // 날짜별 플랜 개수
  const planCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    plans.forEach((plan) => {
      const dateStr = plan.plan_date;
      map.set(dateStr, (map.get(dateStr) || 0) + 1);
    });
    return map;
  }, [plans]);

  // 날짜 선택 가능 여부
  const isDateSelectable = (date: Date): boolean => {
    const dateStr = formatDateString(date);
    if (minDate && dateStr < minDate) return false;
    if (maxDate && dateStr > maxDate) return false;
    return true;
  };

  // 월 이동
  const goToPrevMonth = () => {
    setDisplayMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setDisplayMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onDateSelect(today);
  };

  const todayStr = formatDateString(new Date());
  const selectedDateStr = formatDateString(currentDate);

  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  const monthLabel = `${year}년 ${month + 1}월`;

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={goToPrevMonth}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={goToToday}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {monthLabel}
        </button>
        <button
          onClick={goToNextMonth}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekdays.map((day, index) => (
          <div
            key={day}
            className={cn(
              "text-center text-xs font-medium py-1",
              index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-gray-500"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          if (!date) return <div key={index} />;

          const dateStr = formatDateString(date);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDateStr;
          const planCount = planCountByDate.get(dateStr) || 0;
          const isSelectable = isDateSelectable(date);
          const dayOfWeek = date.getDay();

          return (
            <button
              key={dateStr}
              onClick={() => isSelectable && onDateSelect(date)}
              disabled={!isSelectable}
              className={cn(
                "relative w-full aspect-square flex items-center justify-center text-xs rounded transition-colors",
                !isCurrentMonth && "text-gray-300 dark:text-gray-600",
                isCurrentMonth && !isToday && !isSelected && (
                  dayOfWeek === 0 ? "text-red-600 dark:text-red-400" :
                  dayOfWeek === 6 ? "text-blue-600 dark:text-blue-400" :
                  "text-gray-700 dark:text-gray-300"
                ),
                isToday && !isSelected && "bg-gray-100 font-bold dark:bg-gray-700",
                isSelected && "bg-indigo-600 text-white font-bold",
                isSelectable && !isSelected && "hover:bg-gray-100 dark:hover:bg-gray-700",
                !isSelectable && "opacity-30 cursor-not-allowed"
              )}
            >
              {date.getDate()}
              {/* 플랜 있음 표시 */}
              {planCount > 0 && (
                <span
                  className={cn(
                    "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                    isSelected ? "bg-white" : "bg-indigo-500"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-indigo-500" />
            <span>플랜 있음</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-700" />
            <span>오늘</span>
          </div>
        </div>
      </div>
    </div>
  );
}
