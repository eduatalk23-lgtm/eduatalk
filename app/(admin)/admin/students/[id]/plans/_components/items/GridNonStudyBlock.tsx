'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import { getNonStudyBlockColors } from '../utils/timeGridUtils';
import type { NonStudyItem } from '@/lib/query-options/adminDock';

interface GridNonStudyBlockProps {
  item: NonStudyItem;
  top: number;
  height: number;
  onClick?: (item: NonStudyItem, sourceIndex?: number) => void;
}

export const GridNonStudyBlock = memo(function GridNonStudyBlock({
  item,
  top,
  height,
  onClick,
}: GridNonStudyBlockProps) {
  const colors = getNonStudyBlockColors(item.type);
  const showLabel = height >= 25;

  return (
    <div
      className={cn(
        'absolute left-0 right-0 rounded-md border transition-shadow cursor-pointer overflow-hidden select-none',
        colors.bg,
        colors.border,
        'hover:shadow-sm'
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
      }}
      onClick={() => onClick?.(item, item.sourceIndex)}
    >
      {/* 스트라이프 배경 */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `repeating-linear-gradient(
            135deg,
            transparent,
            transparent 4px,
            currentColor 4px,
            currentColor 5px
          )`,
        }}
      />

      {/* 라벨 */}
      {showLabel && (
        <div className="relative z-10 px-2 py-1 flex items-center gap-1.5 h-full">
          <span className={cn('text-xs font-medium truncate', colors.text)}>
            {item.label ?? item.type}
          </span>
          <span className={cn('text-[10px] tabular-nums shrink-0', colors.text, 'opacity-60')}>
            {item.start_time.substring(0, 5)}-{item.end_time.substring(0, 5)}
          </span>
        </div>
      )}
    </div>
  );
});
