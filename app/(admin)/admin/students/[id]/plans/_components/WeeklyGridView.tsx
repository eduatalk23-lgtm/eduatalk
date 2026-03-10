'use client';

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { WeeklyGridColumn } from './WeeklyGridColumn';
import { WeeklyGridHeader } from './WeeklyGridHeader';
import { EventDetailPopover } from './items/EventDetailPopover';
import { useEventDetailPopover } from './hooks/useEventDetailPopover';
import { RecurringEditChoiceModal, type RecurringEditScope } from './modals/RecurringEditChoiceModal';
import { deleteRecurringEvent, updateRecurringEvent, createRecurringException } from '@/lib/domains/calendar/actions/calendarEventActions';
import { AllDayItemBar } from './items/AllDayItemBar';
import { useWeeklyGridData, type DayColumnData } from './hooks/useWeeklyGridData';
import { useDragToCreate } from './hooks/useDragToCreate';
import { useCrossDayDrag } from './hooks/useCrossDayDrag';
import { usePopoverPosition } from './hooks/usePopoverPosition';
import { InlineQuickCreate } from './items/InlineQuickCreate';
import { formatDayHeader } from './utils/weekDateUtils';
import {
  timeToMinutes,
  minutesToPx,
  minutesToTime,
  formatHourLabel,
  assignLevels,
  computeLayoutPosition,
  PX_PER_MINUTE,
  SNAP_MINUTES,
  TIME_GUTTER_WIDTH,
  DEFAULT_DISPLAY_RANGE,
  SINGLE_RIGHT_GUTTER_PCT,
} from './utils/timeGridUtils';
import { useResizable } from './hooks/useResizable';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { useGridKeyboardNav } from './hooks/useGridKeyboardNav';
import { updateItemTime } from '@/lib/domains/calendar/actions/calendarEventActions';
import { useUndo } from './UndoSnackbar';
import { usePlanToast } from './PlanToast';
import { useOptimisticCalendarUpdate } from '@/lib/hooks/useOptimisticCalendarUpdate';
import { toPlanItemData, type PlanItemData } from '@/lib/types/planItem';
import type { PlanStatus } from '@/lib/types/plan';
import { resolveCalendarColors } from './utils/subjectColors';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useAdminPlanBasic } from './context/AdminPlanBasicContext';
import type { AllDayItem } from '@/lib/query-options/adminDock';
import type { EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import { getHolidayAllDayItems } from '@/lib/domains/calendar/koreanHolidays';
import { useAdminPlanFilter } from './context/AdminPlanContext';

interface WeeklyGridViewProps {
  studentId: string;
  tenantId: string;
  /** 캘린더 ID */
  calendarId?: string;
  selectedDate: string;
  selectedGroupId?: string | null;
  displayRange?: { start: string; end: string };
  onEdit?: (planId: string) => void;
  onRefresh: () => void;
  onDateChange: (date: string) => void;
  onCreatePlanAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  onDelete?: (planId: string) => void;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 날짜 클릭 시 일일뷰로 전환 */
  onSwitchToDaily?: (date: string) => void;
  /** 멀티 캘린더 모드: 표시할 캘린더 ID 목록 */
  visibleCalendarIds?: string[] | null;
  /** 줌 적용 pxPerMinute (기본 PX_PER_MINUTE) */
  pxPerMinute?: number;
  /** 더블클릭/상세설정 → 이벤트 편집 모달 열기 */
  onOpenEventEditNew?: (params: { date?: string; startTime?: string; endTime?: string }) => void;
  /** 캘린더 설정의 기본 이벤트 시간 (분) */
  defaultEstimatedMinutes?: number | null;
  /** 캘린더 설정의 기본 알림 (분 단위 배열) */
  defaultReminderMinutes?: number[] | null;
  /** 커스텀 뷰 일수 (2~7, 기본 7) */
  customDayCount?: number;
}

export const WeeklyGridView = memo(function WeeklyGridView({
  studentId,
  tenantId,
  calendarId: calendarIdProp,
  selectedDate,
  selectedGroupId,
  displayRange = DEFAULT_DISPLAY_RANGE,
  onEdit,
  onRefresh,
  onDateChange,
  onCreatePlanAtSlot,
  onDelete,
  searchQuery,
  onSwitchToDaily,
  visibleCalendarIds,
  pxPerMinute: ppmProp,
  onOpenEventEditNew,
  defaultEstimatedMinutes,
  defaultReminderMinutes,
  customDayCount = 7,
}: WeeklyGridViewProps) {
  const router = useRouter();
  const ppm = ppmProp ?? PX_PER_MINUTE;
  const { pushUndoable } = useUndo();
  const { showToast } = usePlanToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { pullDistance: wPullDistance, pullProgress: wPullProgress, isRefreshing: wIsRefreshing, isPulling: wIsPulling } = usePullToRefresh({
    containerRef: scrollContainerRef,
    onRefresh,
    enabled: true,
  });
  useGridKeyboardNav(scrollContainerRef);
  const columnRefsMap = useRef(new Map<string, HTMLDivElement>());

  const rangeStartMin = timeToMinutes(displayRange.start);
  const rangeEndMin = timeToMinutes(displayRange.end);
  const totalHeight = (rangeEndMin - rangeStartMin) * ppm;

  // Calendar-First: Context에서 calendarId 직접 사용 (브릿지 훅 제거)
  const { selectedCalendarId, selectedCalendarSettings, isAdminMode } = useAdminPlanBasic();
  const resolvedCalendarId = calendarIdProp || selectedCalendarId || undefined;
  const weekStartsOn = selectedCalendarSettings?.weekStartsOn ?? 0;

  // 7일 데이터 로딩 (항상 전체 주 fetch — 인접 데이터 프리로드)
  const { weekDates: allWeekDates, dayDataMap: rawDayDataMap, calendarId, isAnyLoading, invalidateDate, invalidateAll } =
    useWeeklyGridData(studentId, selectedDate, resolvedCalendarId, visibleCalendarIds, weekStartsOn, customDayCount);
  const { optimisticStatusChange, optimisticTimeChange, optimisticDateMove, revalidate } =
    useOptimisticCalendarUpdate(calendarId, visibleCalendarIds);

  // 공휴일 AllDayItems 주입
  const { showHolidays, calendarColorMap } = useAdminPlanFilter();

  // 현재 캘린더의 프리뷰 색상 (drag-to-create, quick-create 등)
  const previewColor = calendarColorMap.get(calendarId ?? '') ?? '#039be5';
  const previewColors = resolveCalendarColors(null, previewColor, 'confirmed', false);
  const dayDataMap = useMemo(() => {
    if (!showHolidays) return rawDayDataMap;
    const holidayItems = getHolidayAllDayItems(allWeekDates);
    if (holidayItems.length === 0) return rawDayDataMap;
    const holidayByDate = new Map(holidayItems.map(h => [h.startDate, h]));
    const merged = new Map(rawDayDataMap);
    for (const [date, dayData] of merged) {
      const holiday = holidayByDate.get(date);
      if (holiday) {
        merged.set(date, { ...dayData, allDayItems: [holiday, ...dayData.allDayItems] });
      }
    }
    return merged;
  }, [rawDayDataMap, showHolidays, allWeekDates]);

  // 모바일 3일 뷰: customDayCount가 7(기본)일 때만 모바일 축소 적용
  const isMobile = useIsMobile();
  const weekDates = useMemo(() => {
    if (customDayCount < 7) return allWeekDates; // 커스텀 일수는 그대로 사용
    if (!isMobile) return allWeekDates;
    const idx = allWeekDates.indexOf(selectedDate);
    if (idx === -1) return allWeekDates.slice(0, 3); // fallback
    const start = Math.max(0, Math.min(idx - 1, allWeekDates.length - 3));
    return allWeekDates.slice(start, start + 3);
  }, [isMobile, allWeekDates, selectedDate, customDayCount]);

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

  // 현재 시간으로 자동 스크롤 (최초 마운트 시에만)
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (nowMinutes == null || !scrollContainerRef.current || hasScrolledRef.current) return;
    const scrollTarget = minutesToPx(nowMinutes, rangeStartMin, ppm) - 200;
    scrollContainerRef.current.scrollTop = Math.max(0, scrollTarget);
    hasScrolledRef.current = true;
  }, [nowMinutes, rangeStartMin, ppm]);

  // 퀵생성 후 하이라이트 (2초 자동 해제)
  const [newlyCreatedPlanId, setNewlyCreatedPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (!newlyCreatedPlanId) return;
    const timer = setTimeout(() => setNewlyCreatedPlanId(null), 2000);
    return () => clearTimeout(timer);
  }, [newlyCreatedPlanId]);

  const nowTop =
    nowMinutes != null && nowMinutes >= rangeStartMin && nowMinutes <= rangeEndMin
      ? minutesToPx(nowMinutes, rangeStartMin, ppm)
      : null;

  // 주간뷰 리사이즈
  const [resizingPlanId, setResizingPlanId] = useState<string | null>(null);
  const [resizingDate, setResizingDate] = useState<string | null>(null);
  const [resizingEdge, setResizingEdge] = useState<'top' | 'bottom'>('bottom');

  // resizingBlock 탐색: 리사이즈 중인 플랜의 블록 정보를 dayDataMap에서 찾기
  // ★ plans(study)와 customItems(custom) 모두 검색 — 모든 event_type의 리사이즈 지원
  const resizingBlock = useMemo(() => {
    if (!resizingPlanId || !resizingDate) return null;
    const dayData = dayDataMap.get(resizingDate);
    if (!dayData) return null;

    // 1) DailyPlan (study 이벤트) 검색
    const dailyPlan = dayData.plans.find(p => p.id === resizingPlanId);
    if (dailyPlan && dailyPlan.start_time) {
      const startMin = timeToMinutes(dailyPlan.start_time.substring(0, 5));
      const endMin = dailyPlan.end_time ? timeToMinutes(dailyPlan.end_time.substring(0, 5)) : startMin + 60;
      return { height: (endMin - startMin) * ppm, startMin, endMin, plan: toPlanItemData(dailyPlan, 'plan') };
    }

    // 2) PlanItemData (custom 이벤트) 검색
    const customPlan = dayData.customItems.find(p => p.id === resizingPlanId);
    if (customPlan && customPlan.startTime) {
      const startMin = timeToMinutes(customPlan.startTime.substring(0, 5));
      const endMin = customPlan.endTime ? timeToMinutes(customPlan.endTime.substring(0, 5)) : startMin + 60;
      return { height: (endMin - startMin) * ppm, startMin, endMin, plan: customPlan };
    }

    return null;
  }, [resizingPlanId, resizingDate, dayDataMap, ppm]);

  const { currentHeight: resizeHeight, isResizing, resizeHandleProps: rawResizeHandleProps } = useResizable({
    initialHeight: resizingBlock?.height ?? 60,
    minHeight: SNAP_MINUTES * ppm,
    maxHeight: resizingBlock
      ? resizingEdge === 'top'
        ? (resizingBlock.startMin - rangeStartMin) * ppm + resizingBlock.height  // top: 위로 확장 한계
        : totalHeight - (resizingBlock.startMin - rangeStartMin) * ppm           // bottom: 아래로 확장 한계
      : totalHeight,
    snapIncrement: SNAP_MINUTES * ppm,
    edge: resizingEdge,
    onResizeEnd: useCallback(async (newHeightPx: number) => {
      // ★ trailing click 방지: 리사이즈 종료 후 브라우저가 발생시키는 click 이벤트를
      // 한 번 소비하여 handleGridClick(퀵생성)과의 경합 방지
      const container = scrollContainerRef.current;
      if (container) {
        const swallowClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        container.addEventListener('click', swallowClick, { capture: true, once: true });
        setTimeout(() => container.removeEventListener('click', swallowClick, { capture: true }), 300);
      }

      if (!resizingBlock || !resizingPlanId || !resizingDate || !calendarId) return;
      const newDurationMinutes = newHeightPx / ppm;
      const currentEdge = resizingEdge;

      // resizingBlock.plan은 PlanItemData (study/custom 모두 통합)
      const plan = resizingBlock.plan;
      const prevStartTime = plan.startTime!.substring(0, 5);
      const prevEndTime = plan.endTime?.substring(0, 5) ?? minutesToTime(resizingBlock.startMin + 60);
      const prevDuration = resizingBlock.height / ppm;

      let newStartTime: string;
      let newEndTime: string;

      if (currentEdge === 'top') {
        // 상단 리사이즈: 종료 시간 유지, 시작 시간 변경
        newEndTime = prevEndTime;
        newStartTime = minutesToTime(resizingBlock.endMin - newDurationMinutes);
      } else {
        // 하단 리사이즈: 시작 시간 유지, 종료 시간 변경
        newStartTime = prevStartTime;
        newEndTime = minutesToTime(resizingBlock.startMin + newDurationMinutes);
      }

      // 반복 이벤트 가상 인스턴스: exception 생성 (GCal 동작 — "이 이벤트만")
      const isRecurring = !!(plan.rrule || plan.recurringEventId);
      const isRecurringInstance = isRecurring && !plan.isException;
      const rollback = optimisticTimeChange(resizingPlanId, resizingDate, newStartTime, newEndTime, newDurationMinutes);
      try {
        if (isRecurringInstance) {
          const parentId = plan.recurringEventId ?? resizingPlanId;
          const startAt = `${resizingDate}T${newStartTime}:00+09:00`;
          const endAt = `${resizingDate}T${newEndTime}:00+09:00`;

          const result = await createRecurringException({
            parentEventId: parentId,
            instanceDate: resizingDate,
            overrides: {
              start_at: startAt,
              end_at: endAt,
            },
          });
          if (!result.success) {
            rollback();
            showToast(result.error || '반복 일정 리사이즈 실패', 'error');
            return;
          }
        } else {
          await updateItemTime({
            studentId, calendarId, planDate: resizingDate,
            itemId: resizingPlanId, itemType: 'plan',
            newStartTime, newEndTime,
            estimatedMinutes: newDurationMinutes,
          });
        }
        revalidate();
        // exception 생성 시 undo 불가 (새 ID로 생성되므로 부모 ID로 되돌릴 수 없음)
        if (!isRecurringInstance) {
          pushUndoable({
            type: 'resize',
            planId: resizingPlanId,
            studentId,
            calendarId,
            planDate: resizingDate,
            prev: { startTime: prevStartTime, endTime: prevEndTime, estimatedMinutes: prevDuration },
            description: '리사이즈 완료',
          });
        }
      } catch {
        rollback();
        showToast('리사이즈 실패', 'error');
      }
      setResizingPlanId(null);
      setResizingDate(null);
    }, [resizingBlock, resizingPlanId, resizingDate, studentId, calendarId, resizingEdge, optimisticTimeChange, revalidate, pushUndoable, showToast]),
  });

  // ★ Bug Fix: 리사이즈 상태 안전 정리
  // useResizable의 isResizing이 false로 전환되었지만 resizingPlanId가 남아있으면
  // (mouseup 누락, 포커스 이탈 등 엣지 케이스) 강제 정리
  //
  // 주의: resizeStartingRef 가드 — makeWeeklyResizeHandleProps에서 상태 설정 후
  // rAF에서 useResizable.startResize가 실행되기 전에 이 effect가 먼저 실행됨.
  // 이때 isResizing=false, resizingPlanId=set → 잘못된 정리 방지
  const resizeStartingRef = useRef(false);

  useEffect(() => {
    if (resizeStartingRef.current) {
      resizeStartingRef.current = false;
      return; // 리사이즈 시작 직후 첫 렌더 → 건너뜀
    }
    if (!isResizing && resizingPlanId) {
      setResizingPlanId(null);
      setResizingDate(null);
    }
  }, [isResizing, resizingPlanId]);

  // cancelPendingDrag를 ref로 추출 — crossDayDrag보다 먼저 선언 가능
  const cancelPendingDragRef = useRef<(() => void) | null>(null);

  const makeWeeklyResizeHandleProps = useCallback(
    (planId: string, date: string, edge: 'top' | 'bottom') => ({
      onMouseDown: (e: React.MouseEvent) => {
        cancelPendingDragRef.current?.();
        resizeStartingRef.current = true; // safety effect 가드
        setResizingPlanId(planId);
        setResizingDate(date);
        setResizingEdge(edge);
        requestAnimationFrame(() => { rawResizeHandleProps.onMouseDown(e); });
      },
      onTouchStart: (e: React.TouchEvent) => {
        cancelPendingDragRef.current?.();
        resizeStartingRef.current = true; // safety effect 가드
        setResizingPlanId(planId);
        setResizingDate(date);
        setResizingEdge(edge);
        requestAnimationFrame(() => { rawResizeHandleProps.onTouchStart(e); });
      },
    }),
    [rawResizeHandleProps],
  );

  // EventDetailPopover (useEventDetailPopover 훅)
  // ★ Bug Fix: React 18 batching race condition
  // 문제: mousedown(외부 클릭) → closePopover() → React batch re-render → click(handleGridClick)
  //       이 시점에 isPopoverOpen은 이미 false → guard 실패 → 퀵생성 열림
  // 해결: onMouseDown 시점에 popover 상태를 캡처하고, onClick에서 확인
  //       → React 이벤트 델리게이션은 document 리스너보다 먼저 실행되므로
  //         mousedown에서 isPopoverOpen은 아직 true (popover close 전)
  const popoverOpenOnMouseDownRef = useRef(false);

  const { showPopover, closePopover: rawClosePopover, isPopoverOpen, popoverProps, recurringModalState, closeRecurringModal } = useEventDetailPopover({
    onEdit: (id) => { onEdit?.(id); },
    onDelete: (id) => { onDelete?.(id); },
    onQuickStatusChange: (planId, newStatus, prevStatus) => {
      handleQuickStatusChange(planId, newStatus, prevStatus);
    },
    onColorChange: async (planId, color) => {
      const { updateEventColor } = await import('@/lib/domains/calendar/actions/calendarEventActions');
      await updateEventColor(planId, color);
      revalidate();
    },
    onDisable: async (id) => {
      const { deleteCalendarEventAction } = await import('@/lib/domains/admin-plan/actions/calendarEvents');
      await deleteCalendarEventAction(id);
      revalidate();
      pushUndoable({
        type: 'delete-plan',
        planId: id,
        description: '비학습 시간이 비활성화되었습니다.',
      });
    },
    isAdminMode,
  });

  const closePopover = rawClosePopover;

  // 빈 영역 클릭 → 인라인 퀵 생성
  const [quickCreateState, setQuickCreateState] = useState<{
    slot: EmptySlot;
    date: string;
    virtualRect: { x: number; y: number; width: number; height: number };
    isAllDay?: boolean;
  } | null>(null);
  const quickCreateOpenRef = useRef(false);
  /** 더블클릭 판별을 위한 싱글클릭 지연 타이머 */
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag-to-Create (퀵생성보다 먼저 선언 → clearDragPreview 참조 가능)
  const { dragState, previewStyle, clearDragPreview } = useDragToCreate({
    containerRef: scrollContainerRef,
    displayRange,
    pxPerMinute: ppm,
    snapMinutes: SNAP_MINUTES,
    enabled: !!calendarId && !isPopoverOpen && !quickCreateState && !isResizing,
    onDragEnd: useCallback(
      (date: string, startMin: number, endMin: number) => {
        if (!calendarId) return;
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
        const startPx = minutesToPx(startMin, rangeStartMin, ppm);
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
      [calendarId, rangeStartMin],
    ),
  });

  // Floating UI 포지셔닝
  const { refs: quickCreateRefs, floatingStyles: quickCreateStyles, isPositioned: isQcPositioned } =
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
      showPopover(plan, anchorRect);
    },
    [closeQuickCreate, showPopover],
  );

  // 클릭 타이머 cleanup
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

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
      if (!calendarId) return;

      // 이미 열려있으면 닫기만 하고 리턴 (ref로 즉시 확인 → 클로저/리렌더 무관)
      if (quickCreateOpenRef.current) {
        closeQuickCreate();
        return;
      }

      // EventDetailPopover가 열려있거나 "mousedown 시점에 열려있었으면" 퀵생성 열지 않음
      // ★ React 이벤트 델리게이션(root) → document 리스너(popover close) 순서이므로
      //   onMouseDown 시점에 캡처한 isPopoverOpen은 아직 true (popover close 전)
      if (isPopoverOpen || popoverOpenOnMouseDownRef.current) {
        popoverOpenOnMouseDownRef.current = false;
        closePopover();
        return;
      }

      // 이전 클릭 타이머 취소
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      // 어떤 컬럼인지 판별
      const columnEl = (e.target as HTMLElement).closest('[data-column-date]') as HTMLElement | null;
      if (!columnEl) return;
      const clickDate = columnEl.getAttribute('data-column-date');
      if (!clickDate) return;

      // 클릭 위치 → 시간 계산 (timeout 안에서 event 참조 불가하므로 미리 추출)
      const rect = scrollContainerRef.current!.getBoundingClientRect();
      const offsetY = e.clientY - rect.top + scrollContainerRef.current!.scrollTop;
      const clickedMinutes = rangeStartMin + offsetY / ppm;
      const snappedStart = Math.floor(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const clickDuration = defaultEstimatedMinutes ?? 60;
      const snappedEnd = Math.min(snappedStart + clickDuration, rangeEndMin);
      const clientX = e.clientX;
      const clientY = e.clientY;

      // 더블클릭 판별 대기 (250ms) — GCal: 싱글클릭 = 퀵생성, 더블클릭 = 전체편집
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        const slot: EmptySlot = {
          startTime: minutesToTime(snappedStart),
          endTime: minutesToTime(snappedEnd),
          durationMinutes: snappedEnd - snappedStart,
        };
        quickCreateOpenRef.current = true;
        setQuickCreateState({
          slot,
          date: clickDate,
          virtualRect: { x: clientX, y: clientY, width: 0, height: 0 },
        });
      }, 250);
    },
    [calendarId, rangeStartMin, rangeEndMin, ppm, closeQuickCreate, closePopover, isPopoverOpen, defaultEstimatedMinutes],
  );

  // 더블클릭 → 이벤트 편집 모달 (Google Calendar 스타일)
  const handleGridDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]')) return;
      if (!calendarId) return;

      // 싱글클릭 퀵생성 타이머 취소
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      closeQuickCreate();

      const columnEl = (e.target as HTMLElement).closest('[data-column-date]') as HTMLElement | null;
      if (!columnEl) return;
      const clickDate = columnEl.getAttribute('data-column-date');
      if (!clickDate) return;

      const rect = scrollContainerRef.current!.getBoundingClientRect();
      const offsetY = e.clientY - rect.top + scrollContainerRef.current!.scrollTop;
      const clickedMinutes = rangeStartMin + offsetY / ppm;
      const snappedStart = Math.floor(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const dbClickDuration = defaultEstimatedMinutes ?? 60;
      const snappedEnd = Math.min(snappedStart + dbClickDuration, rangeEndMin);

      if (onOpenEventEditNew) {
        onOpenEventEditNew({
          date: clickDate,
          startTime: minutesToTime(snappedStart),
          endTime: minutesToTime(snappedEnd),
        });
      } else {
        const params = new URLSearchParams({
          date: clickDate,
          startTime: minutesToTime(snappedStart),
          endTime: minutesToTime(snappedEnd),
        });
        if (calendarId) params.set('calendarId', calendarId);
        router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
      }
    },
    [calendarId, rangeStartMin, rangeEndMin, ppm, studentId, router, onOpenEventEditNew, closeQuickCreate, defaultEstimatedMinutes],
  );

  // M-1: 모바일 롱프레스 → 전체 편집 모달 (더블클릭 대체)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number; date: string } | null>(null);
  const longPressActivatedRef = useRef(false);
  const LONG_PRESS_THRESHOLD = 15; // px

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPosRef.current = null;
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const handleGridTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]')) return;
      if (!calendarId || isResizing || isPopoverOpen || quickCreateState || dragState) return;
      if (!e.touches || e.touches.length === 0) return;

      // touchstart 시점에 컬럼(날짜)을 캡처 (500ms 후 stale 좌표 방지)
      const columnEl = (e.target as HTMLElement).closest('[data-column-date]') as HTMLElement | null;
      if (!columnEl) return;
      const touchDate = columnEl.getAttribute('data-column-date');
      if (!touchDate) return;

      longPressActivatedRef.current = false;
      const touch = e.touches[0];
      longPressPosRef.current = { x: touch.clientX, y: touch.clientY, date: touchDate };

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        const pos = longPressPosRef.current;
        longPressPosRef.current = null;
        if (!pos || !scrollContainerRef.current) return;

        // 싱글클릭 퀵생성 타이머 취소
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        closeQuickCreate();

        // 시간 슬롯 계산 (스크롤 위치는 타이머 시점에 재계산)
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const offsetY = pos.y - rect.top + scrollContainerRef.current.scrollTop;
        const clickedMinutes = rangeStartMin + offsetY / ppm;
        const snappedStart = Math.floor(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
        const longPressDuration = defaultEstimatedMinutes ?? 60;
        const snappedEnd = Math.min(snappedStart + longPressDuration, rangeEndMin);

        // 햅틱 피드백 (유효한 슬롯 확인 후)
        if (navigator.vibrate) navigator.vibrate(10);
        longPressActivatedRef.current = true;

        if (onOpenEventEditNew) {
          onOpenEventEditNew({
            date: pos.date,
            startTime: minutesToTime(snappedStart),
            endTime: minutesToTime(snappedEnd),
          });
        } else {
          const params = new URLSearchParams({
            date: pos.date,
            startTime: minutesToTime(snappedStart),
            endTime: minutesToTime(snappedEnd),
          });
          if (calendarId) params.set('calendarId', calendarId);
          router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
        }
      }, 500);
    },
    [calendarId, rangeStartMin, rangeEndMin, ppm, studentId, router, onOpenEventEditNew, closeQuickCreate, isResizing, isPopoverOpen, quickCreateState, dragState],
  );

  const handleGridTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!longPressPosRef.current) return;
      if (e.touches.length > 1) { clearLongPress(); return; } // 멀티터치(핀치) 취소
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - longPressPosRef.current.x);
      const dy = Math.abs(touch.clientY - longPressPosRef.current.y);
      if (dx > LONG_PRESS_THRESHOLD || dy > LONG_PRESS_THRESHOLD) clearLongPress();
    },
    [clearLongPress],
  );

  const handleGridTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressActivatedRef.current) {
        e.preventDefault(); // 후속 click 이벤트 방지 (이중 액션 차단)
        longPressActivatedRef.current = false;
      }
      clearLongPress();
    },
    [clearLongPress],
  );

  // 종일 영역 클릭 → 종일 모드 퀵생성
  const handleAllDayQuickCreate = useCallback(
    (date: string, anchorRect: DOMRect) => {
      if (quickCreateOpenRef.current) { closeQuickCreate(); return; }
      // popover가 열려있었으면 닫기만 하고 퀵생성은 열지 않음 (GCal 동작)
      if (isPopoverOpen || popoverOpenOnMouseDownRef.current) {
        popoverOpenOnMouseDownRef.current = false;
        closePopover();
        return;
      }

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
    [closeQuickCreate, isPopoverOpen, closePopover],
  );

  // 종일 이벤트 클릭 → EventDetailPopover (GCal 스타일)
  const handleAllDayItemClick = useCallback(
    (item: AllDayItem, anchorRect: DOMRect) => {
      // 공휴일은 DB 레코드가 없으므로 popover 불필요 (title tooltip으로 충분)
      if (item.type === 'holiday') return;

      // 퀵생성 닫기
      if (quickCreateOpenRef.current) closeQuickCreate();

      // AllDayItem → PlanItemData 변환 (팝오버 표시용 최소 데이터)
      const planItem: PlanItemData = {
        id: item.id,
        type: 'plan',
        title: item.label,
        status: 'pending',
        isCompleted: false,
        planDate: item.startDate,
        startTime: null,
        endTime: null,
        label: item.exclusionType ?? item.label ?? '기타',
        isExclusion: !!item.exclusionType,
        isTask: false,
      };
      showPopover(planItem, anchorRect);
    },
    [closeQuickCreate, showPopover],
  );

  // Cross-Day Drag (옵티미스틱: 드롭 즉시 이동 반영)
  // BUG FIX: 리사이즈 중에는 드래그 비활성화 (리사이즈 ↔ 드래그 충돌 방지)
  const crossDayDrag = useCrossDayDrag({
    columnRefs: columnRefsMap,
    scrollContainerRef,
    displayRange,
    pxPerMinute: ppm,
    snapMinutes: SNAP_MINUTES,
    enabled: !!calendarId && !isResizing,
    studentId,
    calendarId: calendarId ?? '',
    onMoveComplete: useCallback(
      () => {
        revalidate();
      },
      [revalidate],
    ),
    onBeforeMove: useCallback(
      (params: {
        planId: string;
        sourceDate: string;
        targetDate: string;
        newStartTime: string;
        newEndTime: string;
        durationMinutes: number;
      }) => {
        const { planId, sourceDate, targetDate, newStartTime, newEndTime, durationMinutes } = params;
        if (sourceDate !== targetDate) {
          return optimisticDateMove(planId, sourceDate, targetDate, newStartTime, newEndTime, durationMinutes);
        }
        return optimisticTimeChange(planId, sourceDate, newStartTime, newEndTime, durationMinutes);
      },
      [optimisticDateMove, optimisticTimeChange],
    ),
    onUndoPush: pushUndoable,
    onError: useCallback((msg: string) => showToast(msg, 'error'), [showToast]),
  });
  // Ref 동기화: makeWeeklyResizeHandleProps에서 사용
  cancelPendingDragRef.current = crossDayDrag.cancelPendingDrag;

  // 퀵 상태 변경 (옵티미스틱: 즉시 색상 반영)
  const handleQuickStatusChange = useCallback(
    async (planId: string, newStatus: PlanStatus, prevStatus?: PlanStatus) => {
      const rollback = optimisticStatusChange(planId, newStatus);
      const { updatePlanStatus } = await import(
        '@/lib/domains/calendar/actions/calendarEventActions'
      );
      const result = await updatePlanStatus({ planId, status: newStatus, skipRevalidation: true });
      if (result.success) {
        revalidate();
        if (prevStatus) {
          pushUndoable({
            type: 'status-change',
            planId,
            prevStatus,
            description: '상태가 변경되었습니다.',
          });
        }
      } else {
        rollback();
      }
    },
    [optimisticStatusChange, revalidate, pushUndoable],
  );

  // 반복 이벤트 scope 선택 핸들러
  const handleRecurringScopeSelect = useCallback(
    async (scope: RecurringEditScope) => {
      if (!recurringModalState) return;
      const { mode, planId, instanceDate } = recurringModalState;
      closeRecurringModal();

      if (mode === 'delete') {
        const result = await deleteRecurringEvent({
          eventId: planId,
          scope,
          instanceDate,
        });
        if (result.success) {
          revalidate();
          // 부모 ID 추적 (exception인 경우 recurringEventId 사용)
          const parentId = result.deletedEventIds.length > 0 && scope === 'all'
            ? result.deletedEventIds[0]
            : planId;
          pushUndoable({
            type: 'recurring-delete',
            scope,
            parentEventId: parentId,
            instanceDate,
            previousExdates: result.previousExdates,
            previousRrule: result.previousRrule,
            deletedEventIds: result.deletedEventIds,
            description: scope === 'all'
              ? '모든 반복 일정이 삭제되었습니다.'
              : scope === 'this_and_following'
                ? '이후 반복 일정이 삭제되었습니다.'
                : '반복 일정이 삭제되었습니다.',
          });
        } else {
          showToast(result.error ?? '삭제에 실패했습니다.', 'error');
        }
      } else {
        // 반복 이벤트 편집: instanceDate 포함하여 전체 페이지로 이동
        const editParams = new URLSearchParams({ instanceDate });
        if (calendarId) editParams.set('calendarId', calendarId);
        router.push(`/admin/students/${studentId}/plans/event/${planId}/edit?${editParams}`);
      }
    },
    [recurringModalState, closeRecurringModal, revalidate, pushUndoable, showToast, router, studentId, calendarId],
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

  // ★ 프리뷰 블록의 겹침 레이아웃 계산 (Google Calendar 스타일)
  // 기존 이벤트 목록에 프리뷰를 가상 아이템으로 추가 → assignLevels로 겹침 컬럼 배치
  const previewOverlapLayout = useMemo(() => {
    const previewDate = dragState?.date ?? (quickCreateState && !dragState ? quickCreateState.date : null);
    if (!previewDate) return null;

    const startMin = dragState
      ? dragState.startMinutes
      : timeToMinutes(quickCreateState!.slot.startTime);
    const endMin = dragState
      ? dragState.endMinutes
      : timeToMinutes(quickCreateState!.slot.endTime);
    if (endMin <= startMin) return null;

    const dayData = dayDataMap.get(previewDate);
    // 기존 이벤트 세그먼트 수집
    const existingItems: { id: string; startMinutes: number; endMinutes: number }[] = [];
    if (dayData) {
      for (const p of dayData.plans) {
        if (p.start_time && p.end_time) {
          existingItems.push({
            id: p.id,
            startMinutes: timeToMinutes(p.start_time),
            endMinutes: timeToMinutes(p.end_time),
          });
        }
      }
      for (const c of dayData.customItems) {
        if (c.startTime && c.endTime) {
          existingItems.push({
            id: c.id,
            startMinutes: timeToMinutes(c.startTime),
            endMinutes: timeToMinutes(c.endTime),
          });
        }
      }
      for (const ns of dayData.nonStudyItems) {
        if (ns.startTime && ns.endTime) {
          existingItems.push({
            id: ns.id,
            startMinutes: timeToMinutes(ns.startTime),
            endMinutes: timeToMinutes(ns.endTime),
          });
        }
      }
    }

    // 프리뷰를 가상 아이템으로 추가
    const PREVIEW_ID = '__preview__';
    const allItems = [...existingItems, { id: PREVIEW_ID, startMinutes: startMin, endMinutes: endMin }];
    const withLevels = assignLevels(allItems);
    const preview = withLevels.find(item => item.id === PREVIEW_ID);
    if (!preview) return null;

    const pos = computeLayoutPosition(preview.level, preview.totalLevels, preview.expandedSpan);
    return { left: pos.left, width: pos.width };
  }, [dragState, quickCreateState, dayDataMap]);

  return (
    <div
      className="flex flex-col h-full"
      onMouseDown={() => {
        // ★ popover 상태를 mousedown 시점에 캡처 (header + allday + grid 공통)
        // React 이벤트 델리게이션이 document 리스너(popover close)보다 먼저 실행되므로
        // isPopoverOpen은 아직 true (popover의 click-outside가 close 하기 전)
        popoverOpenOnMouseDownRef.current = isPopoverOpen;
      }}
    >
      {/* 헤더 + 종일 영역 (overflowY: auto + scrollbar-gutter: stable → 스크롤바 공간 예약, 컬럼 정렬 보장) */}
      <div className="flex-shrink-0" style={{ overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable' }}>
        <WeeklyGridHeader
          weekDates={weekDates}
          selectedDate={selectedDate}
          dayDataMap={dayDataMap}
          onDateChange={onDateChange}
          onSwitchToDaily={onSwitchToDaily}
          showHolidays={showHolidays}
        />

        {/* 종일 이벤트 영역 */}
        <AllDayRow
          weekDates={weekDates}
          dayDataMap={dayDataMap}
          calendarId={calendarId}
          calendarColorMap={calendarColorMap}
          previewColor={previewColor}
          onAllDayQuickCreate={handleAllDayQuickCreate}
          onAllDayItemClick={handleAllDayItemClick}
          quickCreateDate={quickCreateState?.isAllDay ? quickCreateState.date : null}
          isQuickCreateAllDay={!!quickCreateState?.isAllDay}
        />
      </div>

      {/* 스크롤 컨테이너 (scrollbar-gutter: stable로 헤더와 동일한 스크롤바 공간) */}
      <div
        ref={scrollContainerRef}
        role="grid"
        aria-label={`주간 캘린더 그리드 (${weekDates.length}일)`}
        aria-colcount={weekDates.length}
        aria-busy={isAnyLoading}
        className="flex-1 relative overflow-x-hidden scroll-gpu"
        style={{ overflowY: 'auto', scrollbarGutter: 'stable' }}
        onClick={handleGridClick}
        onDoubleClick={handleGridDoubleClick}
        onTouchStart={handleGridTouchStart}
        onTouchMove={handleGridTouchMove}
        onTouchEnd={handleGridTouchEnd}
      >
        {/* Pull-to-Refresh 인디케이터 */}
        {(wIsPulling || wIsRefreshing) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-transform duration-100"
            style={{ top: `${wPullDistance - 36}px` }}
          >
            <div className="w-9 h-9 rounded-full bg-[var(--color-background)] shadow-lg border border-[rgb(var(--color-secondary-200))] flex items-center justify-center">
              {wIsRefreshing ? (
                <div className="w-4 h-4 rounded-full border-2 border-[rgb(var(--color-primary-500))] border-t-transparent animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4 text-[var(--text-secondary)] transition-transform duration-100"
                  style={{ transform: `rotate(${wPullProgress * 180}deg)` }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              )}
            </div>
          </div>
        )}
        {isAnyLoading && (
          <div className="absolute inset-0 bg-[rgb(var(--color-secondary-50))]/60 z-40 pointer-events-none">
            <div className="flex h-full" style={{ paddingLeft: TIME_GUTTER_WIDTH, paddingRight: '0.5rem' }}>
              <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDates.length}, 1fr)` }}>
              {Array.from({ length: weekDates.length }).map((_, col) => (
                <div key={col} className="border-r border-[rgb(var(--color-secondary-100))]/50 px-0.5 pt-16 space-y-3">
                  <div className="h-14 bg-[rgb(var(--color-secondary-200))]/60 rounded animate-pulse mx-0.5" />
                  <div className="h-8 bg-[rgb(var(--color-secondary-200))]/40 rounded animate-pulse mx-0.5" />
                  <div className="h-20 bg-[rgb(var(--color-secondary-200))]/50 rounded animate-pulse mx-0.5 mt-8" />
                </div>
              ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex pr-2" style={{ height: `${totalHeight}px` }}>
          {/* 시간 거터 */}
          <div
            className="shrink-0 relative border-r border-[rgb(var(--color-secondary-200))]"
            style={{ width: TIME_GUTTER_WIDTH }}
          >
            {hourLabels.map((hour) => {
              const top = minutesToPx(hour * 60, rangeStartMin, ppm);
              return (
                <div key={hour}>
                  <div
                    className="absolute right-2 text-[11px] text-[var(--text-tertiary)] font-medium tabular-nums -translate-y-1/2"
                    style={{ top: `${top}px` }}
                  >
                    {formatHourLabel(hour)}
                  </div>
                  {/* 시간 눈금 tick mark */}
                  <div
                    className="absolute h-px bg-[rgb(var(--color-secondary-200))]"
                    style={{ top: `${top}px`, right: '-4px', width: '12px' }}
                  />
                </div>
              );
            })}
          </div>

          {/* 7개 컬럼 — CSS Grid로 헤더/종일 영역과 컬럼 정렬 일치 */}
          <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${weekDates.length}, 1fr)` }}>
          {weekDates.map((date) => {
            const dayData = dayDataMap.get(date);
            const header = formatDayHeader(date);

            return (
              <WeeklyGridColumn
                key={date}
                ref={setColumnRef(date)}
                date={date}
                plans={dayData?.plans ?? []}
                customItems={dayData?.customItems ?? []}
                nonStudyItems={dayData?.nonStudyItems ?? []}
                displayRange={displayRange}
                isToday={header.isToday}
                isPast={header.isPast}
                nowTop={header.isToday ? nowTop : undefined}
                onBlockClick={handleBlockClick}
                onEdit={onEdit}
                searchQuery={searchQuery}
                highlightedPlanId={newlyCreatedPlanId}
                draggingPlanId={crossDayDrag.draggingPlanId}
                isDragTarget={crossDayDrag.targetDate === date}
                enableHover={!!calendarId && !quickCreateState && !isPopoverOpen && !crossDayDrag.draggingPlanId && !dragState && !isResizing}
                onCrossDayDragStart={calendarId ? crossDayDrag.startDrag : undefined}
                makeResizeHandleProps={calendarId ? makeWeeklyResizeHandleProps : undefined}
                resizingPlanId={resizingPlanId}
                resizeHeight={resizeHeight}
                resizingEdge={resizingEdge}
                pxPerMinute={ppm}
                suppressBlockHover={!!quickCreateState || !!dragState}
                calendarColorMap={calendarColorMap}
                isAdminMode={isAdminMode}
              />
            );
          })}
          </div>

          {/* Drag-to-Create 프리뷰 (Google Calendar 스타일 — 겹침 레이아웃 반영) */}
          {dragState && previewStyle && (() => {
            // previewOverlapLayout이 있으면 컬럼 내 겹침 위치 반영
            const colEl = scrollContainerRef.current?.querySelector(
              `[data-column-date="${dragState.date}"]`
            ) as HTMLElement | null;
            const containerRect = scrollContainerRef.current?.getBoundingClientRect();
            const colRect = colEl?.getBoundingClientRect();
            const overlapLeft = previewOverlapLayout && colRect && containerRect
              ? (colRect.left - containerRect.left + scrollContainerRef.current!.scrollLeft) + (previewOverlapLayout.left / 100) * colRect.width
              : undefined;
            const overlapWidth = previewOverlapLayout && colRect
              ? (previewOverlapLayout.width / 100) * colRect.width
              : undefined;
            const finalStyle = overlapLeft != null && overlapWidth != null
              ? { ...previewStyle, left: `${overlapLeft}px`, width: `${overlapWidth}px` }
              : previewStyle;
            return (
              <div
                className="absolute rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden"
                style={{ ...finalStyle, backgroundColor: previewColors.bgHex, border: '1px solid white' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
                <div className="pl-3 py-0.5 flex flex-col">
                  <span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900')}>(제목 없음)</span>
                  <span className={cn('text-[10px]', previewColors.textIsWhite ? 'text-white/70' : 'text-gray-600')}>
                    {minutesToTime(dragState.startMinutes)} – {minutesToTime(dragState.endMinutes)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* 퀵생성 임시 슬롯 블록 — 시간 이벤트 전용 (종일은 AllDayRow에서만 프리뷰) */}
          {quickCreateState && !dragState && !quickCreateState.isAllDay && (() => {
            const colEl = scrollContainerRef.current?.querySelector(
              `[data-column-date="${quickCreateState.date}"]`
            ) as HTMLElement | null;
            if (!colEl || !scrollContainerRef.current) return null;
            const containerRect = scrollContainerRef.current.getBoundingClientRect();
            const colRect = colEl.getBoundingClientRect();
            const startMin = timeToMinutes(quickCreateState.slot.startTime);
            const endMin = timeToMinutes(quickCreateState.slot.endTime);
            const colLeftBase = colRect.left - containerRect.left + scrollContainerRef.current.scrollLeft;
            const blockLeft = previewOverlapLayout
              ? colLeftBase + (previewOverlapLayout.left / 100) * colRect.width
              : colLeftBase;
            const blockWidth = previewOverlapLayout
              ? (previewOverlapLayout.width / 100) * colRect.width
              : colRect.width;
            return (
              <div
                className="absolute rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden"
                style={{
                  top: `${minutesToPx(startMin, rangeStartMin, ppm)}px`,
                  height: `${(endMin - startMin) * ppm}px`,
                  left: `${blockLeft}px`,
                  width: `${blockWidth}px`,
                  backgroundColor: previewColors.bgHex,
                  border: '1px solid white',
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
                <div className="pl-3 py-0.5">
                  <span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900')}>(제목 없음)</span>
                </div>
              </div>
            );
          })()}

          {/* Cross-Day 고스트 블록 — Google Calendar: 대상 위치에 원본 형태 프리뷰 */}
          {crossDayDrag.ghost && (() => {
            const g = crossDayDrag.ghost;
            const ghostColors = resolveCalendarColors(g.plan.color, calendarColorMap.get(g.plan.calendarId ?? ''), g.plan.status, g.plan.isCompleted);
            const tier = g.height >= 45 ? 'long' : g.height >= 30 ? 'medium' : 'short';
            const textColor = ghostColors.textIsWhite ? 'text-white' : 'text-gray-900';
            return (
              <div
                className={cn(
                  'absolute rounded-lg overflow-hidden pointer-events-none z-30',
                  'shadow-lg',
                  'animate-ghost-enter',
                )}
                style={{
                  top: `${g.top}px`,
                  height: `${g.height}px`,
                  left: `${g.left}px`,
                  width: `${g.width}px`,
                  backgroundColor: ghostColors.bgHex,
                  border: '1px solid white',
                }}
              >
                {/* 좌측 캘린더 컬러 인디케이터 */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: ghostColors.barHex }}
                />

                {tier === 'short' ? (
                  <div className="pr-1.5 py-0.5 h-full flex items-center min-w-0 pl-3">
                    <span className={cn('text-[10px] font-medium truncate leading-none', textColor)}>
                      {g.plan.title}
                    </span>
                  </div>
                ) : (
                  <div className="pr-1.5 py-0.5 h-full flex flex-col justify-center min-w-0 pl-3 overflow-hidden">
                    <span className={cn('text-xs font-medium truncate leading-tight', textColor)}>
                      {g.plan.title}
                    </span>
                    <span className={cn('text-[10px] tabular-nums opacity-80 truncate', textColor)}>
                      {g.startTime} – {g.endTime}
                    </span>
                    {tier === 'long' && g.plan.subject && (
                      <span className={cn('text-[10px] truncate opacity-70', textColor)}>
                        {g.plan.subject}
                      </span>
                    )}
                  </div>
                )}

                {/* 드롭 시간 배지 — 블록 하단 외부 */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                  <span className="bg-[rgb(var(--color-secondary-900))] text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {g.startTime} – {g.endTime}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* 인라인 퀵 생성 (Portal) */}
      {quickCreateState && calendarId && createPortal(
        <div
          ref={quickCreateRefs.setFloating}
          style={quickCreateStyles}
          data-quick-create
          className={cn('z-[9999] transition-opacity duration-150', isQcPositioned ? 'opacity-100' : 'opacity-0')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[rgb(var(--color-secondary-50))] rounded-2xl shadow-lg border border-[rgb(var(--color-secondary-200))]">
            <InlineQuickCreate
              slot={quickCreateState.slot}
              initialMode={quickCreateState.isAllDay ? 'allDay' : 'timed'}
              studentId={studentId}
              tenantId={tenantId}
              calendarId={calendarId}
              calendarName={selectedCalendarSettings?.name}
              calendarColorHex={calendarColorMap.get(calendarId ?? '') ?? undefined}
              planDate={quickCreateState.date}
              planGroupId={selectedGroupId}
              defaultEstimatedMinutes={defaultEstimatedMinutes}
              defaultReminderMinutes={defaultReminderMinutes}
              onSuccess={(createdInfo) => {
                onRefresh();
                if (createdInfo) {
                  setNewlyCreatedPlanId(createdInfo.planId);
                  const targetPx = minutesToPx(timeToMinutes(createdInfo.startTime), rangeStartMin, ppm);
                  setTimeout(() => {
                    scrollContainerRef.current?.scrollTo({ top: Math.max(0, targetPx - 100), behavior: 'smooth' });
                  }, 300);
                }
              }}
              onClose={closeQuickCreate}
              onOpenFullModal={(slot) => {
                if (onOpenEventEditNew && quickCreateState) {
                  onOpenEventEditNew({
                    date: quickCreateState.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                  });
                } else if (calendarId && quickCreateState) {
                  const params = new URLSearchParams({
                    date: quickCreateState.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    calendarId,
                  });
                  router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
                } else {
                  onCreatePlanAtSlot?.(slot.startTime, slot.endTime);
                }
                closeQuickCreate();
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* EventDetailPopover (portal) */}
      {popoverProps && <EventDetailPopover {...popoverProps} onClose={closePopover} />}

      {/* 반복 이벤트 scope 선택 모달 */}
      {recurringModalState && (
        <RecurringEditChoiceModal
          isOpen={recurringModalState.isOpen}
          onClose={closeRecurringModal}
          mode={recurringModalState.mode}
          onSelect={handleRecurringScopeSelect}
          exceptionCount={recurringModalState.exceptionCount}
        />
      )}
    </div>
  );
});

const ALL_DAY_COLLAPSE_THRESHOLD = 3;

/**
 * 멀티데이 레이아웃 아이템
 * 그리드 행에서 각 아이템의 위치(colStart, colSpan)와 스팬 정보
 */
interface MultiDayLayoutItem {
  item: AllDayItem;
  row: number;
  colStart: number; // 0-indexed column start
  colSpan: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * 멀티데이 행 패킹 알고리즘
 *
 * 모든 종일 이벤트를 최소 행에 패킹합니다.
 * 멀티데이 이벤트는 여러 컬럼을 span하고,
 * 겹치지 않는 이벤트는 같은 행에 배치합니다.
 */
function packAllDayRows(
  weekDates: string[],
  dayDataMap: Map<string, DayColumnData>,
): MultiDayLayoutItem[] {
  const dateToCol = new Map(weekDates.map((d, i) => [d, i]));
  const numCols = weekDates.length;
  const firstDate = weekDates[0];
  const lastDate = weekDates[numCols - 1];

  // 모든 종일 아이템 수집 (중복 제거: 멀티데이 이벤트는 여러 날에 나타남)
  const seenIds = new Set<string>();
  const allItems: { item: AllDayItem; colStart: number; colSpan: number; continuesBefore: boolean; continuesAfter: boolean }[] = [];

  for (const date of weekDates) {
    const items = dayDataMap.get(date)?.allDayItems ?? [];
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      if (item.spanDays && item.spanDays > 1 && item.startDate && item.endDate) {
        // 멀티데이 이벤트
        const colStart = Math.max(0, dateToCol.get(item.startDate) ?? 0);
        const continuesBefore = item.startDate < firstDate;
        const continuesAfter = item.endDate > lastDate;
        const effectiveStart = continuesBefore ? 0 : colStart;
        const effectiveEndCol = continuesAfter ? numCols - 1 : (dateToCol.get(item.endDate) ?? numCols - 1);
        const colSpan = effectiveEndCol - effectiveStart + 1;
        allItems.push({ item, colStart: effectiveStart, colSpan, continuesBefore, continuesAfter });
      } else {
        // 단일 날짜 이벤트
        const col = dateToCol.get(date) ?? 0;
        allItems.push({ item, colStart: col, colSpan: 1, continuesBefore: false, continuesAfter: false });
      }
    }
  }

  // 멀티데이 이벤트 우선 정렬 (span이 큰 것 먼저, 같으면 시작 컬럼 순)
  allItems.sort((a, b) => b.colSpan - a.colSpan || a.colStart - b.colStart);

  // 행 패킹: 각 행의 사용 컬럼 추적
  const rowOccupancy: boolean[][] = [];
  const result: MultiDayLayoutItem[] = [];

  for (const layoutItem of allItems) {
    const { colStart, colSpan } = layoutItem;
    let assignedRow = -1;

    // 첫 번째로 빈 행 찾기
    for (let r = 0; r < rowOccupancy.length; r++) {
      let fits = true;
      for (let c = colStart; c < colStart + colSpan; c++) {
        if (rowOccupancy[r][c]) { fits = false; break; }
      }
      if (fits) { assignedRow = r; break; }
    }

    if (assignedRow === -1) {
      assignedRow = rowOccupancy.length;
      rowOccupancy.push(new Array(numCols).fill(false));
    }

    // 컬럼 차지 표시
    for (let c = colStart; c < colStart + colSpan; c++) {
      rowOccupancy[assignedRow][c] = true;
    }

    result.push({ ...layoutItem, row: assignedRow });
  }

  return result;
}

/** 종일 이벤트 행 (멀티데이 스팬 지원) */
function AllDayRow({
  weekDates,
  dayDataMap,
  calendarId,
  calendarColorMap,
  previewColor,
  onAllDayQuickCreate,
  onAllDayItemClick,
  quickCreateDate,
  isQuickCreateAllDay,
}: {
  weekDates: string[];
  dayDataMap: Map<string, DayColumnData>;
  calendarId?: string;
  calendarColorMap?: Map<string, string>;
  previewColor?: string;
  onAllDayQuickCreate?: (date: string, anchorRect: DOMRect) => void;
  onAllDayItemClick?: (item: AllDayItem, anchorRect: DOMRect) => void;
  quickCreateDate?: string | null;
  isQuickCreateAllDay?: boolean;
}) {
  const [allDayExpanded, setAllDayExpanded] = useState(false);

  const layoutItems = useMemo(
    () => packAllDayRows(weekDates, dayDataMap),
    [weekDates, dayDataMap],
  );

  // 종일 퀵생성 프리뷰 색상
  const allDayPreviewColors = resolveCalendarColors(null, previewColor, 'confirmed', false);

  const totalRows = layoutItems.length > 0
    ? Math.max(...layoutItems.map((l) => l.row)) + 1
    : 0;

  const visibleRows =
    allDayExpanded || totalRows <= ALL_DAY_COLLAPSE_THRESHOLD
      ? totalRows
      : ALL_DAY_COLLAPSE_THRESHOLD;
  const showToggle = totalRows > ALL_DAY_COLLAPSE_THRESHOLD;
  const showOverflowRow = !allDayExpanded && totalRows > ALL_DAY_COLLAPSE_THRESHOLD;
  const previewExtra = isQuickCreateAllDay && quickCreateDate ? 22 : 0;
  const rowMinHeight = 8 + visibleRows * 24 + (showOverflowRow ? 18 : 0) + previewExtra;

  // 행 필터 (접힘 상태에서 visible 행만)
  const visibleLayoutItems = allDayExpanded
    ? layoutItems
    : layoutItems.filter((l) => l.row < visibleRows);

  return (
    <div className="border-b border-[rgb(var(--color-secondary-200))]">
      <div className="flex pr-2" style={{ minHeight: Math.max(28, rowMinHeight) }}>
        <div
          className="shrink-0 flex flex-col items-center gap-0.5 pr-2 pt-1 border-r border-[rgb(var(--color-secondary-200))]"
          style={{ width: TIME_GUTTER_WIDTH }}
        >
          <span className="text-[11px] text-[var(--text-tertiary)] font-medium">종일</span>
          {showToggle && (
            <button
              onClick={() => setAllDayExpanded((prev) => !prev)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors p-0.5"
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

        {/* 그리드 기반 종일 이벤트 영역 */}
        <div
          className="flex-1 relative"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${weekDates.length}, 1fr)`,
            gridTemplateRows: `repeat(${visibleRows}, 24px)${showOverflowRow ? ' 18px' : ''}${previewExtra ? ' 22px' : ''}`,
            gap: '1px 0',
            padding: '2px 0',
          }}
        >
          {/* 컬럼 배경 + 클릭 영역 */}
          {weekDates.map((date, colIdx) => (
            <div
              key={`allday-bg-${date}`}
              className={cn(
                colIdx < weekDates.length - 1
                  ? 'border-r border-[rgb(var(--color-secondary-200))]'
                  : '',
                calendarId && 'cursor-cell hover:bg-blue-50/30 transition-colors',
              )}
              style={{
                gridColumn: colIdx + 1,
                gridRow: `1 / -1`,
              }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-allday-item]')) return;
                if (calendarId && onAllDayQuickCreate) {
                  onAllDayQuickCreate(date, e.currentTarget.getBoundingClientRect());
                }
              }}
            />
          ))}

          {/* 종일 이벤트 바 — 우측 거터: 시간 블록 이벤트(SINGLE_RIGHT_GUTTER_PCT%)와 동일 비율 */}
          {visibleLayoutItems.map((layout) => (
              <div
                key={layout.item.id}
                style={{
                  gridColumn: `${layout.colStart + 1} / span ${layout.colSpan}`,
                  gridRow: layout.row + 1,
                  zIndex: 1,
                }}
              >
                <div style={{ marginLeft: 2, marginRight: layout.continuesAfter ? 0 : `${SINGLE_RIGHT_GUTTER_PCT}%` }}>
                  <AllDayItemBar
                    item={layout.item}
                    calendarColor={calendarColorMap?.get(layout.item.calendarId ?? '')}
                    colSpan={layout.colSpan}
                    continuesBefore={layout.continuesBefore}
                    continuesAfter={layout.continuesAfter}
                    onClick={onAllDayItemClick}
                  />
                </div>
              </div>
          ))}

          {/* 오버플로 표시 */}
          {showOverflowRow && (
            <div
              style={{
                gridColumn: `1 / -1`,
                gridRow: visibleRows + 1,
                zIndex: 1,
              }}
              className="flex items-center justify-center"
            >
              <button
                className="text-[11px] text-[var(--text-tertiary)] hover:text-blue-600 font-medium transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setAllDayExpanded(true);
                }}
              >
                +{totalRows - visibleRows}행 더 보기
              </button>
            </div>
          )}

          {/* 종일 퀵생성 프리뷰 바 */}
          {quickCreateDate && isQuickCreateAllDay && (() => {
            const colIdx = weekDates.indexOf(quickCreateDate);
            if (colIdx === -1) return null;
            return (
              <div
                style={{
                  gridColumn: colIdx + 1,
                  gridRow: visibleRows + (showOverflowRow ? 2 : 1),
                  zIndex: 1,
                }}
              >
                <div style={{ marginLeft: 2, marginRight: `${SINGLE_RIGHT_GUTTER_PCT}%` }}>
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded animate-in fade-in-0 duration-150 pointer-events-none h-[22px]"
                    style={{ backgroundColor: allDayPreviewColors.bgHex }}
                  >
                    <span className={cn('font-medium truncate', allDayPreviewColors.textIsWhite ? 'text-white' : 'text-gray-900')}>
                      (제목 없음) 종일
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
