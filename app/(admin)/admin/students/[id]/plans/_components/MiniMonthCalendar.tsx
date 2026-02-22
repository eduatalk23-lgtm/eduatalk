'use client';

/**
 * 미니 월간 캘린더 (사이드바용)
 *
 * Google Calendar 스타일의 compact 월간 캘린더.
 * 280px 사이드바 내 7열 그리드로 표시.
 */

import { useState, useMemo, useCallback, memo } from 'react';
import {
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface MiniMonthCalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export const MiniMonthCalendar = memo(function MiniMonthCalendar({
  selectedDate,
  onDateSelect,
}: MiniMonthCalendarProps) {
  // 미니 캘린더의 현재 표시 월 (selectedDate와 독립적으로 관리)
  const [displayMonth, setDisplayMonth] = useState(
    () => startOfMonth(new Date(selectedDate + 'T00:00:00'))
  );

  // 고정 6주(42셀) 그리드 날짜 배열
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(displayMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = new Date(calendarStart);
    calendarEnd.setDate(calendarStart.getDate() + 41); // 42일 (6주)
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [displayMonth]);

  const handlePrevMonth = useCallback(() => {
    setDisplayMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth((prev) => addMonths(prev, 1));
  }, []);

  return (
    <div className="select-none flex flex-col gap-2">
      {/* 월/년 헤더 + 이전/다음 월 화살표 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {format(displayMonth, 'yyyy년 M월')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={cn(
              'text-center text-[10px] font-medium py-0.5',
              idx === 0 && 'text-red-400',
              idx === 6 && 'text-blue-400',
              idx !== 0 && idx !== 6 && 'text-gray-400'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(date, displayMonth);
          const isTodayDate = isToday(date);
          const isSelected = dateStr === selectedDate;
          const dayOfWeek = date.getDay();

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              className={cn(
                'relative flex flex-col items-center justify-center h-8 text-xs rounded-full transition-colors',
                // 현재 월 외 날짜
                !isCurrentMonth && 'text-gray-300',
                // 현재 월 날짜
                isCurrentMonth && 'text-gray-700 hover:bg-gray-100',
                // 일/토 색상
                isCurrentMonth && dayOfWeek === 0 && 'text-red-500',
                isCurrentMonth && dayOfWeek === 6 && 'text-blue-500',
                // 오늘 = 파란 원
                isTodayDate && !isSelected && 'bg-blue-500 text-white hover:bg-blue-600',
                // 선택 날짜 = 파란 배경
                isSelected && !isTodayDate && 'bg-blue-100 text-blue-700 font-semibold',
                // 오늘 + 선택
                isSelected && isTodayDate && 'bg-blue-600 text-white'
              )}
            >
              <span>{format(date, 'd')}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
