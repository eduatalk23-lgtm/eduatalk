'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import {
  shiftDay,
  shiftWeek,
  shiftMonth,
  shiftYear,
  shiftCustomDays,
  formatMonthYear,
  getTodayString,
} from './utils/weekDateUtils';

export type CalendarView = 'daily' | 'weekly' | 'month' | 'year' | 'agenda';

const VIEW_OPTIONS: { key: CalendarView; label: string; shortLabel: string; shortcut: string }[] = [
  { key: 'daily', label: '일간', shortLabel: '일', shortcut: 'D' },
  { key: 'weekly', label: '주간', shortLabel: '주', shortcut: 'W' },
  { key: 'month', label: '월간', shortLabel: '월', shortcut: 'M' },
  { key: 'year', label: '연간', shortLabel: '연', shortcut: 'Y' },
  { key: 'agenda', label: '일정 목록', shortLabel: '목록', shortcut: 'L' },
];

const CUSTOM_DAY_OPTIONS = [2, 3, 4, 5, 6, 7] as const;

interface CalendarNavHeaderProps {
  activeView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  selectedDate: string;
  onNavigate: (date: string) => void;
  totalCount?: number;
  completedCount?: number;
  /** 주간 뷰 커스텀 일수 (2~7, 기본 7) */
  customDayCount?: number;
  onCustomDayCountChange?: (count: number) => void;
}

export const CalendarNavHeader = memo(function CalendarNavHeader({
  activeView,
  onViewChange,
  selectedDate,
  onNavigate,
  totalCount,
  completedCount,
  customDayCount = 7,
  onCustomDayCountChange,
}: CalendarNavHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const baseOption = VIEW_OPTIONS.find((v) => v.key === activeView) ?? VIEW_OPTIONS[1];
  // 커스텀 일수가 7이 아니면 shortLabel에 일수 표시
  const activeOption = activeView === 'weekly' && customDayCount < 7
    ? { ...baseOption, shortLabel: `${customDayCount}일` }
    : baseOption;

  const handlePrev = useCallback(() => {
    if (activeView === 'daily') onNavigate(shiftDay(selectedDate, -1));
    else if (activeView === 'weekly') {
      if (customDayCount < 7) onNavigate(shiftCustomDays(selectedDate, -1, customDayCount));
      else onNavigate(shiftWeek(selectedDate, -1));
    }
    else if (activeView === 'year') onNavigate(shiftYear(selectedDate, -1));
    else onNavigate(shiftMonth(selectedDate, -1));  // month & agenda
  }, [activeView, selectedDate, onNavigate, customDayCount]);

  const handleNext = useCallback(() => {
    if (activeView === 'daily') onNavigate(shiftDay(selectedDate, 1));
    else if (activeView === 'weekly') {
      if (customDayCount < 7) onNavigate(shiftCustomDays(selectedDate, 1, customDayCount));
      else onNavigate(shiftWeek(selectedDate, 1));
    }
    else if (activeView === 'year') onNavigate(shiftYear(selectedDate, 1));
    else onNavigate(shiftMonth(selectedDate, 1));  // month & agenda
  }, [activeView, selectedDate, onNavigate, customDayCount]);

  const handleToday = useCallback(() => {
    onNavigate(getTodayString());
  }, [onNavigate]);

  const monthYearText = activeView === 'year'
    ? `${selectedDate.substring(0, 4)}년`
    : formatMonthYear(selectedDate);

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-[rgb(var(--color-secondary-200))]">
      {/* 왼쪽: 오늘 + < > + 월/년 */}
      <div className="flex items-center min-w-0">
        <button
          onClick={handleToday}
          className="shrink-0 px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-300))] rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors"
        >
          오늘
        </button>

        <div className="flex items-center ml-2">
          <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors">
            <ChevronLeft className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
          <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors">
            <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <span className="ml-2 text-[22px] font-normal text-[var(--text-primary)] truncate leading-none">
          {monthYearText}
        </span>

        {totalCount !== undefined && totalCount > 0 && (
          <span className="ml-2 text-xs text-[rgb(var(--color-info-600))] bg-[rgb(var(--color-info-100))] px-2 py-0.5 rounded-full">
            {completedCount ?? 0}/{totalCount}
          </span>
        )}
      </div>

      {/* 오른쪽: 뷰 드롭다운 */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[rgb(var(--color-secondary-50))] border border-[rgb(var(--color-secondary-300))] rounded-full hover:bg-[rgb(var(--color-secondary-100))] transition-colors"
        >
          {activeOption.shortLabel}
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform',
            dropdownOpen && 'rotate-180'
          )} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg shadow-lg border border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-50))] py-1.5">
            {VIEW_OPTIONS.map((view) => (
              <button
                key={view.key}
                onClick={() => {
                  onViewChange(view.key);
                  if (view.key === 'weekly') onCustomDayCountChange?.(7);
                  setDropdownOpen(false);
                }}
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm transition-colors',
                  activeView === view.key && (view.key !== 'weekly' || customDayCount === 7)
                    ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                    : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                )}
              >
                <span className="w-5 shrink-0">
                  {activeView === view.key && (view.key !== 'weekly' || customDayCount === 7) && <Check className="w-4 h-4" />}
                </span>
                <span className="flex-1 text-left">{view.label}</span>
                <span className={cn(
                  'text-xs ml-4',
                  activeView === view.key ? 'text-blue-400 dark:text-blue-300' : 'text-[rgb(var(--color-secondary-400))]'
                )}>{view.shortcut}</span>
              </button>
            ))}

            {/* 커스텀 일수 옵션 */}
            {onCustomDayCountChange && (
              <>
                <div className="border-t border-[rgb(var(--color-secondary-100))] my-1" />
                <div className="px-3 py-1.5 text-xs text-[rgb(var(--color-secondary-400))] font-medium">커스텀 뷰</div>
                {CUSTOM_DAY_OPTIONS.filter((n) => n < 7).map((n) => (
                  <button
                    key={`custom-${n}`}
                    onClick={() => {
                      onViewChange('weekly');
                      onCustomDayCountChange(n);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center px-3 py-2 text-sm transition-colors',
                      activeView === 'weekly' && customDayCount === n
                        ? 'bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-600))]'
                        : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]'
                    )}
                  >
                    <span className="w-5 shrink-0">
                      {activeView === 'weekly' && customDayCount === n && <Check className="w-4 h-4" />}
                    </span>
                    <span className="flex-1 text-left">{n}일</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
