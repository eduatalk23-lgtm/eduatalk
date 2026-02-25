'use client';

import { memo, useRef } from 'react';
import { cn } from '@/lib/cn';
import { Check } from 'lucide-react';
import { minutesToTime, PX_PER_MINUTE } from '../utils/timeGridUtils';
import { resolveCalendarColors } from '../utils/subjectColors';
import type { PlanItemData } from '@/lib/types/planItem';

interface GridPlanBlockProps {
  plan: PlanItemData;
  top: number;
  height: number;
  left: number;
  width: number;
  zIndex?: number;
  onEdit?: (id: string) => void;
  onBlockClick?: (plan: PlanItemData, anchorRect: DOMRect) => void;
  resizeHandleProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  topResizeHandleProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  currentResizeHeight?: number;
  resizingEdge?: 'top' | 'bottom';
  currentResizeTop?: number;
  isResizing?: boolean;
  isHighlighted?: boolean;
  isDragSource?: boolean;
  onCrossDayDragStart?: (plan: PlanItemData, e: React.MouseEvent | React.TouchEvent) => void;
  suppressHover?: boolean;
  /** 캘린더 기본 색상 (hex 또는 팔레트 키) */
  calendarColor?: string | null;
}

export const GridPlanBlock = memo(function GridPlanBlock({
  plan,
  top,
  height,
  left,
  width,
  zIndex,
  onEdit,
  onBlockClick,
  resizeHandleProps,
  topResizeHandleProps,
  currentResizeHeight,
  resizingEdge,
  currentResizeTop,
  isResizing,
  isHighlighted,
  isDragSource,
  onCrossDayDragStart,
  suppressHover,
  calendarColor,
}: GridPlanBlockProps) {
  const isCompleted = plan.isCompleted;
  const colors = resolveCalendarColors(plan.color, calendarColor, plan.status, isCompleted);
  const displayHeight = isResizing && currentResizeHeight != null ? currentResizeHeight : height;
  const blockRef = useRef<HTMLDivElement>(null);

  // 4단계 콘텐츠 밀도
  const tier: 'chip' | 'short' | 'medium' | 'long' =
    displayHeight < 15 ? 'chip' :
    displayHeight < 30 ? 'short' :
    displayHeight < 45 ? 'medium' : 'long';

  const progress = plan.progress ?? 0;
  const textColor = colors.textIsWhite ? 'text-white' : 'text-gray-900';

  const ariaLabel = [
    plan.title,
    plan.startTime && `${plan.startTime.substring(0, 5)}`,
    plan.endTime && `- ${plan.endTime.substring(0, 5)}`,
    plan.subject,
    plan.isCompleted ? '완료' : undefined,
  ].filter(Boolean).join(' ');

  // 좌측 바: 항상 표시 (GCal 패턴)

  return (
    <div
      ref={blockRef}
      data-grid-block
      role="button"
      tabIndex={isDragSource ? -1 : 0}
      aria-label={ariaLabel}
      className={cn(
        'group/plan absolute rounded-lg select-none overflow-hidden',
        isResizing ? 'cursor-ns-resize' : onCrossDayDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        'transition-[shadow,transform,filter] duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
        !isResizing && !isDragSource && !suppressHover && 'hover:shadow-lg hover:brightness-[0.92] hover:scale-[1.01] hover:-translate-y-px',
        isResizing && 'shadow-lg',
        !isDragSource && isHighlighted && 'ring-2 ring-yellow-400',
        isDragSource && 'opacity-30 pointer-events-none',
      )}
      style={{
        top: `${currentResizeTop != null ? currentResizeTop : top}px`,
        height: `${Math.max(displayHeight, 4)}px`,
        left: `${left}%`,
        width: `${width}%`,
        zIndex: isResizing ? 30 : zIndex,
        backgroundColor: colors.bgHex,
        border: '1px solid white',
        opacity: colors.opacity,
      }}
      title={tier === 'chip' ? `${plan.title} (${plan.startTime?.substring(0, 5)} - ${plan.endTime?.substring(0, 5)})` : undefined}
      onClick={(e) => {
        if (isResizing || isDragSource) return;
        if (onBlockClick) {
          const blockRect = e.currentTarget.getBoundingClientRect();
          // 일간 뷰: 블록이 뷰포트 절반 이상 → 클릭 위치 기반 앵커 (GCal 패턴)
          if (blockRect.width > window.innerWidth * 0.5) {
            onBlockClick(plan, new DOMRect(e.clientX - 4, blockRect.y, 8, blockRect.height));
          } else {
            onBlockClick(plan, blockRect);
          }
        } else {
          onEdit?.(plan.id);
        }
      }}
      onKeyDown={(e) => {
        if (isResizing || isDragSource) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onBlockClick) {
            onBlockClick(plan, e.currentTarget.getBoundingClientRect());
          } else {
            onEdit?.(plan.id);
          }
        }
      }}
      onMouseEnter={() => {
        if (!isResizing && !isDragSource && !suppressHover && blockRef.current) {
          blockRef.current.style.zIndex = '40';
        }
      }}
      onMouseLeave={() => {
        if (blockRef.current) {
          blockRef.current.style.zIndex = String(isResizing ? 30 : (zIndex ?? ''));
        }
      }}
      onMouseDown={onCrossDayDragStart ? (e) => {
        if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
        onCrossDayDragStart(plan, e);
      } : undefined}
      onTouchStart={onCrossDayDragStart ? (e) => {
        if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
        onCrossDayDragStart(plan, e);
      } : undefined}
    >
      {/* 좌측 캘린더 컬러 인디케이터 (Google Calendar 스타일) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: colors.barHex }}
      />

      {/* Chip (< 15px): 바만 */}
      {tier === 'chip' && null}

      {/* Short (15-29px): 제목만 */}
      {tier === 'short' && (
        <div className="pl-3 pr-1.5 py-0.5 h-full flex items-center min-w-0">
          <span className={cn(
            'text-[10px] font-medium truncate leading-none',
            textColor,
            colors.strikethrough && 'line-through',
          )}>
            {plan.title}
          </span>
        </div>
      )}

      {/* Medium (30-44px): 제목, 시간 */}
      {tier === 'medium' && (
        <div className="pl-3 pr-1.5 py-0.5 h-full flex flex-col justify-center min-w-0 overflow-hidden">
          <span className={cn(
            'text-xs font-medium truncate leading-tight',
            textColor,
            colors.strikethrough && 'line-through',
          )}>
            {plan.title}
          </span>
          <span className={cn('text-[10px] tabular-nums opacity-80 truncate', textColor)}>
            {plan.startTime?.substring(0, 5)}
            {plan.endTime && ` - ${plan.endTime.substring(0, 5)}`}
          </span>
        </div>
      )}

      {/* Long (≥ 45px): 제목, 시간, 과목, 진행률 */}
      {tier === 'long' && (
        <div className="pl-3 pr-1.5 py-0.5 h-full flex flex-col justify-center min-w-0 overflow-hidden">
          <span className={cn(
            'text-xs font-medium truncate leading-tight',
            textColor,
            colors.strikethrough && 'line-through',
          )}>
            {plan.title}
          </span>
          <span className={cn('text-[10px] tabular-nums opacity-80 truncate', textColor)}>
            {plan.startTime?.substring(0, 5)}
            {plan.endTime && ` - ${plan.endTime.substring(0, 5)}`}
          </span>
          {plan.subject && (
            <span className={cn('text-[10px] truncate opacity-70', textColor)}>
              {plan.subject}
            </span>
          )}
          {plan.status === 'in_progress' && progress > 0 && (
            <div className="w-full h-1 rounded-full bg-white/20">
              <div
                className="h-1 rounded-full bg-white/60"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 완료 체크마크 */}
      {isCompleted && displayHeight >= 20 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full p-0.5 bg-white/30">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}

      {/* 상단 리사이즈 핸들 — Desktop */}
      {!isCompleted && topResizeHandleProps && (
        <div
          data-resize-handle
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover/plan:opacity-100 transition-opacity hover-hover-only flex items-center justify-center"
          onMouseDown={topResizeHandleProps.onMouseDown}
          onTouchStart={topResizeHandleProps.onTouchStart}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-8 h-0.5 rounded-full bg-white/60" />
        </div>
      )}
      {/* 상단 리사이즈 핸들 — Touch */}
      {!isCompleted && topResizeHandleProps && displayHeight >= 20 && (
        <div
          data-resize-handle
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 hidden touch:flex items-center justify-center w-10 h-5 cursor-ns-resize"
          onTouchStart={topResizeHandleProps.onTouchStart}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-2.5 h-2.5 rounded-full border-2 shadow-sm bg-white border-white/80" />
        </div>
      )}

      {/* 하단 리사이즈 핸들 — Desktop */}
      {!isCompleted && resizeHandleProps && (
        <div
          data-resize-handle
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover/plan:opacity-100 transition-opacity hover-hover-only flex items-center justify-center"
          onMouseDown={resizeHandleProps.onMouseDown}
          onTouchStart={resizeHandleProps.onTouchStart}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-8 h-0.5 rounded-full bg-white/60" />
        </div>
      )}
      {/* 하단 리사이즈 핸들 — Touch */}
      {!isCompleted && resizeHandleProps && displayHeight >= 20 && (
        <div
          data-resize-handle
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 hidden touch:flex items-center justify-center w-10 h-5 cursor-ns-resize"
          onTouchStart={resizeHandleProps.onTouchStart}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-2.5 h-2.5 rounded-full border-2 shadow-sm bg-white border-white/80" />
        </div>
      )}

      {/* 리사이즈 시간 툴팁 — 상단 */}
      {isResizing && resizingEdge === 'top' && currentResizeHeight != null && plan.endTime && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[rgb(var(--color-secondary-900))] text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50">
          {minutesToTime(
            parseInt(plan.endTime.split(':')[0]) * 60 +
            parseInt(plan.endTime.split(':')[1]) -
            currentResizeHeight / PX_PER_MINUTE
          )} – {plan.endTime.substring(0, 5)}
        </div>
      )}

      {/* 리사이즈 시간 툴팁 — 하단 */}
      {isResizing && resizingEdge !== 'top' && currentResizeHeight != null && plan.startTime && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[rgb(var(--color-secondary-900))] text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50">
          {plan.startTime.substring(0, 5)} – {minutesToTime(
            parseInt(plan.startTime.split(':')[0]) * 60 +
            parseInt(plan.startTime.split(':')[1]) +
            currentResizeHeight / PX_PER_MINUTE
          )}
        </div>
      )}
    </div>
  );
});
