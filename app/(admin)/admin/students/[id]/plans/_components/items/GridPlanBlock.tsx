'use client';

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { Check } from 'lucide-react';
import { HoverQuickActions } from './HoverQuickActions';
import { HoverPreviewCard } from './HoverPreviewCard';
import { minutesToTime, PX_PER_MINUTE } from '../utils/timeGridUtils';
import { getGridBlockColors } from '../utils/subjectColors';
import type { PlanItemData } from '@/lib/types/planItem';
import type { ConflictInfo } from '@/lib/domains/admin-plan/utils/conflictDetection';
import type { PlanStatus } from '@/lib/types/plan';

interface GridPlanBlockProps {
  plan: PlanItemData;
  top: number;
  height: number;
  left: number;
  width: number;
  conflictInfo?: ConflictInfo;
  onEdit?: (id: string) => void;
  /** 블록 클릭 → EventPopover 표시용 (onEdit 대신 사용) */
  onBlockClick?: (plan: PlanItemData, anchorRect: DOMRect) => void;
  onMoveToWeekly?: (id: string) => void;
  onStatusChange?: (id: string, currentStatus: PlanStatus, title: string) => void;
  onQuickStatusChange?: (newStatus: PlanStatus) => void;
  /** 리사이즈 핸들 props (P1-4에서 추가) */
  resizeHandleProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  /** 리사이즈 중 현재 높이 */
  currentResizeHeight?: number;
  isResizing?: boolean;
  /** 검색 하이라이트 여부 */
  isHighlighted?: boolean;
  /** 크로스 데이 드래그 소스 (투명 플레이스홀더) */
  isDragSource?: boolean;
  /** EventPopover가 열려있으면 호버 프리뷰 차단 */
  isPopoverOpen?: boolean;
  /** 크로스데이 드래그 시작 (롱프레스 기반, WeeklyGridView에서 전달) */
  onCrossDayDragStart?: (plan: PlanItemData, e: React.MouseEvent | React.TouchEvent) => void;
}

export const GridPlanBlock = memo(function GridPlanBlock({
  plan,
  top,
  height,
  left,
  width,
  conflictInfo,
  onEdit,
  onBlockClick,
  onMoveToWeekly,
  onStatusChange,
  onQuickStatusChange,
  resizeHandleProps,
  currentResizeHeight,
  isResizing,
  isHighlighted,
  isDragSource,
  isPopoverOpen,
  onCrossDayDragStart,
}: GridPlanBlockProps) {
  const isCompleted = plan.isCompleted;
  const colors = getGridBlockColors(plan.subject, plan.status, isCompleted);
  const displayHeight = isResizing && currentResizeHeight != null ? currentResizeHeight : height;

  // 호버 프리뷰 상태
  const blockRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // 터치 디바이스 판별 (hover 미디어 쿼리) — lazy init으로 SSR 안전 + 렌더 중 ref 접근 방지
  const [supportsHover] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : false
  );

  // 프리뷰 카드 위에 마우스가 있으면 숨기지 않음
  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => {
      setShowPreview(false);
    }, 200);
  }, [cancelHide]);

  const handleMouseEnter = useCallback(() => {
    if (!supportsHover || isPopoverOpen) return;
    cancelHide(); // 프리뷰 카드에서 블록으로 복귀 시 숨김 취소
    hoverTimerRef.current = setTimeout(() => {
      if (blockRef.current) {
        setAnchorRect(blockRef.current.getBoundingClientRect());
        setShowPreview(true);
      }
    }, 300);
  }, [supportsHover, isPopoverOpen, cancelHide]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 즉시 숨기지 않고 200ms 딜레이 (프리뷰 카드로 이동할 시간 확보)
    scheduleHide();
  }, [scheduleHide]);

  // isPopoverOpen이 true가 되면 타이머만 클리어 (프리뷰는 렌더에서 걸러짐)
  useEffect(() => {
    if (isPopoverOpen && hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, [isPopoverOpen]);

  // cleanup
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // 3단계 콘텐츠 밀도
  const tier = displayHeight >= 55 ? 'long' : displayHeight >= 25 ? 'medium' : 'short';

  // 진행률 (long tier에서만 사용)
  const progress = plan.progress ?? 0;

  return (
    <div
      ref={blockRef}
      className={cn(
        'group/plan absolute rounded-md border cursor-pointer overflow-hidden select-none',
        'transition-[shadow,transform] duration-150 ease-out',
        !isDragSource && colors.bg,
        !isDragSource && colors.border,
        isCompleted && !isDragSource && 'opacity-60',
        conflictInfo && !isCompleted && !isDragSource && 'border-orange-400 border-2',
        !isResizing && !isCompleted && !isDragSource && 'hover:shadow-lg hover:z-20 hover:scale-[1.01] hover:-translate-y-px',
        isResizing && 'z-30 shadow-lg ring-2 ring-blue-300',
        isHighlighted && !isDragSource && 'ring-2 ring-yellow-400',
        isDragSource && 'opacity-20 border-dashed border-gray-300 bg-gray-100 pointer-events-none'
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(displayHeight, 10)}px`,
        left: `${left}%`,
        width: `${width}%`,
      }}
      onClick={(e) => {
        // 클릭 시 프리뷰 즉시 닫기 (딜레이 없이)
        cancelHide();
        if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
        setShowPreview(false);
        if (onBlockClick) {
          onBlockClick(plan, e.currentTarget.getBoundingClientRect());
        } else {
          onEdit?.(plan.id);
        }
      }}
      onMouseDown={onCrossDayDragStart ? (e) => onCrossDayDragStart(plan, e) : undefined}
      onTouchStart={onCrossDayDragStart ? (e) => onCrossDayDragStart(plan, e) : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 드래그 소스일 때 내부 컨텐츠 숨겨 빈 플레이스홀더로 표시 */}
      {!isDragSource && (
        <>
          {/* 좌측 액센트 보더 (Google Calendar 스타일) */}
          <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md', colors.accent)} />

          {/* 콘텐츠 — 3단계 밀도 */}
          {tier === 'short' && (
            <div className="pl-2 pr-1 py-0.5 h-full flex items-center min-w-0">
              <span className={cn('text-[10px] font-medium truncate leading-none', colors.text, isCompleted && 'line-through')}>
                {plan.title}
              </span>
            </div>
          )}

          {tier === 'medium' && (
            <div className="pl-2.5 pr-1 py-1 h-full flex flex-col justify-center min-w-0">
              <span className={cn('text-[10px] tabular-nums', colors.text, 'opacity-70')}>
                {plan.startTime?.substring(0, 5)}
                {plan.endTime && ` - ${plan.endTime.substring(0, 5)}`}
              </span>
              <span className={cn('text-xs font-medium truncate leading-tight', colors.text, isCompleted && 'line-through')}>
                {plan.title}
              </span>
            </div>
          )}

          {tier === 'long' && (
            <div className="pl-2.5 pr-1 py-1 h-full flex flex-col justify-center min-w-0 gap-0.5">
              <span className={cn('text-[10px] tabular-nums', colors.text, 'opacity-70')}>
                {plan.startTime?.substring(0, 5)}
                {plan.endTime && ` - ${plan.endTime.substring(0, 5)}`}
              </span>
              <span className={cn('text-xs font-medium truncate leading-tight', colors.text, isCompleted && 'line-through')}>
                {plan.title}
              </span>
              {plan.subject && (
                <span className={cn('text-[10px] truncate', colors.text, 'opacity-60')}>
                  {plan.subject}
                </span>
              )}
              {progress > 0 && (
                <div className="w-full h-1 rounded-full bg-black/5">
                  <div
                    className={cn('h-1 rounded-full', colors.accent)}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* 완료 오버레이 */}
          {isCompleted && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-emerald-500/20 rounded-full p-1">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          )}

          {/* 호버 퀵 액션 */}
          {!isCompleted && (
            <HoverQuickActions
              planId={plan.id}
              isAdHoc={plan.type === 'adhoc'}
              container="daily"
              currentStatus={plan.status}
              onEdit={onEdit}
              onMoveToWeekly={onMoveToWeekly}
              onStatusChange={onQuickStatusChange}
              onDetailedStatusChange={
                onStatusChange
                  ? () => onStatusChange(plan.id, plan.status, plan.title)
                  : undefined
              }
            />
          )}

          {/* 리사이즈 핸들 (P1-4) */}
          {!isCompleted && resizeHandleProps && (
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize opacity-0 group-hover/plan:opacity-100 transition-opacity hover-hover-only flex items-center justify-center"
              onMouseDown={resizeHandleProps.onMouseDown}
              onTouchStart={resizeHandleProps.onTouchStart}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-8 h-0.5 rounded-full bg-gray-400" />
            </div>
          )}

          {/* 리사이즈 중 시간 범위 툴팁 */}
          {isResizing && currentResizeHeight != null && plan.startTime && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50">
              {plan.startTime.substring(0, 5)} – {minutesToTime(
                parseInt(plan.startTime.split(':')[0]) * 60 +
                parseInt(plan.startTime.split(':')[1]) +
                currentResizeHeight / PX_PER_MINUTE
              )}
            </div>
          )}

          {/* 호버 프리뷰 카드 */}
          {supportsHover && (
            <HoverPreviewCard
              plan={plan}
              anchorRect={anchorRect}
              visible={showPreview && !isPopoverOpen}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            />
          )}
        </>
      )}
    </div>
  );
});
