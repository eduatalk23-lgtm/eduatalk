"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  parseISO,
  isBefore,
  isAfter,
} from "date-fns";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/domains/admin-plan/actions/calendarEvents";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

interface CalendarMonthGridProps {
  currentMonth: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  periodStart: string;
  periodEnd: string;
  onDateSelect: (date: Date) => void;
}

export default function CalendarMonthGrid({
  currentMonth,
  selectedDate,
  events,
  periodStart,
  periodEnd,
  onDateSelect,
}: CalendarMonthGridProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // 날짜별 이벤트 타입 집계
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const event of events) {
      const dateKey = event.planDate;
      if (!map.has(dateKey)) {
        map.set(dateKey, new Set());
      }
      map.get(dateKey)!.add(event.type);
    }
    return map;
  }, [events]);

  const pStart = parseISO(periodStart);
  const pEnd = parseISO(periodEnd);

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "py-1 text-center text-xs font-medium",
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const inMonth = isSameMonth(date, currentMonth);
          const inPeriod = !isBefore(date, pStart) && !isAfter(date, pEnd);
          const selected = selectedDate && isSameDay(date, selectedDate);
          const today = isToday(date);
          const dayTypes = eventsByDate.get(dateKey);
          const hasExclusion = dayTypes?.has("제외일");
          const hasAcademy = dayTypes?.has("학원");
          const hasMeal = dayTypes?.has("점심식사") || dayTypes?.has("아침식사") || dayTypes?.has("저녁식사");
          const hasSleep = dayTypes?.has("수면");

          return (
            <button
              key={dateKey}
              onClick={() => onDateSelect(date)}
              disabled={!inMonth}
              className={cn(
                "relative flex h-10 flex-col items-center justify-center rounded-md text-sm transition-colors",
                !inMonth && "invisible",
                !inPeriod && inMonth && "text-gray-300",
                inPeriod && "cursor-pointer hover:bg-gray-100",
                hasExclusion && inPeriod && "bg-red-50",
                selected && "ring-2 ring-blue-500",
                today && "font-bold"
              )}
            >
              <span
                className={cn(
                  "leading-none",
                  today && "text-blue-600",
                  hasExclusion && inPeriod && "text-red-500 line-through"
                )}
              >
                {format(date, "d")}
              </span>

              {/* 이벤트 dot 인디케이터 */}
              {inPeriod && dayTypes && dayTypes.size > 0 && (
                <div className="absolute bottom-0.5 flex gap-0.5">
                  {hasExclusion && <div className="h-1 w-1 rounded-full bg-red-500" />}
                  {hasAcademy && <div className="h-1 w-1 rounded-full bg-orange-500" />}
                  {hasMeal && <div className="h-1 w-1 rounded-full bg-blue-500" />}
                  {hasSleep && <div className="h-1 w-1 rounded-full bg-purple-500" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
