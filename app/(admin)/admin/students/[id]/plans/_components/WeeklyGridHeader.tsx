'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { formatDayHeader } from './utils/weekDateUtils';
import { TIME_GUTTER_WIDTH } from './utils/timeGridUtils';
import { getHolidayName } from '@/lib/domains/calendar/koreanHolidays';
import type { DayColumnData } from './hooks/useWeeklyGridData';

interface WeeklyGridHeaderProps {
  weekDates: string[];
  selectedDate: string;
  dayDataMap: Map<string, DayColumnData>;
  onDateChange: (date: string) => void;
  onSwitchToDaily?: (date: string) => void;
  /** 공휴일 표시 여부 (사이드바 토글) */
  showHolidays?: boolean;
}

export const WeeklyGridHeader = memo(function WeeklyGridHeader({
  weekDates,
  selectedDate,
  dayDataMap,
  onDateChange,
  onSwitchToDaily,
  showHolidays = true,
}: WeeklyGridHeaderProps) {
  const headers = useMemo(
    () => weekDates.map((d) => ({
      ...formatDayHeader(d),
      holiday: showHolidays ? getHolidayName(d) : null,
    })),
    [weekDates, showHolidays],
  );

  return (
    <div className="flex-shrink-0 border-b border-[rgb(var(--color-secondary-200))]">
      {/* 날짜 헤더 행 */}
      <div className="flex pr-2">
        {/* 시간 거터 공간 */}
        <div className="shrink-0 border-r border-[rgb(var(--color-secondary-200))]" style={{ width: TIME_GUTTER_WIDTH }} />

        {/* 7개 날짜 헤더 — CSS Grid로 종일/시간 영역과 컬럼 정렬 일치 */}
        <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
        {headers.map((h) => {
          const isSelected = h.fullDate === selectedDate;
          const isHoliday = !!h.holiday;

          return (
            <button
              key={h.fullDate}
              onClick={() => onSwitchToDaily ? onSwitchToDaily(h.fullDate) : onDateChange(h.fullDate)}
              className={cn(
                'flex flex-col items-center py-2 transition-colors',
                'border-r border-[rgb(var(--color-secondary-200))] last:border-r-0',
              )}
              title={h.holiday ?? undefined}
            >
              <span
                className={cn(
                  'text-[11px] font-medium',
                  isSelected ? 'text-blue-600'
                    : h.isToday ? 'text-blue-600'
                    : isHoliday ? 'text-red-500'
                    : h.isPast ? 'text-gray-300'
                    : 'text-gray-500',
                )}
              >
                {h.dayName}
              </span>
              <span
                className={cn(
                  'w-[34px] h-[34px] flex items-center justify-center rounded-full text-[22px] font-medium transition-colors',
                  isSelected && 'bg-blue-600 text-white',
                  h.isToday && !isSelected && 'ring-2 ring-blue-500 text-blue-600',
                  !h.isToday && !isSelected && isHoliday && 'text-red-500',
                  !h.isToday && !isSelected && !isHoliday && h.isPast && 'text-gray-300',
                  !h.isToday && !isSelected && !isHoliday && !h.isPast && 'text-gray-800 hover:bg-gray-100',
                )}
              >
                {h.dateNum}
              </span>
              {isHoliday && (
                <span className="text-[9px] text-red-400 leading-none mt-0.5 truncate max-w-full px-0.5">
                  {h.holiday}
                </span>
              )}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
});
