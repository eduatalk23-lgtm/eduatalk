'use client';

import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight, Menu, ChevronDown, Check } from 'lucide-react';
import type { CalendarView } from './CalendarNavHeader';
import {
  shiftDay,
  shiftWeek,
  shiftMonth,
  formatMonthYear,
  formatDayHeader,
  getTodayString,
} from './utils/weekDateUtils';

interface CalendarTopBarProps {
  activeView: CalendarView;
  onViewChange: (v: CalendarView) => void;
  selectedDate: string;
  onNavigate: (date: string) => void;
  onToggleSidebar: () => void;
  totalCount?: number;
  completedCount?: number;
  /** 'topbar': Global TopBar 내 portal 렌더링용 (contents로 부모 flex 참여)
   *  'standalone': 독립 사용 시 기존 스타일 유지 */
  variant?: 'standalone' | 'topbar';
  /** 날짜로 이동 다이얼로그 열기 콜백 */
  onGoToDate?: () => void;
}

const VIEW_OPTIONS: { key: CalendarView; label: string; shortLabel: string; shortcut: string }[] = [
  { key: 'daily', label: '일간', shortLabel: '일', shortcut: 'D' },
  { key: 'weekly', label: '주간', shortLabel: '주', shortcut: 'W' },
  { key: 'month', label: '월간', shortLabel: '월', shortcut: 'M' },
];

/**
 * Google Calendar 스타일 상단 바
 *
 * TopBar portal(variant='topbar')시 contents로 렌더링되어
 * 부모 flex에 직접 참여 → order로 [☰][로고][컨트롤][뷰▼] 배치
 */
export const CalendarTopBar = memo(function CalendarTopBar({
  activeView,
  onViewChange,
  selectedDate,
  onNavigate,
  onToggleSidebar,
  totalCount,
  completedCount,
  variant = 'topbar',
  onGoToDate,
}: CalendarTopBarProps) {
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

  const isTopbar = variant === 'topbar';

  const hoverBg = isTopbar
    ? 'hover:bg-[rgb(var(--color-secondary-200))] dark:hover:bg-[rgb(var(--color-secondary-700))]'
    : 'hover:bg-gray-100';
  const iconColor = isTopbar ? 'text-[var(--text-secondary)]' : 'text-gray-600';

  // topbar variant: contents로 부모 flex에 참여, order로 배치
  if (isTopbar) {
    return (
      <div className="contents">
        {/* ☰ 사이드바 토글 — order-0 (로고 order-1 앞) */}
        <button
          onClick={onToggleSidebar}
          className={cn('hidden md:flex order-0 p-2 rounded-full transition-colors shrink-0', hoverBg)}
          title="사이드바 토글"
        >
          <Menu className={cn('w-5 h-5', iconColor)} />
        </button>

        {/* 캘린더 컨트롤 — order-2 (로고 order-1 뒤) */}
        <div className="hidden md:flex order-2 items-center flex-1 min-w-0 ml-4">
          {/* 오늘 버튼 */}
          <button
            onClick={handleToday}
            className={cn(
              'shrink-0 px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
              'text-[var(--text-secondary)] border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-600))] hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]'
            )}
          >
            오늘
          </button>

          {/* < > 네비게이션 (밀착) */}
          <div className="flex items-center ml-2">
            <button
              onClick={handlePrev}
              className={cn('p-1.5 rounded-full transition-colors', hoverBg)}
            >
              <ChevronLeft className={cn('w-5 h-5', iconColor)} />
            </button>
            <button
              onClick={handleNext}
              className={cn('p-1.5 rounded-full transition-colors', hoverBg)}
            >
              <ChevronRight className={cn('w-5 h-5', iconColor)} />
            </button>
          </div>

          {/* 월/년 텍스트 */}
          <h2
            className={cn(
              "ml-2 text-[22px] font-normal truncate flex items-center gap-2 leading-none text-[var(--text-primary)]",
              onGoToDate && "cursor-pointer hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))] rounded-lg px-2 -mx-2 py-1 -my-1 transition-colors"
            )}
            onClick={onGoToDate}
            title={onGoToDate ? "날짜로 이동 (Shift+G)" : undefined}
          >
            {monthYearText}
            {activeView === 'daily' && (() => {
              const dayInfo = formatDayHeader(selectedDate);
              return (
                <>
                  <span
                    className={cn(
                      'w-9 h-9 flex items-center justify-center rounded-full text-base font-medium',
                      dayInfo.isToday
                        ? 'bg-blue-500 text-white'
                        : 'text-[var(--text-primary)]',
                    )}
                  >
                    {dayInfo.dateNum}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-normal',
                      dayInfo.isToday ? 'text-blue-600' : 'text-[var(--text-tertiary)]',
                    )}
                  >
                    {dayInfo.dayName}
                  </span>
                </>
              );
            })()}
          </h2>

          {totalCount !== undefined && totalCount > 0 && (
            <span className="ml-3 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              {completedCount ?? 0}/{totalCount}
            </span>
          )}
        </div>

        {/* 뷰 드롭다운 — order-3 (오늘 버튼과 동일 스타일) */}
        <div className="hidden md:block order-3 relative shrink-0 ml-2" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className={cn(
              'flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
              'text-[var(--text-secondary)] border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-600))] hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]'
            )}
          >
            {activeOption.shortLabel}
            <ChevronDown className={cn(
              'w-4 h-4 transition-transform',
              dropdownOpen && 'rotate-180'
            )} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg shadow-lg border py-1.5 bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))] border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
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
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-[var(--text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]'
                  )}
                >
                  {/* 체크 아이콘 (활성 표시) */}
                  <span className="w-5 shrink-0">
                    {activeView === view.key && <Check className="w-4 h-4" />}
                  </span>
                  <span className="flex-1 text-left">{view.label}</span>
                  <span className={cn(
                    'text-xs ml-4',
                    activeView === view.key
                      ? 'text-blue-400 dark:text-blue-500'
                      : 'text-[var(--text-tertiary)]'
                  )}>{view.shortcut}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // standalone variant: 기존 독립형 레이아웃
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
      <div className="flex items-center min-w-0">
        <button
          onClick={onToggleSidebar}
          className={cn('p-2 rounded-full transition-colors', hoverBg)}
          title="사이드바 토글"
        >
          <Menu className={cn('w-5 h-5', iconColor)} />
        </button>

        <button
          onClick={handleToday}
          className="shrink-0 px-4 py-1.5 ml-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
        >
          오늘
        </button>

        <div className="flex items-center ml-2">
          <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <h2
          className={cn(
            "ml-2 text-[22px] font-normal truncate flex items-center gap-2 leading-none text-gray-800",
            onGoToDate && "cursor-pointer hover:bg-gray-100 rounded-lg px-2 -mx-2 py-1 -my-1 transition-colors"
          )}
          onClick={onGoToDate}
          title={onGoToDate ? "날짜로 이동 (Shift+G)" : undefined}
        >
          {monthYearText}
          {activeView === 'daily' && (() => {
            const dayInfo = formatDayHeader(selectedDate);
            return (
              <>
                <span
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-full text-base font-medium',
                    dayInfo.isToday ? 'bg-blue-500 text-white' : 'text-gray-800',
                  )}
                >
                  {dayInfo.dateNum}
                </span>
                <span className={cn('text-sm font-normal', dayInfo.isToday ? 'text-blue-600' : 'text-gray-500')}>
                  {dayInfo.dayName}
                </span>
              </>
            );
          })()}
        </h2>

        {totalCount !== undefined && totalCount > 0 && (
          <span className="ml-3 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
            {completedCount ?? 0}/{totalCount}
          </span>
        )}
      </div>

      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
        >
          {activeOption.shortLabel}
          <ChevronDown className={cn('w-4 h-4 transition-transform', dropdownOpen && 'rotate-180')} />
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
