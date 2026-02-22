'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { formatDayHeader } from './utils/weekDateUtils';
import { TIME_GUTTER_WIDTH } from './utils/timeGridUtils';
import type { DayColumnData } from './hooks/useWeeklyGridData';

interface WeeklyGridHeaderProps {
  weekDates: string[];
  selectedDate: string;
  dayDataMap: Map<string, DayColumnData>;
  onDateChange: (date: string) => void;
  onSwitchToDaily?: (date: string) => void;
}

export const WeeklyGridHeader = memo(function WeeklyGridHeader({
  weekDates,
  selectedDate,
  dayDataMap,
  onDateChange,
  onSwitchToDaily,
}: WeeklyGridHeaderProps) {
  const headers = useMemo(
    () => weekDates.map((d) => formatDayHeader(d)),
    [weekDates],
  );

  return (
    <div className="flex-shrink-0 border-b border-gray-200">
      {/* 날짜 헤더 행 */}
      <div className="flex">
        {/* 시간 거터 공간 */}
        <div className="shrink-0 border-r border-gray-200" style={{ width: TIME_GUTTER_WIDTH }} />

        {/* 7개 날짜 헤더 */}
        {headers.map((h) => {
          const isSelected = h.fullDate === selectedDate;

          return (
            <button
              key={h.fullDate}
              onClick={() => onSwitchToDaily ? onSwitchToDaily(h.fullDate) : onDateChange(h.fullDate)}
              className={cn(
                'flex-1 flex flex-col items-center py-2 transition-colors',
                'border-r border-gray-200 last:border-r-0',
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-medium',
                  isSelected ? 'text-blue-600' : h.isToday ? 'text-blue-600' : h.isPast ? 'text-gray-300' : 'text-gray-500',
                )}
              >
                {h.dayName}
              </span>
              <span
                className={cn(
                  'w-[34px] h-[34px] flex items-center justify-center rounded-full text-[22px] font-medium transition-colors',
                  isSelected && 'bg-blue-600 text-white',
                  h.isToday && !isSelected && 'ring-2 ring-blue-500 text-blue-600',
                  !h.isToday && !isSelected && h.isPast && 'text-gray-300',
                  !h.isToday && !isSelected && !h.isPast && 'text-gray-800 hover:bg-gray-100',
                )}
              >
                {h.dateNum}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
