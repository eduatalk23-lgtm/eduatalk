'use client';

import { useMemo, useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { GridPlanBlock } from './items/GridPlanBlock';
import { GridNonStudyBlock } from './items/GridNonStudyBlock';
import { AllDayItemBar } from './items/AllDayItemBar';
import { InlineQuickCreate } from './items/InlineQuickCreate';
import { EventPopover } from './items/EventPopover';
import { useResizable } from './hooks/useResizable';
import { useDragToCreate } from './hooks/useDragToCreate';
import { usePopoverPosition, placementToTransformOrigin } from './hooks/usePopoverPosition';
import { toPlanItemData, type PlanItemData } from '@/lib/types/planItem';
import { formatDayHeader } from './utils/weekDateUtils';
import {
  timeToMinutes,
  minutesToPx,
  minutesToTime,
  assignLevels,
  formatHourLabel,
  createGridBackgroundStyle,
  PX_PER_MINUTE,
  SNAP_MINUTES,
  TIME_GUTTER_WIDTH,
  DEFAULT_DISPLAY_RANGE,
} from './utils/timeGridUtils';
import { updateItemTime, updatePlanStatus } from '@/lib/domains/calendar/actions/legacyBridge';
import { useUndo } from './UndoSnackbar';
import { cn } from '@/lib/cn';
import type { DailyPlan, AdHocPlan, NonStudyItem, AllDayItem } from '@/lib/query-options/adminDock';
import type { EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import type { ConflictInfo } from '@/lib/domains/admin-plan/utils/conflictDetection';
import type { PlanStatus } from '@/lib/types/plan';

interface DailyDockGridViewProps {
  plans: DailyPlan[];
  adHocPlans: AdHocPlan[];
  nonStudyItems: NonStudyItem[];
  selectedDate: string;
  displayRange?: { start: string; end: string };
  conflictMap?: Map<string, ConflictInfo>;
  // 빈 시간 클릭 → 플랜 생성용
  studentId: string;
  tenantId: string;
  plannerId?: string;
  planGroupId?: string | null;
  // 액션 콜백
  onEdit?: (planId: string) => void;
  onStatusChange?: (planId: string, currentStatus: PlanStatus, title: string) => void;
  onMoveToWeekly?: (planId: string) => void;
  onRefresh: () => void;
  onNonStudyClick?: (item: NonStudyItem, sourceIndex?: number) => void;
  onCreatePlanAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  // P1-4: 리사이즈
  onResizeEnd?: (planId: string, newHeightPx: number) => void;
  // EventPopover 삭제 액션
  onDelete?: (planId: string, isAdHoc: boolean) => void;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 종일 이벤트 목록 */
  allDayItems?: AllDayItem[];
}

const ALL_DAY_COLLAPSE_THRESHOLD = 2;

/**
 * 세로 시간축 일간 그리드 뷰
 * 구글 캘린더 스타일의 시간축 기반 레이아웃
 */
export const DailyDockGridView = memo(function DailyDockGridView({
  plans,
  adHocPlans,
  nonStudyItems,
  selectedDate,
  displayRange = DEFAULT_DISPLAY_RANGE,
  conflictMap,
  studentId,
  tenantId,
  plannerId,
  planGroupId,
  onEdit,
  onStatusChange,
  onMoveToWeekly,
  onRefresh,
  onNonStudyClick,
  onCreatePlanAtSlot,
  onDelete,
  searchQuery,
  allDayItems,
}: DailyDockGridViewProps) {
  const { pushUndoable } = useUndo();
  const containerRef = useRef<HTMLDivElement>(null);
  const [allDayExpanded, setAllDayExpanded] = useState(false);
  const rangeStartMin = timeToMinutes(displayRange.start);
  const rangeEndMin = timeToMinutes(displayRange.end);
  const totalHeight = (rangeEndMin - rangeStartMin) * PX_PER_MINUTE;

  // 시간 라벨 (Weekly와 동일하게 최상단 라벨 생략)
  const hourLabels = useMemo(() => {
    const labels: number[] = [];
    const startHour = Math.ceil(rangeStartMin / 60);
    const endHour = Math.floor(rangeEndMin / 60);
    for (let h = startHour; h <= endHour; h++) {
      if (h * 60 === rangeStartMin) continue;
      labels.push(h);
    }
    return labels;
  }, [rangeStartMin, rangeEndMin]);

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
        .filter((p): p is AdHocPlan & { start_time: string; end_time: string } =>
          !!(p as unknown as { start_time?: string }).start_time &&
          !!(p as unknown as { end_time?: string }).end_time
        )
        .map((p) => ({
          id: p.id,
          startMinutes: timeToMinutes((p as unknown as { start_time: string }).start_time),
          endMinutes: timeToMinutes((p as unknown as { end_time: string }).end_time),
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

  // 현재 시간 인디케이터
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  // 현재 시간으로 자동 스크롤
  useEffect(() => {
    if (nowMinutes == null || !containerRef.current) return;
    const scrollTarget = minutesToPx(nowMinutes, rangeStartMin, PX_PER_MINUTE) - 200;
    containerRef.current.scrollTop = Math.max(0, scrollTarget);
  }, [nowMinutes, rangeStartMin]);

  // EventPopover 상태
  const [popoverState, setPopoverState] = useState<{
    plan: PlanItemData;
    anchorRect: DOMRect;
  } | null>(null);

  // 퀵생성 후 하이라이트 (2초 자동 해제)
  const [newlyCreatedPlanId, setNewlyCreatedPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (!newlyCreatedPlanId) return;
    const timer = setTimeout(() => setNewlyCreatedPlanId(null), 2000);
    return () => clearTimeout(timer);
  }, [newlyCreatedPlanId]);

  // 빈 영역 클릭 → 인라인 빠른 생성
  const [quickCreateState, setQuickCreateState] = useState<{
    slot: EmptySlot;
    virtualRect: { x: number; y: number; width: number; height: number };
    isAllDay?: boolean;
  } | null>(null);
  const quickCreateOpenRef = useRef(false);

  // Drag-to-Create (퀵생성보다 먼저 선언 → clearDragPreview 참조 가능)
  const { dragState, previewStyle: dragPreviewStyle, clearDragPreview } = useDragToCreate({
    containerRef,
    displayRange,
    pxPerMinute: PX_PER_MINUTE,
    snapMinutes: SNAP_MINUTES,
    enabled: !!plannerId,
    onDragEnd: useCallback(
      (_date: string, startMin: number, endMin: number) => {
        if (!plannerId) return;
        const slot: EmptySlot = {
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          durationMinutes: endMin - startMin,
        };
        // column element 기준 virtualRect (거터 침범 방지)
        const colEl = containerRef.current?.querySelector('[data-column-date]') as HTMLElement | null;
        const colRect = colEl?.getBoundingClientRect();
        quickCreateOpenRef.current = true;
        setQuickCreateState({
          slot,
          virtualRect: {
            x: colRect ? colRect.left + colRect.width / 2 : 56,
            y: colRect ? colRect.top + minutesToPx(startMin, rangeStartMin, PX_PER_MINUTE) : 0,
            width: 0,
            height: 0,
          },
        });
      },
      [plannerId, rangeStartMin],
    ),
  });

  // Floating UI 포지셔닝
  const { refs: quickCreateRefs, floatingStyles: quickCreateStyles, resolvedPlacement: quickCreatePlacement } =
    usePopoverPosition({
      virtualRect: quickCreateState?.virtualRect ?? null,
      placement: 'right-start',
      open: !!quickCreateState,
    });

  // 퀵생성 닫기 헬퍼 (ref + state 동기화 + 드래그 프리뷰 정리)
  const closeQuickCreate = useCallback(() => {
    quickCreateOpenRef.current = false;
    setQuickCreateState(null);
    clearDragPreview();
  }, [clearDragPreview]);

  // 그리드 외부 클릭 시 퀵생성 닫기 (사이드바, 헤더 등)
  useEffect(() => {
    if (!quickCreateOpenRef.current) return;

    const handleDocumentClick = (e: MouseEvent) => {
      // floating 팝오버 내부 클릭 무시
      const floatingEl = quickCreateRefs.floating.current;
      if (floatingEl?.contains(e.target as Node)) return;
      // 그리드 내부 클릭은 handleGridClick이 처리
      if (containerRef.current?.contains(e.target as Node)) return;
      closeQuickCreate();
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [quickCreateState, closeQuickCreate, quickCreateRefs.floating]);

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 이벤트 블록이 클릭된 경우 무시
      if ((e.target as HTMLElement).closest('[data-grid-block]')) return;
      if (!plannerId) return;

      // 이미 열려있으면 닫기만 하고 리턴 (ref로 즉시 확인 → 클로저/리렌더 무관)
      if (quickCreateOpenRef.current) {
        closeQuickCreate();
        return;
      }

      // EventPopover가 열려있으면 닫기
      setPopoverState(null);

      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top + e.currentTarget.scrollTop;
      const clickedMinutes = rangeStartMin + offsetY / PX_PER_MINUTE;

      // 15분 단위 스냅
      const snappedStart = Math.round(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const snappedEnd = snappedStart + 60; // 기본 1시간
      const clampedEnd = Math.min(snappedEnd, rangeEndMin);

      const startH = Math.floor(snappedStart / 60);
      const startM = snappedStart % 60;
      const endH = Math.floor(clampedEnd / 60);
      const endM = clampedEnd % 60;

      const slot: EmptySlot = {
        startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
        endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
        durationMinutes: clampedEnd - snappedStart,
      };

      quickCreateOpenRef.current = true;
      setQuickCreateState({
        slot,
        virtualRect: { x: e.clientX, y: e.clientY, width: 0, height: 0 },
      });
    },
    [rangeStartMin, rangeEndMin, plannerId, closeQuickCreate]
  );

  // 종일 영역 클릭 → 종일 모드 퀵생성
  const handleAllDayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-allday-item]')) return;
      if (!plannerId) return;
      if (quickCreateOpenRef.current) { closeQuickCreate(); return; }

      const allDaySlot: EmptySlot = { startTime: '00:00', endTime: '23:59', durationMinutes: 1439 };
      quickCreateOpenRef.current = true;
      setQuickCreateState({
        slot: allDaySlot,
        virtualRect: { x: e.clientX, y: e.clientY, width: 0, height: 0 },
        isAllDay: true,
      });
    },
    [plannerId, closeQuickCreate],
  );

  // P1-4: 리사이즈 상태 관리
  const [resizingPlanId, setResizingPlanId] = useState<string | null>(null);
  const resizingBlock = resizingPlanId
    ? planBlocks.find((b) => b.id === resizingPlanId)
    : null;

  const { currentHeight: resizeHeight, isResizing, resizeHandleProps } = useResizable({
    initialHeight: resizingBlock?.height ?? 60,
    minHeight: SNAP_MINUTES * PX_PER_MINUTE,
    maxHeight: resizingBlock
      ? totalHeight - resizingBlock.top
      : totalHeight,
    snapIncrement: SNAP_MINUTES * PX_PER_MINUTE,
    onResizeEnd: useCallback(async (newHeightPx: number) => {
      if (!resizingPlanId || !resizingBlock || !plannerId) {
        setResizingPlanId(null);
        return;
      }

      const newDurationMinutes = newHeightPx / PX_PER_MINUTE;
      const plan = resizingBlock.plan;
      if (!plan.startTime) {
        setResizingPlanId(null);
        return;
      }

      // 이전 값 캡처 (undo용)
      const prevStartTime = plan.startTime;
      const prevEndTime = plan.endTime ?? '';
      const prevEstimatedMinutes = plan.estimatedMinutes ?? undefined;

      const startMin = timeToMinutes(plan.startTime);
      const newEndTime = minutesToTime(startMin + newDurationMinutes);

      await updateItemTime({
        studentId,
        plannerId,
        planDate: selectedDate,
        itemId: resizingPlanId,
        itemType: 'plan',
        newStartTime: plan.startTime,
        newEndTime,
        estimatedMinutes: newDurationMinutes,
      });

      const planId = resizingPlanId;
      setResizingPlanId(null);
      onRefresh();

      pushUndoable({
        type: 'resize',
        planId,
        studentId,
        plannerId,
        planDate: selectedDate,
        prev: {
          startTime: prevStartTime,
          endTime: prevEndTime,
          estimatedMinutes: prevEstimatedMinutes,
        },
        description: '시간이 변경되었습니다.',
      });
    }, [resizingPlanId, resizingBlock, plannerId, studentId, selectedDate, onRefresh, pushUndoable]),
  });

  // 개별 블록에서 리사이즈 시작
  const makeResizeHandleProps = useCallback(
    (planId: string) => ({
      onMouseDown: (e: React.MouseEvent) => {
        setResizingPlanId(planId);
        // 다음 tick에 resizeHandleProps.onMouseDown이 호출되도록 setTimeout 사용
        // (resizingBlock 상태가 업데이트되어야 initialHeight가 올바르게 설정됨)
        requestAnimationFrame(() => {
          resizeHandleProps.onMouseDown(e);
        });
      },
      onTouchStart: (e: React.TouchEvent) => {
        setResizingPlanId(planId);
        requestAnimationFrame(() => {
          resizeHandleProps.onTouchStart(e);
        });
      },
    }),
    [resizeHandleProps]
  );

  // 퀵 상태 변경 핸들러 (HoverQuickActions에서 사용)
  const handleQuickStatusChange = useCallback(
    async (planId: string, isAdHoc: boolean, newStatus: PlanStatus, prevStatus?: PlanStatus) => {
      const result = await updatePlanStatus({
        planId,
        status: newStatus,
        isAdHoc,
        skipRevalidation: true,
      });
      if (result.success) {
        onRefresh();
        if (prevStatus) {
          pushUndoable({
            type: 'status-change',
            planId,
            isAdHoc,
            prevStatus,
            description: '상태가 변경되었습니다.',
          });
        }
      }
    },
    [onRefresh, pushUndoable]
  );

  const handleBlockClick = useCallback(
    (plan: PlanItemData, anchorRect: DOMRect) => {
      closeQuickCreate(); // 퀵생성 닫기 (상호 배타)
      setPopoverState({ plan, anchorRect });
    },
    [closeQuickCreate],
  );

  // 빈 영역 호버 피드백
  const [hoveredSlotTop, setHoveredSlotTop] = useState<number | null>(null);
  const hoveredSlotTopRef = useRef<number | null>(null);

  const handleGridMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]')) {
        if (hoveredSlotTopRef.current != null) {
          hoveredSlotTopRef.current = null;
          setHoveredSlotTop(null);
        }
        return;
      }
      if (!plannerId || quickCreateState || isResizing || popoverState || dragState) {
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
    [plannerId, quickCreateState, isResizing, popoverState, dragState, rangeStartMin],
  );

  const handleGridMouseLeave = useCallback(() => {
    hoveredSlotTopRef.current = null;
    setHoveredSlotTop(null);
  }, []);

  const nowTop =
    nowMinutes != null && nowMinutes >= rangeStartMin && nowMinutes <= rangeEndMin
      ? minutesToPx(nowMinutes, rangeStartMin, PX_PER_MINUTE)
      : null;

  // 종일 영역 파생 값
  const allDayItemCount = allDayItems?.length ?? 0;
  const allDayVisibleItems =
    allDayExpanded || allDayItemCount <= ALL_DAY_COLLAPSE_THRESHOLD
      ? allDayItems
      : allDayItems?.slice(0, ALL_DAY_COLLAPSE_THRESHOLD);
  const allDayVisibleCount =
    allDayExpanded || allDayItemCount <= ALL_DAY_COLLAPSE_THRESHOLD
      ? allDayItemCount
      : ALL_DAY_COLLAPSE_THRESHOLD;
  const allDayShowOverflow = !allDayExpanded && allDayItemCount > ALL_DAY_COLLAPSE_THRESHOLD;
  const allDayPreviewExtra = quickCreateState?.isAllDay ? 22 : 0;
  const allDayMinHeight =
    8 + allDayVisibleCount * 22 + (allDayShowOverflow ? 18 : 0) + allDayPreviewExtra;

  const dayInfo = formatDayHeader(selectedDate);

  return (
    <>
    <div
      ref={containerRef}
      className="relative overflow-x-hidden h-full"
      style={{ overflowY: 'auto', scrollbarGutter: 'stable' }}
    >
      {/* 헤더 영역 (sticky) — Google Calendar 일일뷰: 날짜가 거터에, 종일 이벤트가 오른쪽에 */}
      <div className="sticky top-0 z-10 bg-white">
        <div
          data-allday-row
          className="flex border-b border-gray-200"
          style={{ minHeight: Math.max(28, allDayMinHeight) }}
        >
          {/* 거터: 날짜 + 종일 라벨 + 셰브론 */}
          <div
            className="shrink-0 flex flex-col items-center pt-2 pb-1 border-r border-gray-200"
            style={{ width: TIME_GUTTER_WIDTH }}
          >
            <span className={cn('text-xs font-medium',
              dayInfo.isToday ? 'text-blue-600' : dayInfo.isPast ? 'text-gray-300' : 'text-gray-500')}>
              {dayInfo.dayName}
            </span>
            <span className={cn(
              'flex items-center justify-center rounded-full text-[26px] font-medium leading-none mt-0.5 transition-colors',
              'w-[44px] h-[44px]',
              dayInfo.isToday ? 'bg-blue-600 text-white' : dayInfo.isPast ? 'text-gray-300' : 'text-gray-800',
            )}>
              {dayInfo.dateNum}
            </span>
            <span className="text-[11px] text-gray-400 font-medium mt-1">종일</span>
            {allDayItemCount > ALL_DAY_COLLAPSE_THRESHOLD && (
              <button
                onClick={() => setAllDayExpanded((prev) => !prev)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                title={allDayExpanded ? '접기' : '펼치기'}
              >
                {allDayExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
          {/* 콘텐츠: 종일 이벤트 */}
          <div
            className={cn(
              'flex-1 px-0.5 py-0.5 space-y-px',
              plannerId && 'cursor-cell hover:bg-blue-50/30 transition-colors',
            )}
            onClick={handleAllDayClick}
          >
            {allDayVisibleItems?.map((item) => (
              <AllDayItemBar key={item.id} item={item} />
            ))}
            {allDayShowOverflow && (
              <button
                className="text-[11px] text-gray-500 hover:text-blue-600 font-medium px-1.5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setAllDayExpanded(true);
                }}
              >
                +{allDayItemCount - ALL_DAY_COLLAPSE_THRESHOLD}개 더
              </button>
            )}
            {quickCreateState?.isAllDay && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border-2 border-dashed border-blue-400 bg-blue-500/15 animate-in fade-in-0 duration-150 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-blue-700 font-medium truncate">
                  (제목 없음) 종일
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex" style={{ height: `${totalHeight}px` }}>
        {/* 시간 거터 */}
        <div
          className="shrink-0 relative border-r border-gray-200"
          style={{ width: TIME_GUTTER_WIDTH }}
        >
          {hourLabels.map((hour) => {
            const top = minutesToPx(hour * 60, rangeStartMin, PX_PER_MINUTE);
            return (
              <div key={hour}>
                <div
                  className="absolute right-2 text-[11px] text-gray-400 font-medium tabular-nums -translate-y-1/2"
                  style={{ top: `${top}px` }}
                >
                  {formatHourLabel(hour)}
                </div>
                {/* 시간 눈금 tick mark */}
                <div
                  className="absolute h-px bg-gray-200"
                  style={{ top: `${top}px`, right: '-4px', width: '12px' }}
                />
              </div>
            );
          })}
        </div>

        {/* 이벤트 컬럼 — 그리드라인은 CSS gradient로 렌더링 */}
        <div
          data-column-date={selectedDate}
          className={cn('flex-1 relative', plannerId && 'cursor-cell')}
          onClick={handleGridClick}
          onMouseMove={handleGridMouseMove}
          onMouseLeave={handleGridMouseLeave}
        >
          {/* 과거 컬럼 희미 처리 (WeeklyGridColumn과 동일) */}
          {dayInfo.isPast && (
            <div className="absolute inset-0 bg-gray-50/40 pointer-events-none" />
          )}

          {/* 오늘 컬럼 하이라이트 (WeeklyGridColumn과 동일) */}
          {dayInfo.isToday && (
            <div className="absolute inset-0 bg-blue-50/30 pointer-events-none" />
          )}

          {/* 그리드라인 레이어 (오버레이 위, 이벤트 아래 — WeeklyGridColumn과 동일) */}
          <div className="absolute inset-0 pointer-events-none" style={createGridBackgroundStyle(rangeStartMin)} />

          {/* 호버 하이라이트 */}
          {hoveredSlotTop != null && (
            <div
              className="absolute left-0 right-0 bg-blue-100/40 pointer-events-none rounded-sm z-[1]"
              style={{ top: `${hoveredSlotTop}px`, height: `${SNAP_MINUTES * PX_PER_MINUTE}px` }}
            />
          )}

          {/* Drag-to-Create 프리뷰 (Google Calendar 스타일) */}
          {dragState && dragPreviewStyle && (
            <div
              className="absolute left-0 right-0 bg-blue-500/25 border-2 border-blue-500 rounded-md z-20 pointer-events-none"
              style={{
                top: dragPreviewStyle.top,
                height: dragPreviewStyle.height,
              }}
            >
              <div className="pl-2 py-0.5 flex flex-col">
                <span className="text-xs text-blue-700 font-medium">(제목 없음)</span>
                <span className="text-[10px] text-blue-600/70">
                  {minutesToTime(dragState.startMinutes)} – {minutesToTime(dragState.endMinutes)}
                </span>
              </div>
            </div>
          )}

          {/* 퀵생성 임시 슬롯 블록 — 단순 클릭으로 열린 경우 (Google Calendar 스타일) */}
          {quickCreateState && !dragState && (
            <div
              className="absolute left-0 right-0 bg-blue-500/25 border-2 border-blue-500 rounded-md z-20 pointer-events-none"
              style={{
                top: `${minutesToPx(timeToMinutes(quickCreateState.slot.startTime), rangeStartMin, PX_PER_MINUTE)}px`,
                height: `${quickCreateState.slot.durationMinutes * PX_PER_MINUTE}px`,
              }}
            >
              <div className="pl-2 py-0.5">
                <span className="text-xs text-blue-700 font-medium">(제목 없음)</span>
              </div>
            </div>
          )}

          {/* 비학습시간 블록 (플랜 뒤에 배치) */}
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
            const isThisResizing = isResizing && resizingPlanId === block.id;
            const queryLower = searchQuery?.toLowerCase() ?? '';
            const isHighlighted = queryLower
              ? [block.plan.title, block.plan.subject]
                  .some((f) => f?.toLowerCase().includes(queryLower))
              : block.id === newlyCreatedPlanId;

            return (
              <div key={block.id} data-grid-block>
                <GridPlanBlock
                  plan={block.plan}
                  top={block.top}
                  height={block.height}
                  left={block.left}
                  width={block.width}
                  conflictInfo={conflictMap?.get(block.id)}
                  onBlockClick={handleBlockClick}
                  onMoveToWeekly={onMoveToWeekly}
                  onStatusChange={onStatusChange}
                  onQuickStatusChange={(newStatus) =>
                    handleQuickStatusChange(block.plan.id, block.plan.type === 'adhoc', newStatus, block.plan.status)
                  }
                  resizeHandleProps={
                    plannerId && !block.plan.isCompleted
                      ? makeResizeHandleProps(block.id)
                      : undefined
                  }
                  currentResizeHeight={isThisResizing ? resizeHeight : undefined}
                  isResizing={isThisResizing}
                  isHighlighted={isHighlighted}
                  isPopoverOpen={!!popoverState}
                />
              </div>
            );
          })}

          {/* 현재 시간 인디케이터 */}
          {nowTop != null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: `${nowTop}px` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
              <div className="flex-1 border-t-2 border-red-500" />
            </div>
          )}

        </div>
      </div>
    </div>

    {/* 인라인 퀵 생성 (Portal) */}
    {quickCreateState && plannerId && createPortal(
      <div
        ref={quickCreateRefs.setFloating}
        style={{ ...quickCreateStyles, transformOrigin: placementToTransformOrigin(quickCreatePlacement) }}
        data-quick-create
        className="z-[9999]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
          <InlineQuickCreate
            slot={quickCreateState.slot}
            initialMode={quickCreateState.isAllDay ? 'allDay' : 'timed'}
            studentId={studentId}
            tenantId={tenantId}
            plannerId={plannerId}
            planDate={selectedDate}
            planGroupId={planGroupId}
            onSuccess={(createdInfo) => {
              onRefresh();
              if (createdInfo) {
                setNewlyCreatedPlanId(createdInfo.planId);
                const targetPx = minutesToPx(timeToMinutes(createdInfo.startTime), rangeStartMin, PX_PER_MINUTE);
                setTimeout(() => {
                  containerRef.current?.scrollTo({ top: Math.max(0, targetPx - 100), behavior: 'smooth' });
                }, 300);
              }
            }}
            onClose={closeQuickCreate}
            onOpenFullModal={(slot) => {
              onCreatePlanAtSlot?.(slot.startTime, slot.endTime);
              closeQuickCreate();
            }}
          />
        </div>
      </div>,
      document.body
    )}

    {/* EventPopover (portal) */}
    {popoverState && (
      <EventPopover
        plan={popoverState.plan}
        anchorRect={popoverState.anchorRect}
        onClose={() => setPopoverState(null)}
        onEdit={(id) => {
          onEdit?.(id);
          setPopoverState(null);
        }}
        onDelete={(id) => {
          onDelete?.(id, popoverState.plan.type === 'adhoc');
          setPopoverState(null);
        }}
        onStatusChange={(id, status, title) => {
          onStatusChange?.(id, status, title);
          setPopoverState(null);
        }}
        onQuickStatusChange={(planId, newStatus) => {
          handleQuickStatusChange(planId, popoverState.plan.type === 'adhoc', newStatus, popoverState.plan.status);
          setPopoverState(null);
        }}
        onMoveToWeekly={(id) => {
          onMoveToWeekly?.(id);
          setPopoverState(null);
        }}
      />
    )}
    </>
  );
});
