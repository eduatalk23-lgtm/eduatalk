'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import { getNonStudyBlockColors } from '../utils/timeGridUtils';
import type { PlanItemData } from '@/lib/types/planItem';

interface GridNonStudyBlockProps {
  plan: PlanItemData;
  top: number;
  height: number;
  /** 컬럼 레이아웃 참여 시 left% (없으면 0, full-width) */
  left?: number;
  /** 컬럼 레이아웃 참여 시 width% (없으면 100) */
  width?: number;
  onClick?: (plan: PlanItemData, anchorRect: DOMRect) => void;
}

export const GridNonStudyBlock = memo(function GridNonStudyBlock({
  plan,
  top,
  height,
  left,
  width,
  onClick,
}: GridNonStudyBlockProps) {
  const colorKey = plan.eventSubtype ?? plan.eventKind ?? 'non_study';
  const colors = getNonStudyBlockColors(colorKey);
  const showLabel = height >= 25;
  const hasColumnLayout = left != null && width != null;
  const label = plan.eventSubtype ?? plan.title;
  const startTime = plan.startTime?.substring(0, 5) ?? '';
  const endTime = plan.endTime?.substring(0, 5) ?? '';

  return (
    <div
      data-grid-block
      role="button"
      tabIndex={0}
      aria-label={`${label} ${startTime}-${endTime}`}
      className={cn(
        'absolute rounded-md border cursor-pointer overflow-hidden select-none',
        'transition-[shadow,filter] duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
        colors.bg,
        colors.border,
        'hover:shadow-sm hover:brightness-[0.92] hover:z-[40]',
        !hasColumnLayout && 'left-0 right-0',
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        ...(hasColumnLayout ? { left: `${left}%`, width: `${width}%` } : {}),
      }}
      onClick={(e) => onClick?.(plan, e.currentTarget.getBoundingClientRect())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(plan, e.currentTarget.getBoundingClientRect());
        }
      }}
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
            {label}
          </span>
          <span className={cn('text-[10px] tabular-nums shrink-0', colors.text, 'opacity-60')}>
            {startTime}-{endTime}
          </span>
        </div>
      )}
    </div>
  );
});
