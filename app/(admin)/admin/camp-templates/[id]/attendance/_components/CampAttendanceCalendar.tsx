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
import type { AttendanceRecordWithStudent } from "@/lib/data/campAttendance";
import type { AttendanceStatus } from "@/lib/domains/attendance/types";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/domains/attendance/types";
import { cn } from "@/lib/cn";

type CampAttendanceCalendarProps = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  attendanceRecords: AttendanceRecordWithStudent[];
  onDateClick: (date: string) => void;
};

/**
 * 날짜별 출석 상태 계산
 * 여러 학생이 있을 경우 혼합 상태를 반환합니다.
 */
function getDateAttendanceStatus(
  date: string,
  records: AttendanceRecordWithStudent[]
): AttendanceStatus | "mixed" | null {
  const dateRecords = records.filter((r) => r.attendance_date === date);

  if (dateRecords.length === 0) {
    return null;
  }

  // 모든 학생의 상태가 동일한지 확인
  const statuses = dateRecords.map((r) => r.status);
  const uniqueStatuses = new Set(statuses);

  if (uniqueStatuses.size === 1) {
    return statuses[0] as AttendanceStatus;
  }

  // 여러 상태가 섞여 있으면 "mixed"
  return "mixed";
}

/**
 * 출석 상태별 색상 클래스
 */
function getStatusColorClass(status: AttendanceStatus | "mixed" | null): string {
  switch (status) {
    case "present":
      return "bg-green-500 hover:bg-green-600 text-white";
    case "late":
      return "bg-yellow-500 hover:bg-yellow-600 text-white";
    case "absent":
      return "bg-red-500 hover:bg-red-600 text-white";
    case "early_leave":
      return "bg-orange-500 hover:bg-orange-600 text-white";
    case "excused":
      return "bg-blue-500 hover:bg-blue-600 text-white";
    case "mixed":
      return "bg-purple-500 hover:bg-purple-600 text-white";
    default:
      return "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500";
  }
}

export function CampAttendanceCalendar({
  startDate,
  endDate,
  attendanceRecords,
  onDateClick,
}: CampAttendanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // 캠프 시작일이 있는 달로 초기화
    return parseISO(startDate);
  });

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // 날짜별 출석 상태 맵 생성 (useMemo로 최적화)
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus | "mixed" | null>();
    const allDates = eachDayOfInterval({ start, end });

    allDates.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const status = getDateAttendanceStatus(dateStr, attendanceRecords);
      map.set(dateStr, status);
    });

    return map;
  }, [startDate, endDate, attendanceRecords]);

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
            const status = dateStatusMap.get(dateStr) || null;
            const statusColorClass = getStatusColorClass(status);

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
                    : status
                    ? statusColorClass
                    : isToday
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 border-2 border-gray-400 dark:border-gray-500"
                    : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                )}
                title={
                  !isInCampPeriod
                    ? "캠프 기간이 아닙니다"
                    : status
                    ? `${dateStr}: ${status === "mixed" ? "혼합" : ATTENDANCE_STATUS_LABELS[status]}`
                    : `${dateStr}: 출석 기록 없음`
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
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          출석 달력
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
          <span className="text-xs text-gray-600 dark:text-gray-400">출석</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-yellow-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">지각</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-red-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">결석</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-orange-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">조퇴</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-blue-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">공결</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-purple-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">혼합</span>
        </div>
      </div>
    </div>
  );
}

