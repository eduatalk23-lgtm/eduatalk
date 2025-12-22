"use client";

import { useState, useMemo } from "react";
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
  parseISO,
  isWithinInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { PlanWithStudent } from "@/lib/types/camp/learning";
import { cn } from "@/lib/cn";

type CampLearningCalendarProps = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  learningRecords: PlanWithStudent[];
  onDateClick: (date: string) => void;
};

/**
 * 날짜별 학습 진행률 계산
 * 해당 날짜의 모든 플랜의 평균 진행률을 반환합니다.
 */
function getDateLearningProgress(
  date: string,
  records: PlanWithStudent[]
): number | null {
  const datePlans = records.filter((r) => r.plan_date === date);

  if (datePlans.length === 0) {
    return null;
  }

  // 진행률이 있는 플랜만 계산
  const plansWithProgress = datePlans.filter(
    (p) => p.progress !== null && p.progress !== undefined
  );

  if (plansWithProgress.length === 0) {
    return 0; // 플랜은 있지만 진행률이 없으면 0%
  }

  const totalProgress = plansWithProgress.reduce(
    (sum, p) => sum + (p.progress || 0),
    0
  );
  return Math.round(totalProgress / plansWithProgress.length);
}

/**
 * 학습 진행률별 색상 클래스
 */
function getProgressColorClass(progress: number | null): string {
  if (progress === null) {
    return "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500";
  }
  if (progress >= 90) {
    return "bg-green-500 hover:bg-green-600 text-white";
  }
  if (progress >= 70) {
    return "bg-yellow-500 hover:bg-yellow-600 text-white";
  }
  if (progress >= 50) {
    return "bg-orange-500 hover:bg-orange-600 text-white";
  }
  return "bg-red-500 hover:bg-red-600 text-white";
}

export function CampLearningCalendar({
  startDate,
  endDate,
  learningRecords,
  onDateClick,
}: CampLearningCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // 캠프 시작일이 있는 달로 초기화
    return parseISO(startDate);
  });

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // 날짜별 학습 진행률 맵 생성 (useMemo로 최적화)
  const dateProgressMap = useMemo(() => {
    const map = new Map<string, number | null>();
    const allDates = eachDayOfInterval({ start, end });

    allDates.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const progress = getDateLearningProgress(dateStr, learningRecords);
      map.set(dateStr, progress);
    });

    return map;
  }, [startDate, endDate, learningRecords]);

  // 날짜가 캠프 기간 내인지 확인
  const isDateInCampPeriod = (date: Date): boolean => {
    return isWithinInterval(date, { start, end });
  };

  // 이전 달로 이동
  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // 캠프 시작일로 이동
  const goToCampStart = () => {
    setCurrentMonth(start);
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
            const isInCampPeriod = isDateInCampPeriod(date);
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, new Date());
            const progress = dateProgressMap.get(dateStr) ?? null;
            const progressColorClass = getProgressColorClass(progress);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  if (isInCampPeriod) {
                    onDateClick(dateStr);
                  }
                }}
                disabled={!isInCampPeriod}
                className={cn(
                  "h-8 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition relative",
                  !isCurrentMonth
                    ? "text-gray-300 dark:text-gray-600"
                    : !isInCampPeriod
                    ? "bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : progress !== null
                    ? progressColorClass
                    : isToday
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 border-2 border-gray-400 dark:border-gray-500"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                )}
                title={
                  !isInCampPeriod
                    ? "캠프 기간이 아닙니다"
                    : progress !== null
                    ? `${dateStr}: 학습 진행률 ${progress}%`
                    : `${dateStr}: 플랜 없음`
                }
              >
                {date.getDate()}
                {progress !== null && (
                  <span className="absolute bottom-0.5 left-0.5 right-0.5 h-0.5 bg-black/20 rounded" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          학습 달력
        </h3>
        <button
          type="button"
          onClick={goToCampStart}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          title="캠프 시작일로 이동"
        >
          <Calendar className="h-4 w-4" />
          시작일로
        </button>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {format(currentMonth, "yyyy년 M월")}
        </h4>
        <button
          type="button"
          onClick={goToNextMonth}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          aria-label="다음 달"
        >
          <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {renderCalendar()}

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          범례:
        </span>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">90% 이상</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-yellow-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">70-89%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-orange-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">50-69%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-red-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">50% 미만</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-gray-100 dark:bg-gray-700" />
          <span className="text-xs text-gray-600 dark:text-gray-400">플랜 없음</span>
        </div>
      </div>
    </div>
  );
}

