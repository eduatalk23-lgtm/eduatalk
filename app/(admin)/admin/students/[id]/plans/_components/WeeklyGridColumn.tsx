'use client';

import { useMemo, useState, useCallback, useRef, forwardRef } from 'react';
import { GridPlanBlock } from './items/GridPlanBlock';
import { GridNonStudyBlock } from './items/GridNonStudyBlock';
import { toPlanItemData } from '@/lib/types/planItem';
import type { PlanItemData } from '@/lib/types/planItem';
import {
  timeToMinutes,
  minutesToPx,
  assignLevels,
  createGridBackgroundStyle,
  PX_PER_MINUTE,
  SNAP_MINUTES,
} from './utils/timeGridUtils';
import { cn } from '@/lib/cn';
import type { DailyPlan, AdHocPlan, NonStudyItem } from '@/lib/query-options/adminDock';
import type { ConflictInfo } from '@/lib/domains/admin-plan/utils/conflictDetection';
import type { PlanStatus } from '@/lib/types/plan';

interface WeeklyGridColumnProps {
  date: string;
  plans: DailyPlan[];
  adHocPlans: AdHocPlan[];
  nonStudyItems: NonStudyItem[];
  displayRange: { start: string; end: string };
  isToday: boolean;
  isPast?: boolean;
  /** 현재 시간 인디케이터 top (오늘 컬럼에서만 전달) */
  nowTop?: number | null;
  /** 블록 클릭 → EventPopover용 */
  onBlockClick?: (plan: PlanItemData, anchorRect: DOMRect) => void;
  /** fallback: 블록 클릭 → 편집 모달 */
  onEdit?: (planId: string) => void;
  onStatusChange?: (planId: string, currentStatus: PlanStatus, title: string) => void;
  onMoveToWeekly?: (planId: string) => void;
  onQuickStatusChange?: (planId: string, isAdHoc: boolean, newStatus: PlanStatus, prevStatus?: PlanStatus) => void;
  onNonStudyClick?: (item: NonStudyItem, sourceIndex?: number) => void;
  conflictMap?: Map<string, ConflictInfo>;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 퀵생성 후 하이라이트 대상 ID */
  highlightedPlanId?: string | null;
  /** 크로스 데이 드래그 중인 플랜 ID */
  draggingPlanId?: string | null;
  /** EventPopover 열림 상태 (호버 프리뷰 차단용) */
  isPopoverOpen?: boolean;
  /** 빈 영역 호버 피드백 활성화 (plannerId 있고 퀵생성/드래그 중이 아닐 때) */
  enableHover?: boolean;
  /** 크로스데이 드래그 타겟 컬럼 하이라이트 */
  isDragTarget?: boolean;
  /** 크로스데이 드래그 시작 핸들러 */
  onCrossDayDragStart?: (plan: PlanItemData, sourceDate: string, e: React.MouseEvent | React.TouchEvent) => void;
}

export const WeeklyGridColumn = forwardRef<HTMLDivElement, WeeklyGridColumnProps>(
  function WeeklyGridColumn(
    {
      date,
      plans,
      adHocPlans,
      nonStudyItems,
      displayRange,
      isToday,
      isPast,
      nowTop,
      onBlockClick,
      onEdit,
      onStatusChange,
      onMoveToWeekly,
      onQuickStatusChange,
      onNonStudyClick,
      conflictMap,
      searchQuery,
      highlightedPlanId,
      draggingPlanId,
      isPopoverOpen,
      enableHover,
      isDragTarget,
      onCrossDayDragStart,
    },
    ref,
  ) {
    const rangeStartMin = timeToMinutes(displayRange.start);
    const rangeEndMin = timeToMinutes(displayRange.end);
    const totalHeight = (rangeEndMin - rangeStartMin) * PX_PER_MINUTE;

    // 플랜 블록 위치 계산 (겹침 포함)
    const planBlocks = useMemo(() => {
      const allPlans = [
        ...plans
          .filter((p) => p.start_time && p.end_time)
          .map((p) => ({
            id: p.id,
            startMinutes: timeToMinutes(p.start_time!),
            endMinutes: timeToMinutes(p.end_time!),
            plan: toPlanItemData(p, 'plan'),
            original: p,
          })),
        ...adHocPlans
          .filter(
            (p): p is AdHocPlan & { start_time: string; end_time: string } =>
              !!(p as unknown as { start_time?: string }).start_time &&
              !!(p as unknown as { end_time?: string }).end_time,
          )
          .map((p) => ({
            id: p.id,
            startMinutes: timeToMinutes(
              (p as unknown as { start_time: string }).start_time,
            ),
            endMinutes: timeToMinutes(
              (p as unknown as { end_time: string }).end_time,
            ),
            plan: toPlanItemData(p, 'adhoc'),
            original: p,
          })),
      ];

      const withLevels = assignLevels(allPlans);

      return withLevels.map((item) => ({
        ...item,
        top: minutesToPx(item.startMinutes, rangeStartMin, PX_PER_MINUTE),
        height: (item.endMinutes - item.startMinutes) * PX_PER_MINUTE,
        left: (item.level / item.totalLevels) * 100,
        width: (1 / item.totalLevels) * 100,
      }));
    }, [plans, adHocPlans, rangeStartMin]);

    // 비학습시간 블록 위치 계산
    const nonStudyBlocks = useMemo(() => {
      return nonStudyItems.map((item) => {
        const startMin = timeToMinutes(item.start_time);
        const endMin = timeToMinutes(item.end_time);
        return {
          item,
          top: minutesToPx(startMin, rangeStartMin, PX_PER_MINUTE),
          height: (endMin - startMin) * PX_PER_MINUTE,
        };
      });
    }, [nonStudyItems, rangeStartMin]);

    // 검색 하이라이트 판별
    const queryLower = searchQuery?.toLowerCase() ?? '';

    const gridBgStyle = createGridBackgroundStyle(rangeStartMin);

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
        const minutes = rangeStartMin + offsetY / PX_PER_MINUTE;
        const snapped = Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES;
        const top = minutesToPx(snapped, rangeStartMin, PX_PER_MINUTE);
        if (top !== hoveredSlotTopRef.current) {
          hoveredSlotTopRef.current = top;
          setHoveredSlotTop(top);
        }
      },
      [enableHover, rangeStartMin],
    );

    const handleMouseLeave = useCallback(() => {
      hoveredSlotTopRef.current = null;
      setHoveredSlotTop(null);
    }, []);

    return (
      <div
        ref={ref}
        data-column-date={date}
        className={cn('flex-1 relative border-r border-gray-200 last:border-r-0', enableHover && 'cursor-cell')}
        style={{ height: `${totalHeight}px` }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* 호버 하이라이트 */}
        {hoveredSlotTop != null && (
          <div
            className="absolute left-0 right-0 bg-blue-100/40 pointer-events-none rounded-sm z-[1]"
            style={{ top: `${hoveredSlotTop}px`, height: `${SNAP_MINUTES * PX_PER_MINUTE}px` }}
          />
        )}

        {/* 크로스데이 드래그 타겟 하이라이트 */}
        {isDragTarget && (
          <div className="absolute inset-0 bg-blue-50/40 pointer-events-none z-[2]" />
        )}

        {/* 과거 컬럼 희미 처리 */}
        {isPast && (
          <div className="absolute inset-0 bg-gray-50/40 pointer-events-none" />
        )}

        {/* 오늘 컬럼 하이라이트 */}
        {isToday && (
          <div className="absolute inset-0 bg-blue-50/30 pointer-events-none" />
        )}

        {/* 그리드라인 레이어 (오버레이 위, 이벤트 아래) */}
        <div className="absolute inset-0 pointer-events-none" style={gridBgStyle} />

        {/* 비학습시간 블록 */}
        {nonStudyBlocks.map((block, idx) => (
          <div key={`ns-${idx}`} data-grid-block>
            <GridNonStudyBlock
              item={block.item}
              top={block.top}
              height={block.height}
              onClick={onNonStudyClick}
            />
          </div>
        ))}

        {/* 플랜 블록 */}
        {planBlocks.map((block) => {
          const isHighlighted = queryLower
            ? [block.plan.title, block.plan.subject]
                .some((f) => f?.toLowerCase().includes(queryLower))
            : block.id === highlightedPlanId;

          return (
            <div key={block.id} data-grid-block>
              <GridPlanBlock
                plan={block.plan}
                top={block.top}
                height={block.height}
                left={block.left}
                width={block.width}
                conflictInfo={conflictMap?.get(block.id)}
                onBlockClick={onBlockClick}
                onEdit={onEdit}
                onMoveToWeekly={onMoveToWeekly}
                onStatusChange={onStatusChange}
                onQuickStatusChange={
                  onQuickStatusChange
                    ? (newStatus) =>
                        onQuickStatusChange(
                          block.plan.id,
                          block.plan.type === 'adhoc',
                          newStatus,
                          block.plan.status,
                        )
                    : undefined
                }
                isHighlighted={isHighlighted}
                isDragSource={draggingPlanId === block.id}
                isPopoverOpen={isPopoverOpen}
                onCrossDayDragStart={
                  onCrossDayDragStart
                    ? (plan, e) => onCrossDayDragStart(plan, date, e)
                    : undefined
                }
              />
            </div>
          );
        })}

        {/* 현재 시간 인디케이터 (오늘 컬럼에서만) */}
        {isToday && nowTop != null && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
            style={{ top: `${nowTop}px` }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
            <div className="flex-1 border-t-2 border-red-500" />
          </div>
        )}

      </div>
    );
  },
);
