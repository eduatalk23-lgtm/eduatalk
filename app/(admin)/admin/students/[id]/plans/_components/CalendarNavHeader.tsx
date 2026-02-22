'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import {
  shiftDay,
  shiftWeek,
  shiftMonth,
  formatMonthYear,
  getTodayString,
} from './utils/weekDateUtils';

export type CalendarView = 'daily' | 'weekly' | 'month';

const VIEW_OPTIONS: { key: CalendarView; label: string; shortLabel: string; shortcut: string }[] = [
  { key: 'daily', label: '일간', shortLabel: '일', shortcut: 'D' },
  { key: 'weekly', label: '주간', shortLabel: '주', shortcut: 'W' },
  { key: 'month', label: '월간', shortLabel: '월', shortcut: 'M' },
];

interface CalendarNavHeaderProps {
  activeView: CalendarView;
  onViewChange: (view: CalendarView) => void;
  selectedDate: string;
  onNavigate: (date: string) => void;
  totalCount?: number;
  completedCount?: number;
}

export const CalendarNavHeader = memo(function CalendarNavHeader({
  activeView,
  onViewChange,
  selectedDate,
  onNavigate,
  totalCount,
  completedCount,
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

  const activeOption = VIEW_OPTIONS.find((v) => v.key === activeView) ?? VIEW_OPTIONS[1];

  const handlePrev = useCallback(() => {
    if (activeView === 'daily') onNavigate(shiftDay(selectedDate, -1));
    else if (activeView === 'weekly') onNavigate(shiftWeek(selectedDate, -1));
    else onNavigate(shiftMonth(selectedDate, -1));
  }, [activeView, selectedDate, onNavigate]);

  const handleNext = useCallback(() => {
    if (activeView === 'daily') onNavigate(shiftDay(selectedDate, 1));
    else if (activeView === 'weekly') onNavigate(shiftWeek(selectedDate, 1));
    else onNavigate(shiftMonth(selectedDate, 1));
  }, [activeView, selectedDate, onNavigate]);

  const handleToday = useCallback(() => {
    onNavigate(getTodayString());
  }, [onNavigate]);

  const monthYearText = formatMonthYear(selectedDate);

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-blue-200">
      {/* 왼쪽: 오늘 + < > + 월/년 */}
      <div className="flex items-center min-w-0">
        <button
          onClick={handleToday}
          className="shrink-0 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
        >
          오늘
        </button>

        <div className="flex items-center ml-2">
          <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-white/60 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-white/60 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <span className="ml-2 text-[22px] font-normal text-gray-800 truncate leading-none">
          {monthYearText}
        </span>

        {totalCount !== undefined && totalCount > 0 && (
          <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
            {completedCount ?? 0}/{totalCount}
          </span>
        )}
      </div>

      {/* 오른쪽: 뷰 드롭다운 */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
        >
          {activeOption.shortLabel}
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform',
            dropdownOpen && 'rotate-180'
          )} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg shadow-lg border border-gray-200 bg-white py-1.5">
            {VIEW_OPTIONS.map((view) => (
              <button
                key={view.key}
                onClick={() => {
                  onViewChange(view.key);
                  setDropdownOpen(false);
                }}
                className={cn(
                  'w-full flex items-center px-3 py-2 text-sm transition-colors',
                  activeView === view.key
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span className="w-5 shrink-0">
                  {activeView === view.key && <Check className="w-4 h-4" />}
                </span>
                <span className="flex-1 text-left">{view.label}</span>
                <span className={cn(
                  'text-xs ml-4',
                  activeView === view.key ? 'text-blue-400' : 'text-gray-400'
                )}>{view.shortcut}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
