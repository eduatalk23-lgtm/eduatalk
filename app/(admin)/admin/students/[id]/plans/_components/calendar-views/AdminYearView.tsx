'use client';

import { memo, useMemo, useCallback } from 'react';
import {
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
} from 'date-fns';
import { cn } from '@/lib/cn';
import { getRotatedWeekdayLabels } from '../utils/weekDateUtils';
import { getHolidayName } from '@/lib/domains/calendar/koreanHolidays';
import type { PlansByDate } from './_types/adminCalendar';

interface AdminYearViewProps {
  currentYear: number;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  /** 날짜 클릭 시 월간 뷰로 전환 */
  onMonthClick?: (date: string) => void;
  plansByDate: PlansByDate;
  weekStartsOn?: number;
  showHolidays?: boolean;
}

/**
 * Google Calendar 스타일 연간 뷰
 *
 * 12개 미니 월 캘린더를 3x4 그리드로 표시.
 * 각 날짜에 이벤트 밀도 도트, 공휴일 빨간색 표시.
 * 날짜 클릭 → 일간 뷰 전환, 월 헤더 클릭 → 월간 뷰 전환.
 */
const AdminYearView = memo(function AdminYearView({
  currentYear,
  selectedDate,
  onDateSelect,
  onMonthClick,
  plansByDate,
  weekStartsOn = 0,
  showHolidays = true,
}: AdminYearViewProps) {
  const WEEKDAY_LABELS = useMemo(() => getRotatedWeekdayLabels(weekStartsOn), [weekStartsOn]);

  // 12개월 Date 배열
  const months = useMemo(() => {
    const jan = new Date(currentYear, 0, 1);
    return Array.from({ length: 12 }, (_, i) => addMonths(jan, i));
  }, [currentYear]);

  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      {/* 연도 타이틀 (모바일 표시) */}
      <h2 className="text-lg font-semibold mb-3 md:hidden">{currentYear}년</h2>

      {/* 12개월 그리드: 모바일 1열, 태블릿 2열, 데스크톱 3열, 넓은 화면 4열 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {months.map((month) => (
          <YearMiniMonth
            key={month.getMonth()}
            month={month}
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
            onMonthClick={onMonthClick}
            plansByDate={plansByDate}
            weekStartsOn={weekStartsOn}
            weekdayLabels={WEEKDAY_LABELS}
            showHolidays={showHolidays}
          />
        ))}
      </div>
    </div>
  );
});

export default AdminYearView;

// ─── 미니 월 컴포넌트 ──────────────────────────────────────

interface YearMiniMonthProps {
  month: Date;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onMonthClick?: (date: string) => void;
  plansByDate: PlansByDate;
  weekStartsOn: number;
  weekdayLabels: string[];
  showHolidays: boolean;
}

const YearMiniMonth = memo(function YearMiniMonth({
  month,
  selectedDate,
  onDateSelect,
  onMonthClick,
  plansByDate,
  weekStartsOn,
  weekdayLabels,
  showHolidays,
}: YearMiniMonthProps) {
  // 6주(42일) 고정 그리드
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(month);
    const calendarStart = startOfWeek(monthStart, {
      weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    });
    const calendarEnd = new Date(calendarStart);
    calendarEnd.setDate(calendarStart.getDate() + 41);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [month, weekStartsOn]);

  const handleMonthHeaderClick = useCallback(() => {
    const dateStr = format(month, 'yyyy-MM-dd');
    onMonthClick?.(dateStr);
  }, [month, onMonthClick]);

  return (
    <div className="select-none">
      {/* 월 헤더 */}
      <button
        type="button"
        onClick={handleMonthHeaderClick}
        className="text-sm font-semibold mb-1.5 hover:underline cursor-pointer px-0.5"
      >
        {format(month, 'M월')}
      </button>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-0.5">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className={cn(
              'text-center text-[9px] font-medium py-0.5',
              label === '일' && 'text-red-400',
              label === '토' && 'text-blue-400',
              label !== '일' && label !== '토' && 'text-[var(--text-tertiary)]',
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
          const isCurrentMonth = isSameMonth(date, month);
          const isTodayDate = isToday(date);
          const isSelected = dateStr === selectedDate;
          const dayOfWeek = date.getDay();
          const eventCount = plansByDate[dateStr]?.length ?? 0;
          const dotCount = Math.min(eventCount, 3);
          const holiday = isCurrentMonth && showHolidays ? getHolidayName(dateStr) : null;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDateSelect(dateStr)}
              title={holiday ?? undefined}
              className={cn(
                'relative flex flex-col items-center justify-center h-7 text-[11px] rounded-full transition-colors',
                !isCurrentMonth && 'text-[var(--text-disabled)] opacity-40',
                isCurrentMonth && 'hover:bg-[rgb(var(--color-secondary-100))]',
                // 공휴일
                isCurrentMonth && holiday && 'text-red-500 dark:text-red-400',
                // 주말 색상 (공휴일 아닐 때)
                isCurrentMonth && !holiday && dayOfWeek === 0 && 'text-red-500 dark:text-red-400',
                isCurrentMonth && !holiday && dayOfWeek === 6 && 'text-blue-500 dark:text-blue-400',
                // 오늘
                isTodayDate && !isSelected && 'bg-blue-500 text-white hover:bg-blue-600',
                // 선택
                isSelected && !isTodayDate && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 font-semibold',
                isSelected && isTodayDate && 'bg-blue-600 text-white',
              )}
            >
              <span className={dotCount > 0 ? '-mt-0.5' : ''}>
                {format(date, 'd')}
              </span>
              {isCurrentMonth && dotCount > 0 && (
                <span className="absolute bottom-0 flex gap-px">
                  {Array.from({ length: dotCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-0.5 h-0.5 rounded-full',
                        isTodayDate || isSelected ? 'bg-current opacity-70' : 'bg-blue-500',
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
