'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { AllDayItem } from '@/lib/query-options/adminDock';

/** AllDayItem 타입별 색상 (Google Calendar 스타일 전체 너비 바) */
export function getAllDayBarColors(item: AllDayItem): {
  bg: string;
  text: string;
  border: string;
} {
  switch (item.type) {
    case '제외일':
      return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-400' };
    case '학원':
      return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400' };
    case '수면':
      return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400' };
    case '아침식사':
    case '점심식사':
    case '저녁식사':
      return { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-400' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-400' };
  }
}

interface AllDayItemBarProps {
  item: AllDayItem;
}

/** Google Calendar 스타일 전체 너비 컬러 바 */
export const AllDayItemBar = memo(function AllDayItemBar({ item }: AllDayItemBarProps) {
  const colors = getAllDayBarColors(item);

  return (
    <div
      data-allday-item
      className={cn(
        'h-[22px] w-full rounded border-l-[3px] px-1.5',
        'flex items-center',
        'text-[11px] font-medium truncate',
        colors.bg,
        colors.text,
        colors.border,
      )}
      title={item.label}
    >
      {item.label}
    </div>
  );
});
