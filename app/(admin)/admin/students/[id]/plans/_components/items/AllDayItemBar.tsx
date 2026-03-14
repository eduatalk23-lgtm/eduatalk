'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import { resolveCalendarColors } from '../utils/subjectColors';
import type { AllDayItem } from '@/lib/query-options/adminDock';

interface AllDayItemBarProps {
  item: AllDayItem;
  /** 캘린더 기본 색상 (calendarColorMap에서 조회한 hex) */
  calendarColor?: string;
  /** 멀티데이 스팬: 이 날짜에서 차지할 컬럼 수 (1 = 단일날) */
  colSpan?: number;
  /** 멀티데이: 이벤트 시작일이 이 주 전에 있음 (좌측 끝 표시) */
  continuesBefore?: boolean;
  /** 멀티데이: 이벤트 종료일이 이 주 후에 있음 (우측 끝 표시) */
  continuesAfter?: boolean;
  /** 클릭 시 popover 표시 콜백 */
  onClick?: (item: AllDayItem, anchorRect: DOMRect) => void;
}

/** Google Calendar 스타일 전체 너비 컬러 바 */
export const AllDayItemBar = memo(function AllDayItemBar({
  item,
  calendarColor,
  colSpan = 1,
  continuesBefore = false,
  continuesAfter = false,
  onClick,
}: AllDayItemBarProps) {
  const colors = resolveCalendarColors(item.color, calendarColor, 'confirmed', false);
  const isMultiDay = colSpan > 1 || continuesBefore || continuesAfter;

  return (
    <div
      data-allday-item
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'h-[22px] px-1.5',
        'flex items-center',
        'text-[11px] font-medium truncate',
        colors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100',
        // 클릭 가능 시 커서 + 호버 효과
        onClick && 'cursor-pointer hover:brightness-[0.92] hover:shadow-sm transition-[filter,shadow] duration-100',
        // 멀티데이: 좌/우 라운드 조절
        isMultiDay
          ? cn(
              !continuesBefore && 'rounded-l',
              !continuesAfter && 'rounded-r',
              continuesBefore && 'pl-2',
              continuesAfter && 'pr-2',
            )
          : 'rounded',
      )}
      style={{
        backgroundColor: colors.bgHex,
        opacity: colors.opacity,
        ...(colSpan > 1 ? { gridColumn: `span ${colSpan}`, width: '100%' } : {}),
      }}
      title={item.label}
      onClick={onClick ? (e) => {
        e.stopPropagation();
        onClick(item, e.currentTarget.getBoundingClientRect());
      } : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick(item, e.currentTarget.getBoundingClientRect());
        }
      } : undefined}
    >
      {continuesBefore && <span className="mr-0.5 text-[9px] opacity-60">◀</span>}
      {item.label}
      {continuesAfter && <span className="ml-0.5 text-[9px] opacity-60">▶</span>}
    </div>
  );
});
