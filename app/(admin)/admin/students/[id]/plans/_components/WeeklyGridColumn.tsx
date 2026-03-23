'use client';

import { useMemo, useState, useCallback, useRef, forwardRef, memo } from 'react';
import { GridPlanBlock } from './items/GridPlanBlock';
import { toPlanItemData, type PlanItemData } from '@/lib/types/planItem';
import {
  timeToMinutes,
  minutesToPx,
  assignLevels,
  computeZIndex,
  computeLayoutPosition,
  createGridBackgroundStyle,
  PX_PER_MINUTE,
  SNAP_MINUTES,
} from './utils/timeGridUtils';
import { cn } from '@/lib/cn';
import type { DailyPlan } from '@/lib/query-options/adminDock';


interface WeeklyGridColumnProps {
  date: string;
  plans: DailyPlan[];
  customItems: PlanItemData[];
  nonStudyItems: PlanItemData[];
  displayRange: { start: string; end: string };
  isToday: boolean;
  isPast?: boolean;
  /** 현재 시간 인디케이터 top (오늘 컬럼에서만 전달) */
  nowTop?: number | null;
  /** 블록 클릭 → EventPopover용 */
  onBlockClick?: (plan: PlanItemData, anchorRect: DOMRect) => void;
  /** fallback: 블록 클릭 → 편집 모달 */
  onEdit?: (planId: string) => void;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 퀵생성 후 하이라이트 대상 ID */
  highlightedPlanId?: string | null;
  /** 크로스 데이 드래그 중인 플랜 ID */
  draggingPlanId?: string | null;
  /** 빈 영역 호버 피드백 활성화 (calendarId 있고 퀵생성/드래그 중이 아닐 때) */
  enableHover?: boolean;
  /** 크로스데이 드래그 타겟 컬럼 하이라이트 */
  isDragTarget?: boolean;
  /** 크로스데이 드래그 시작 핸들러 */
  onCrossDayDragStart?: (plan: PlanItemData, sourceDate: string, e: React.MouseEvent | React.TouchEvent) => void;
  /** 리사이즈 핸들 props 팩토리 (planId, date, edge) → { onMouseDown, onTouchStart } */
  makeResizeHandleProps?: (planId: string, date: string, edge: 'top' | 'bottom') => {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  /** 현재 리사이즈 중인 플랜 ID */
  resizingPlanId?: string | null;
  /** 리사이즈 중 현재 높이 (px) */
  resizeHeight?: number;
  /** 리사이즈 중인 엣지 */
  resizingEdge?: 'top' | 'bottom';
  /** 줌 적용 pxPerMinute (기본 PX_PER_MINUTE) */
  pxPerMinute?: number;
  /** 블록의 호버 효과/z-index 상승 억제 (퀵생성/드래그 프리뷰 활성 시) */
  suppressBlockHover?: boolean;
  /** 캘린더별 색상 맵 (calendarId → hex) — 좌측 컬러 바에 사용 */
  calendarColorMap?: Map<string, string>;
  /** 관리자 모드 여부 (학생 모드에서는 관리자 이벤트 수정 불가) */
  isAdminMode?: boolean;
}

export const WeeklyGridColumn = memo(forwardRef<HTMLDivElement, WeeklyGridColumnProps>(
  function WeeklyGridColumn(
    {
      date,
      plans,
      customItems,
      nonStudyItems,
      displayRange,
      isToday,
      isPast,
      nowTop,
      onBlockClick,
      onEdit,
      searchQuery,
      highlightedPlanId,
      draggingPlanId,
      enableHover,
      isDragTarget,
      onCrossDayDragStart,
      makeResizeHandleProps,
      resizingPlanId,
      resizeHeight,
      resizingEdge,
      pxPerMinute: ppmProp,
      suppressBlockHover,
      calendarColorMap,
      isAdminMode = true,
    },
    ref,
  ) {
    const ppm = ppmProp ?? PX_PER_MINUTE;
    const rangeStartMin = timeToMinutes(displayRange.start);
    const rangeEndMin = timeToMinutes(displayRange.end);
    const totalHeight = (rangeEndMin - rangeStartMin) * ppm;

    // 플랜 + 비학습 블록 통합 레이아웃 (Google Calendar: 모든 이벤트 동등 컬럼 배치)
    const planBlocks = useMemo(() => {
      const planItems = [
        ...plans
          .filter((p) => p.start_time && p.end_time)
          .map((p) => ({
            id: p.id,
            startMinutes: timeToMinutes(p.start_time!),
            endMinutes: timeToMinutes(p.end_time!),
            plan: toPlanItemData(p, 'plan'),
          })),
        ...customItems
          .filter(
            (item): item is PlanItemData & { startTime: string; endTime: string } =>
              !!item.startTime && !!item.endTime,
          )
          .map((item) => ({
            id: item.id,
            startMinutes: timeToMinutes(item.startTime),
            endMinutes: timeToMinutes(item.endTime),
            plan: item,
          })),
        ...nonStudyItems
          .filter((item) => item.startTime && item.endTime)
          .map((item, idx) => ({
            id: item.id || `ns-${idx}-${item.startTime}`,
            startMinutes: timeToMinutes(item.startTime!),
            endMinutes: timeToMinutes(item.endTime!),
            plan: item,
          })),
      ];

      const withLevels = assignLevels(planItems);

      return withLevels.map((item) => {
        const pos = computeLayoutPosition(item.level, item.totalLevels, item.expandedSpan);
        const source = planItems.find((p) => p.id === item.id)!;
        // 방어: endMinutes ≤ startMinutes (overnight 잔여 또는 데이터 오류) → 자정까지 클램프
        const effectiveEnd = source.endMinutes <= source.startMinutes ? rangeEndMin : source.endMinutes;
        return {
          ...source,
          level: item.level,
          totalLevels: item.totalLevels,
          expandedSpan: item.expandedSpan,
          top: minutesToPx(source.startMinutes, rangeStartMin, ppm),
          height: (effectiveEnd - source.startMinutes) * ppm,
          left: pos.left,
          width: pos.width,
        };
      });
    }, [plans, customItems, nonStudyItems, rangeStartMin, ppm]);

    // 검색 하이라이트 판별
    const queryLower = searchQuery?.toLowerCase() ?? '';

    const gridBgStyle = createGridBackgroundStyle(rangeStartMin, ppm);

    // 빈 영역 호버 피드백
    const [hoveredSlotTop, setHoveredSlotTop] = useState<number | null>(null);
    const hoveredSlotTopRef = useRef<number | null>(null);

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!enableHover || (e.target as HTMLElement).closest('[data-grid-block]')) {
          if (hoveredSlotTopRef.current != null) {
            hoveredSlotTopRef.current = null;
            setHoveredSlotTop(null);
          }
          return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const minutes = rangeStartMin + offsetY / ppm;
        const snapped = Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES;
        const top = minutesToPx(snapped, rangeStartMin, ppm);
        if (top !== hoveredSlotTopRef.current) {
          hoveredSlotTopRef.current = top;
          setHoveredSlotTop(top);
        }
      },
      [enableHover, rangeStartMin, ppm],
    );

    const handleMouseLeave = useCallback(() => {
      hoveredSlotTopRef.current = null;
      setHoveredSlotTop(null);
    }, []);

    return (
      <div
        ref={ref}
        role="gridcell"
        aria-label={date}
        data-column-date={date}
        className={cn('flex-1 relative border-r border-[rgb(var(--color-secondary-200))] last:border-r-0', enableHover && 'cursor-cell')}
        style={{ height: `${totalHeight}px` }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* 호버 하이라이트 */}
        {hoveredSlotTop != null && (
          <div
            className="absolute left-0 right-0 bg-blue-100/40 dark:bg-blue-900/30 pointer-events-none rounded-sm z-[1]"
            style={{ top: `${hoveredSlotTop}px`, height: `${SNAP_MINUTES * ppm}px` }}
          />
        )}

        {/* 크로스데이 드래그 타겟 하이라이트 */}
        {isDragTarget && (
          <div className="absolute inset-0 bg-blue-50/40 dark:bg-blue-900/20 pointer-events-none z-[2]" />
        )}

        {/* 과거 컬럼 희미 처리 */}
        {isPast && (
          <div className="absolute inset-0 bg-[rgb(var(--color-secondary-50))]/40 pointer-events-none" />
        )}

        {/* 오늘 컬럼 하이라이트 */}
        {isToday && (
          <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/20 pointer-events-none" />
        )}

        {/* 그리드라인 레이어 (오버레이 위, 이벤트 아래) */}
        <div className="absolute inset-0 pointer-events-none" style={gridBgStyle} />

        {/* 이벤트 블록 (학습 + 비학습 통합, GCal 단색 스타일) */}
        {planBlocks.map((block) => {
          const isHighlighted = queryLower
            ? [block.plan.title, block.plan.subject]
                .some((f) => f?.toLowerCase().includes(queryLower))
            : block.id === highlightedPlanId;

          const isThisResizing = resizingPlanId === block.id;
          // 상단 리사이즈 중 시각적 top 계산
          const currentResizeTop = isThisResizing && resizingEdge === 'top' && resizeHeight != null
            ? block.top - (resizeHeight - block.height)
            : undefined;

          // 학생 모드에서 관리자 이벤트는 리사이즈/드래그 불가
          const canModifyBlock = isAdminMode || block.plan.creatorRole !== 'admin';
          return (
            <div key={block.id} data-grid-block>
              <GridPlanBlock
                plan={block.plan}
                top={block.top}
                height={block.height}
                left={block.left}
                width={block.width}
                zIndex={computeZIndex(block.level)}
                onBlockClick={onBlockClick}
                onEdit={onEdit}
                isHighlighted={isHighlighted}
                isDragSource={draggingPlanId === block.id}
                calendarColor={calendarColorMap?.get(block.plan.calendarId ?? '') ?? undefined}
                onCrossDayDragStart={
                  canModifyBlock && onCrossDayDragStart
                    ? (plan, e) => onCrossDayDragStart(plan, date, e)
                    : undefined
                }
                resizeHandleProps={canModifyBlock ? makeResizeHandleProps?.(block.id, date, 'bottom') : undefined}
                topResizeHandleProps={canModifyBlock ? makeResizeHandleProps?.(block.id, date, 'top') : undefined}
                currentResizeHeight={isThisResizing ? resizeHeight : undefined}
                resizingEdge={isThisResizing ? resizingEdge : undefined}
                currentResizeTop={currentResizeTop}
                isResizing={isThisResizing}
                suppressHover={suppressBlockHover}
              />
            </div>
          );
        })}

        {/* 현재 시간 인디케이터 (오늘 컬럼에서만) */}
        {isToday && nowTop != null && (
          <div
            className="absolute left-0 right-0 z-[5] pointer-events-none flex items-center"
            style={{ top: `${nowTop}px` }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
            <div className="flex-1 border-t-2 border-red-500" />
          </div>
        )}

      </div>
    );
  },
));
