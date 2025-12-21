"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MultiSelectCalendarProps = {
  selectedDates: string[]; // YYYY-MM-DD 형식
  excludedDates?: string[]; // 이미 제외된 날짜 (선택 불가)
  onDateToggle: (date: string) => void;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
};

export function MultiSelectCalendar({
  selectedDates,
  excludedDates = [],
  onDateToggle,
  minDate,
  maxDate,
}: MultiSelectCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 날짜가 선택 가능한지 확인
  const isDateSelectable = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");

    // 이미 제외된 날짜는 선택 불가
    if (excludedDates.includes(dateStr)) {
      return false;
    }

    // minDate 체크
    if (minDate) {
      const min = new Date(minDate);
      if (date < min && !isSameDay(date, min)) {
        return false;
      }
    }

    // maxDate 체크
    if (maxDate) {
      const max = new Date(maxDate);
      if (date > max && !isSameDay(date, max)) {
        return false;
      }
    }

    return true;
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (isDateSelectable(date)) {
      onDateToggle(dateStr);
    }
  };

  // 이전 달로 이동
  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // 달력 렌더링
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

    return (
      <div className="flex w-full flex-col gap-2">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const isSelectable = isDateSelectable(date);
            const isSelected = selectedDates.includes(dateStr);
            const isExcluded = excludedDates.includes(dateStr);
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, new Date());

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateClick(date)}
                disabled={!isSelectable}
                className={`
                  h-8 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition
                  ${!isCurrentMonth
                    ? "text-gray-300 dark:text-gray-600"
                    : !isSelectable || isExcluded
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : isSelected
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                    : isToday
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                  }
                `}
                title={
                  isExcluded
                    ? "이미 제외된 날짜입니다"
                    : !isSelectable
                    ? "선택할 수 없는 날짜입니다"
                    : undefined
                }
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {format(currentMonth, "yyyy년 M월")}
        </h3>
        <button
          type="button"
          onClick={goToNextMonth}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {renderCalendar()}
    </div>
  );
}

