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
import { useAdminPlanBasic } from './context/AdminPlanBasicContext';
import { getRotatedWeekdayLabels } from './utils/weekDateUtils';
import { getHolidayName } from '@/lib/domains/calendar/koreanHolidays';

interface MiniMonthCalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  /** 날짜별 이벤트 개수 (밀도 도트 표시용) */
  eventDensityByDate?: Record<string, number>;
  /** 공휴일 표시 여부 (사이드바 토글) */
  showHolidays?: boolean;
}

export const MiniMonthCalendar = memo(function MiniMonthCalendar({
  selectedDate,
  onDateSelect,
  eventDensityByDate,
  showHolidays = true,
}: MiniMonthCalendarProps) {
  // 주 시작 요일 (context에서)
  const { selectedCalendarSettings } = useAdminPlanBasic();
  const weekStartsOn = selectedCalendarSettings?.weekStartsOn ?? 0;
  const WEEKDAY_LABELS = useMemo(() => getRotatedWeekdayLabels(weekStartsOn), [weekStartsOn]);

  // 미니 캘린더의 현재 표시 월 (selectedDate와 독립적으로 관리)
  const [displayMonth, setDisplayMonth] = useState(
    () => startOfMonth(new Date(selectedDate + 'T00:00:00'))
  );

  // 고정 6주(42셀) 그리드 날짜 배열
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(displayMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const calendarEnd = new Date(calendarStart);
    calendarEnd.setDate(calendarStart.getDate() + 41); // 42일 (6주)
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [displayMonth, weekStartsOn]);

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
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {format(displayMonth, 'yyyy년 M월')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-full hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-full hover:bg-[rgb(var(--color-secondary-100))] text-[var(--text-tertiary)] transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7" role="row" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={cn(
              'text-center text-3xs font-medium py-0.5',
              label === '일' && 'text-[rgb(var(--color-error-400))]',
              label === '토' && 'text-[rgb(var(--color-info-400))]',
              label !== '일' && label !== '토' && 'text-[rgb(var(--color-secondary-400))]'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7" role="grid" aria-label={format(displayMonth, 'yyyy년 M월')}>
        {calendarDays.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(date, displayMonth);
          const isTodayDate = isToday(date);
          const isSelected = dateStr === selectedDate;
          const dayOfWeek = date.getDay();

          const eventCount = eventDensityByDate?.[dateStr] ?? 0;
          // 도트 최대 3개 + 시각적 밀도 (GCal 스타일)
          const dotCount = Math.min(eventCount, 3);
          const holiday = isCurrentMonth && showHolidays ? getHolidayName(dateStr) : null;

          const miniDateLabel = format(date, 'yyyy년 M월 d일');
          const miniTodayLabel = isTodayDate ? ', 오늘' : '';
          const miniHolidayLabel = holiday ? `, ${holiday}` : '';
          const miniEventLabel = eventCount > 0 ? `, 이벤트 ${eventCount}개` : '';
          const miniSelectedLabel = isSelected ? ', 선택됨' : '';

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              title={holiday ?? undefined}
              aria-label={`${miniDateLabel}${miniTodayLabel}${miniHolidayLabel}${miniEventLabel}${miniSelectedLabel}`}
              aria-current={isTodayDate ? 'date' : undefined}
              aria-pressed={isSelected}
              role="gridcell"
              className={cn(
                'relative flex flex-col items-center justify-center h-8 text-xs rounded-full transition-colors',
                !isCurrentMonth && 'text-[rgb(var(--color-secondary-300))]',
                isCurrentMonth && 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]',
                isCurrentMonth && holiday && 'text-[rgb(var(--color-error-500))]',
                isCurrentMonth && !holiday && dayOfWeek === 0 && 'text-[rgb(var(--color-error-500))]',
                isCurrentMonth && !holiday && dayOfWeek === 6 && 'text-[rgb(var(--color-info-500))]',
                isTodayDate && !isSelected && 'bg-[rgb(var(--color-info-500))] text-white hover:bg-[rgb(var(--color-info-600))]',
                isSelected && !isTodayDate && 'bg-[rgb(var(--color-info-100))] text-[rgb(var(--color-info-700))] font-semibold',
                isSelected && isTodayDate && 'bg-[rgb(var(--color-info-600))] text-white'
              )}
            >
              <span className={dotCount > 0 ? '-mt-0.5' : ''}>{format(date, 'd')}</span>
              {isCurrentMonth && dotCount > 0 && (
                <span className="absolute bottom-0.5 flex gap-px" aria-hidden="true">
                  {Array.from({ length: dotCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-1 h-1 rounded-full',
                        isTodayDate
                          ? 'bg-white'
                          : isSelected
                            ? 'bg-[rgb(var(--color-info-700))]'
                            : 'bg-[rgb(var(--color-info-500))]',
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
