'use client';

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { WeeklyGridColumn } from './WeeklyGridColumn';
import { WeeklyGridHeader } from './WeeklyGridHeader';
import { EventPopover } from './items/EventPopover';
import { AllDayItemBar } from './items/AllDayItemBar';
import { useWeeklyGridData, type DayColumnData } from './hooks/useWeeklyGridData';
import { useDragToCreate } from './hooks/useDragToCreate';
import { useCrossDayDrag } from './hooks/useCrossDayDrag';
import { usePopoverPosition, placementToTransformOrigin } from './hooks/usePopoverPosition';
import { InlineQuickCreate } from './items/InlineQuickCreate';
import { formatDayHeader } from './utils/weekDateUtils';
import {
  timeToMinutes,
  minutesToPx,
  minutesToTime,
  formatHourLabel,
  PX_PER_MINUTE,
  SNAP_MINUTES,
  TIME_GUTTER_WIDTH,
  DEFAULT_DISPLAY_RANGE,
} from './utils/timeGridUtils';
import { useUndo } from './UndoSnackbar';
import { detectTimeConflicts, type ConflictInfo } from '@/lib/domains/admin-plan/utils/conflictDetection';
import type { PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';
import { getGridBlockColors } from './utils/subjectColors';
import { cn } from '@/lib/cn';
import type { NonStudyItem, AllDayItem } from '@/lib/query-options/adminDock';
import type { EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';

interface WeeklyGridViewProps {
  studentId: string;
  tenantId: string;
  plannerId?: string;
  selectedDate: string;
  selectedGroupId?: string | null;
  displayRange?: { start: string; end: string };
  onEdit?: (planId: string) => void;
  onStatusChange?: (planId: string, currentStatus: PlanStatus, title: string) => void;
  onMoveToWeekly?: (planId: string) => void;
  onRefresh: () => void;
  onDateChange: (date: string) => void;
  onNonStudyClick?: (item: NonStudyItem, sourceIndex?: number) => void;
  onCreatePlanAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  onDelete?: (planId: string, isAdHoc: boolean) => void;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 날짜 클릭 시 일일뷰로 전환 */
  onSwitchToDaily?: (date: string) => void;
}

export const WeeklyGridView = memo(function WeeklyGridView({
  studentId,
  tenantId,
  plannerId,
  selectedDate,
  selectedGroupId,
  displayRange = DEFAULT_DISPLAY_RANGE,
  onEdit,
  onStatusChange,
  onMoveToWeekly,
  onRefresh,
  onDateChange,
  onNonStudyClick,
  onCreatePlanAtSlot,
  onDelete,
  searchQuery,
  onSwitchToDaily,
}: WeeklyGridViewProps) {
  const { pushUndoable } = useUndo();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const columnRefsMap = useRef(new Map<string, HTMLDivElement>());

  const rangeStartMin = timeToMinutes(displayRange.start);
  const rangeEndMin = timeToMinutes(displayRange.end);
  const totalHeight = (rangeEndMin - rangeStartMin) * PX_PER_MINUTE;

  // 7일 데이터 로딩
  const { weekDates, dayDataMap, isAnyLoading, invalidateDate, invalidateAll } =
    useWeeklyGridData(studentId, selectedDate, plannerId);

  // 날짜별 시간 충돌 감지
  const conflictMaps = useMemo(() => {
    const maps = new Map<string, Map<string, ConflictInfo>>();
    for (const [date, dayData] of dayDataMap) {
      if (!dayData) continue;
      const timeSlots = dayData.plans.map((p) => ({
        id: p.id,
        title: p.content_title ?? p.custom_title ?? '플랜',
        startTime: p.start_time ?? null,
        endTime: p.end_time ?? null,
      }));
      maps.set(date, detectTimeConflicts(timeSlots));
    }
    return maps;
  }, [dayDataMap]);

  // 시간 라벨
  const hourLabels = useMemo(() => {
    const labels: number[] = [];
    const startHour = Math.ceil(rangeStartMin / 60);
    const endHour = Math.floor(rangeEndMin / 60);
    for (let h = startHour; h <= endHour; h++) {
      // 최상단(position 0) 라벨 생략 — 구글 캘린더와 동일
      if (h * 60 === rangeStartMin) continue;
      labels.push(h);
    }
    return labels;
  }, [rangeStartMin, rangeEndMin]);

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
    if (nowMinutes == null || !scrollContainerRef.current) return;
    const scrollTarget = minutesToPx(nowMinutes, rangeStartMin, PX_PER_MINUTE) - 200;
    scrollContainerRef.current.scrollTop = Math.max(0, scrollTarget);
  }, [nowMinutes, rangeStartMin]);

  // 퀵생성 후 하이라이트 (2초 자동 해제)
  const [newlyCreatedPlanId, setNewlyCreatedPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (!newlyCreatedPlanId) return;
    const timer = setTimeout(() => setNewlyCreatedPlanId(null), 2000);
    return () => clearTimeout(timer);
  }, [newlyCreatedPlanId]);

  const nowTop =
    nowMinutes != null && nowMinutes >= rangeStartMin && nowMinutes <= rangeEndMin
      ? minutesToPx(nowMinutes, rangeStartMin, PX_PER_MINUTE)
      : null;

  // EventPopover 상태
  const [popoverState, setPopoverState] = useState<{
    plan: PlanItemData;
    anchorRect: DOMRect;
  } | null>(null);

  // 빈 영역 클릭 → 인라인 퀵 생성
  const [quickCreateState, setQuickCreateState] = useState<{
    slot: EmptySlot;
    date: string;
    virtualRect: { x: number; y: number; width: number; height: number };
    isAllDay?: boolean;
  } | null>(null);
  const quickCreateOpenRef = useRef(false);

  // Drag-to-Create (퀵생성보다 먼저 선언 → clearDragPreview 참조 가능)
  const { dragState, previewStyle, clearDragPreview } = useDragToCreate({
    containerRef: scrollContainerRef,
    displayRange,
    pxPerMinute: PX_PER_MINUTE,
    snapMinutes: SNAP_MINUTES,
    enabled: !!plannerId,
    onDragEnd: useCallback(
      (date: string, startMin: number, endMin: number) => {
        if (!plannerId) return;
        const slot: EmptySlot = {
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          durationMinutes: endMin - startMin,
        };
        // 컬럼 위치 기반 virtualRect
        const colEl = scrollContainerRef.current?.querySelector(
          `[data-column-date="${date}"]`,
        ) as HTMLElement | null;
        const colRect = colEl?.getBoundingClientRect();
        const startPx = minutesToPx(startMin, rangeStartMin, PX_PER_MINUTE);
        const containerRect = scrollContainerRef.current?.getBoundingClientRect();
        quickCreateOpenRef.current = true;
        setQuickCreateState({
          slot,
          date,
          virtualRect: {
            x: colRect ? colRect.left + colRect.width / 2 : 56,
            y: containerRect ? containerRect.top + startPx - (scrollContainerRef.current?.scrollTop ?? 0) : 0,
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

  const handleBlockClick = useCallback(
    (plan: PlanItemData, anchorRect: DOMRect) => {
      closeQuickCreate(); // 퀵생성 닫기 (상호 배타)
      setPopoverState({ plan, anchorRect });
    },
    [closeQuickCreate],
  );

  // 그리드 외부 클릭 시 퀵생성 닫기 (사이드바, 헤더 등)
  useEffect(() => {
    if (!quickCreateOpenRef.current) return;

    const handleDocumentClick = (e: MouseEvent) => {
      // floating 팝오버 내부 클릭 무시
      const floatingEl = quickCreateRefs.floating.current;
      if (floatingEl?.contains(e.target as Node)) return;
      // 그리드 내부 클릭은 handleGridClick이 처리
      if (scrollContainerRef.current?.contains(e.target as Node)) return;
      closeQuickCreate();
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [quickCreateState, closeQuickCreate, quickCreateRefs.floating]);

  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]')) return;
      if (!plannerId) return;

      // 이미 열려있으면 닫기만 하고 리턴 (ref로 즉시 확인 → 클로저/리렌더 무관)
      if (quickCreateOpenRef.current) {
        closeQuickCreate();
        return;
      }

      // EventPopover가 열려있으면 닫기
      setPopoverState(null);

      // 어떤 컬럼인지 판별
      const columnEl = (e.target as HTMLElement).closest('[data-column-date]') as HTMLElement | null;
      if (!columnEl) return;
      const clickDate = columnEl.getAttribute('data-column-date');
      if (!clickDate) return;

      const rect = scrollContainerRef.current!.getBoundingClientRect();
      const offsetY = e.clientY - rect.top + scrollContainerRef.current!.scrollTop;
      const clickedMinutes = rangeStartMin + offsetY / PX_PER_MINUTE;
      const snappedStart = Math.round(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const snappedEnd = Math.min(snappedStart + 60, rangeEndMin);

      const slot: EmptySlot = {
        startTime: minutesToTime(snappedStart),
        endTime: minutesToTime(snappedEnd),
        durationMinutes: snappedEnd - snappedStart,
      };

      const colRect = columnEl.getBoundingClientRect();
      quickCreateOpenRef.current = true;
      setQuickCreateState({
        slot,
        date: clickDate,
        virtualRect: { x: e.clientX, y: e.clientY, width: 0, height: 0 },
      });
    },
    [plannerId, rangeStartMin, rangeEndMin, closeQuickCreate],
  );

  // 종일 영역 클릭 → 종일 모드 퀵생성
  const handleAllDayQuickCreate = useCallback(
    (date: string, anchorRect: DOMRect) => {
      if (quickCreateOpenRef.current) { closeQuickCreate(); return; }
      setPopoverState(null);

      const allDaySlot: EmptySlot = { startTime: '00:00', endTime: '23:59', durationMinutes: 1439 };
      quickCreateOpenRef.current = true;
      setQuickCreateState({
        slot: allDaySlot,
        date,
        virtualRect: {
          x: anchorRect.left + anchorRect.width / 2,
          y: anchorRect.bottom,
          width: 0,
          height: 0,
        },
        isAllDay: true,
      });
    },
    [closeQuickCreate],
  );

  // Cross-Day Drag
  const crossDayDrag = useCrossDayDrag({
    columnRefs: columnRefsMap,
    scrollContainerRef,
    displayRange,
    pxPerMinute: PX_PER_MINUTE,
    snapMinutes: SNAP_MINUTES,
    enabled: !!plannerId,
    studentId,
    plannerId: plannerId ?? '',
    onMoveComplete: useCallback(
      (sourceDate: string, targetDate: string) => {
        invalidateDate(sourceDate);
        invalidateDate(targetDate);
        onRefresh();
      },
      [invalidateDate, onRefresh],
    ),
    onUndoPush: pushUndoable,
  });

  // 퀵 상태 변경
  const handleQuickStatusChange = useCallback(
    async (planId: string, isAdHoc: boolean, newStatus: PlanStatus, prevStatus?: PlanStatus) => {
      const { updatePlanStatus } = await import(
        '@/lib/domains/calendar/actions/legacyBridge'
      );
      const result = await updatePlanStatus({ planId, status: newStatus, isAdHoc, skipRevalidation: true });
      if (result.success) {
        invalidateAll();
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
    [invalidateAll, pushUndoable],
  );

  // 컬럼 ref 등록
  const setColumnRef = useCallback(
    (date: string) => (el: HTMLDivElement | null) => {
      if (el) {
        columnRefsMap.current.set(date, el);
      } else {
        columnRefsMap.current.delete(date);
      }
    },
    [],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 + 종일 영역 (scrollbar-gutter: stable로 스크롤바 공간 예약 → 컬럼 정렬 보장) */}
      <div className="flex-shrink-0" style={{ overflow: 'hidden', scrollbarGutter: 'stable' }}>
        <WeeklyGridHeader
          weekDates={weekDates}
          selectedDate={selectedDate}
          dayDataMap={dayDataMap}
          onDateChange={onDateChange}
          onSwitchToDaily={onSwitchToDaily}
        />

        {/* 종일 이벤트 영역 */}
        <AllDayRow
          weekDates={weekDates}
          dayDataMap={dayDataMap}
          plannerId={plannerId}
          onAllDayQuickCreate={handleAllDayQuickCreate}
          quickCreateDate={quickCreateState?.isAllDay ? quickCreateState.date : null}
          isQuickCreateAllDay={!!quickCreateState?.isAllDay}
        />
      </div>

      {/* 스크롤 컨테이너 (scrollbar-gutter: stable로 헤더와 동일한 스크롤바 공간) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 relative overflow-x-hidden"
        style={{ overflowY: 'auto', scrollbarGutter: 'stable' }}
        onClick={handleGridClick}
      >
        {isAnyLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-40">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

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

          {/* 7개 컬럼 (그리드라인은 각 컬럼 배경으로 적용) */}
          {weekDates.map((date) => {
            const dayData = dayDataMap.get(date);
            const header = formatDayHeader(date);

            return (
              <WeeklyGridColumn
                key={date}
                ref={setColumnRef(date)}
                date={date}
                plans={dayData?.plans ?? []}
                adHocPlans={dayData?.adHocPlans ?? []}
                nonStudyItems={dayData?.nonStudyItems ?? []}
                displayRange={displayRange}
                isToday={header.isToday}
                isPast={header.isPast}
                nowTop={header.isToday ? nowTop : undefined}
                conflictMap={conflictMaps.get(date)}
                onBlockClick={handleBlockClick}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onMoveToWeekly={onMoveToWeekly}
                onQuickStatusChange={handleQuickStatusChange}
                onNonStudyClick={onNonStudyClick}
                searchQuery={searchQuery}
                highlightedPlanId={newlyCreatedPlanId}
                draggingPlanId={crossDayDrag.draggingPlanId}
                isDragTarget={crossDayDrag.targetDate === date}
                isPopoverOpen={!!popoverState}
                enableHover={!!plannerId && !quickCreateState && !popoverState && !crossDayDrag.draggingPlanId && !dragState}
                onCrossDayDragStart={plannerId ? crossDayDrag.startDrag : undefined}
              />
            );
          })}

          {/* Drag-to-Create 프리뷰 (Google Calendar 스타일) */}
          {dragState && previewStyle && (
            <div
              className="absolute bg-blue-500/25 border-2 border-blue-500 rounded-md z-20 pointer-events-none"
              style={previewStyle}
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
          {quickCreateState && !dragState && (() => {
            const colEl = scrollContainerRef.current?.querySelector(
              `[data-column-date="${quickCreateState.date}"]`
            ) as HTMLElement | null;
            if (!colEl || !scrollContainerRef.current) return null;
            const containerRect = scrollContainerRef.current.getBoundingClientRect();
            const colRect = colEl.getBoundingClientRect();
            const startMin = timeToMinutes(quickCreateState.slot.startTime);
            const endMin = timeToMinutes(quickCreateState.slot.endTime);
            return (
              <div
                className="absolute bg-blue-500/25 border-2 border-blue-500 rounded-md z-20 pointer-events-none"
                style={{
                  top: `${minutesToPx(startMin, rangeStartMin, PX_PER_MINUTE)}px`,
                  height: `${(endMin - startMin) * PX_PER_MINUTE}px`,
                  left: `${colRect.left - containerRect.left + scrollContainerRef.current.scrollLeft}px`,
                  width: `${colRect.width}px`,
                }}
              >
                <div className="pl-2 py-0.5">
                  <span className="text-xs text-blue-700 font-medium">(제목 없음)</span>
                </div>
              </div>
            );
          })()}

          {/* Cross-Day 고스트 블록 (실제 블록 복사본 스타일) */}
          {crossDayDrag.ghost && (() => {
            const g = crossDayDrag.ghost;
            const colors = getGridBlockColors(g.plan.subject, g.plan.status, g.plan.isCompleted);
            const tier = g.height >= 55 ? 'long' : g.height >= 25 ? 'medium' : 'short';
            return (
              <div
                className={cn(
                  'absolute rounded-md border overflow-hidden pointer-events-none z-30',
                  colors.bg, colors.border,
                  'opacity-70 shadow-lg',
                )}
                style={{
                  top: `${g.top}px`,
                  height: `${g.height}px`,
                  left: `${g.left}px`,
                  width: `${g.width}px`,
                }}
              >
                {/* 좌측 액센트 바 */}
                <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md', colors.accent)} />

                {/* 컨텐츠: tier별 레이아웃 */}
                {tier === 'short' ? (
                  <div className="pl-2 pr-1 py-0.5 h-full flex items-center min-w-0">
                    <span className={cn('text-[10px] font-medium truncate leading-none', colors.text)}>
                      {g.plan.title}
                    </span>
                  </div>
                ) : (
                  <div className={cn('pl-2.5 pr-1 py-1 h-full flex flex-col justify-center min-w-0', tier === 'long' && 'gap-0.5')}>
                    <span className={cn('text-[10px] tabular-nums', colors.text, 'opacity-70')}>
                      {g.startTime} – {g.endTime}
                    </span>
                    <span className={cn('text-xs font-medium truncate leading-tight', colors.text)}>
                      {g.plan.title}
                    </span>
                    {tier === 'long' && g.plan.subject && (
                      <span className={cn('text-[10px] truncate', colors.text, 'opacity-60')}>
                        {g.plan.subject}
                      </span>
                    )}
                  </div>
                )}

                {/* 드롭 시간 배지 (하단) */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {g.startTime} – {g.endTime}
                  </span>
                </div>
              </div>
            );
          })()}
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
              planDate={quickCreateState.date}
              planGroupId={selectedGroupId}
              onSuccess={(createdInfo) => {
                invalidateDate(quickCreateState.date);
                onRefresh();
                if (createdInfo) {
                  setNewlyCreatedPlanId(createdInfo.planId);
                  const targetPx = minutesToPx(timeToMinutes(createdInfo.startTime), rangeStartMin, PX_PER_MINUTE);
                  setTimeout(() => {
                    scrollContainerRef.current?.scrollTo({ top: Math.max(0, targetPx - 100), behavior: 'smooth' });
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
    </div>
  );
});

const ALL_DAY_COLLAPSE_THRESHOLD = 2;

/** 종일 이벤트 행 */
function AllDayRow({
  weekDates,
  dayDataMap,
  plannerId,
  onAllDayQuickCreate,
  quickCreateDate,
  isQuickCreateAllDay,
}: {
  weekDates: string[];
  dayDataMap: Map<string, DayColumnData>;
  plannerId?: string;
  onAllDayQuickCreate?: (date: string, anchorRect: DOMRect) => void;
  quickCreateDate?: string | null;
  isQuickCreateAllDay?: boolean;
}) {
  const [allDayExpanded, setAllDayExpanded] = useState(false);

  const maxItems = Math.max(
    ...weekDates.map((d) => dayDataMap.get(d)?.allDayItems.length ?? 0),
    0,
  );
  const visibleMax =
    allDayExpanded || maxItems <= ALL_DAY_COLLAPSE_THRESHOLD
      ? maxItems
      : ALL_DAY_COLLAPSE_THRESHOLD;
  const showToggle = maxItems > ALL_DAY_COLLAPSE_THRESHOLD;
  const showOverflowRow = !allDayExpanded && maxItems > ALL_DAY_COLLAPSE_THRESHOLD;
  const previewExtra =
    isQuickCreateAllDay && quickCreateDate ? 22 : 0;
  const rowMinHeight =
    8 + visibleMax * 22 + (showOverflowRow ? 18 : 0) + previewExtra;

  return (
    <div className="border-b border-gray-200">
      <div className="flex" style={{ minHeight: Math.max(28, rowMinHeight) }}>
        <div
          className="shrink-0 flex flex-col items-center gap-0.5 pr-2 pt-1 border-r border-gray-200"
          style={{ width: TIME_GUTTER_WIDTH }}
        >
          <span className="text-[11px] text-gray-400 font-medium">종일</span>
          {showToggle && (
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
        {weekDates.map((date) => {
          const items = dayDataMap.get(date)?.allDayItems ?? [];
          const visibleItems = items.slice(0, visibleMax);
          const hiddenCount = items.length - visibleMax;

          return (
            <div
              key={`allday-${date}`}
              className={cn(
                'flex-1 border-r border-gray-200 last:border-r-0 px-0.5 py-0.5 space-y-px',
                plannerId && 'cursor-cell hover:bg-blue-50/30 transition-colors',
              )}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-allday-item]')) return;
                if (plannerId && onAllDayQuickCreate) {
                  onAllDayQuickCreate(date, e.currentTarget.getBoundingClientRect());
                }
              }}
            >
              {visibleItems.map((item) => (
                <AllDayItemBar key={item.id} item={item} />
              ))}
              {/* 개별 컬럼 오버플로 표시 */}
              {!allDayExpanded && hiddenCount > 0 && (
                <button
                  className="text-[11px] text-gray-500 hover:text-blue-600 font-medium px-1 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAllDayExpanded(true);
                  }}
                >
                  +{hiddenCount}개 더
                </button>
              )}
              {/* 종일 퀵생성 프리뷰 바 (P1-a) */}
              {quickCreateDate === date && isQuickCreateAllDay && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border-2 border-dashed border-blue-400 bg-blue-500/15 animate-in fade-in-0 duration-150 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-blue-700 font-medium truncate">
                    (제목 없음) 종일
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
