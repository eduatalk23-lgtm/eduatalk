'use client';

import { useMemo, useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { GridPlanBlock } from './items/GridPlanBlock';
import { AllDayItemBar } from './items/AllDayItemBar';
import { InlineQuickCreate } from './items/InlineQuickCreate';
import { EventDetailPopover } from './items/EventDetailPopover';
import { useEventDetailPopover } from './hooks/useEventDetailPopover';
import { RecurringEditChoiceModal, type RecurringEditScope } from './modals/RecurringEditChoiceModal';
import { deleteRecurringEvent, createRecurringException } from '@/lib/domains/calendar/actions/calendarEventActions';
import { useResizable } from './hooks/useResizable';
import { useDragToCreate } from './hooks/useDragToCreate';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { useGridKeyboardNav } from './hooks/useGridKeyboardNav';
import { usePopoverPosition } from './hooks/usePopoverPosition';
import { toPlanItemData, type PlanItemData } from '@/lib/types/planItem';
import { formatDayHeader } from './utils/weekDateUtils';
import { getHolidayName } from '@/lib/domains/calendar/koreanHolidays';
import {
  timeToMinutes,
  minutesToPx,
  minutesToTime,
  assignLevels,
  computeZIndex,
  computeLayoutPosition,
  formatHourLabel,
  createGridBackgroundStyle,
  PX_PER_MINUTE,
  SNAP_MINUTES,
  TIME_GUTTER_WIDTH,
  DEFAULT_DISPLAY_RANGE,
  SINGLE_RIGHT_GUTTER_PCT,
} from './utils/timeGridUtils';
// DailyDockGridView는 아직 물리적 좌표 사용 — 논리적 전환은 별도 작업
import { useDeadZoneCollapse } from './hooks/useDeadZoneCollapse';
import { updateItemTime, updatePlanStatus } from '@/lib/domains/calendar/actions/calendarEventActions';
import { useOptimisticCalendarUpdate } from '@/lib/hooks/useOptimisticCalendarUpdate';
import { useUndo } from './UndoSnackbar';
import { usePlanToast } from './PlanToast';
import { resolveCalendarColors } from './utils/subjectColors';
import { cn } from '@/lib/cn';
import type { DailyPlan, AllDayItem } from '@/lib/query-options/adminDock';
import type { EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import type { PlanStatus } from '@/lib/types/plan';

interface DailyDockGridViewProps {
  plans: DailyPlan[];
  customItems: PlanItemData[];
  nonStudyItems: PlanItemData[];
  selectedDate: string;
  displayRange?: { start: string; end: string };
  // 빈 시간 클릭 → 플랜 생성용
  studentId: string;
  tenantId: string;
  planGroupId?: string | null;
  /** 캘린더 ID */
  calendarId?: string;
  // 액션 콜백
  onEdit?: (planId: string, entityType?: 'event' | 'consultation') => void;
  onRefresh: () => void;
  onCreatePlanAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  // P1-4: 리사이즈
  onResizeEnd?: (planId: string, newHeightPx: number) => void;
  // EventPopover 삭제 액션
  onDelete?: (planId: string) => void;
  /** 플랜 검색 쿼리 (하이라이트용) */
  searchQuery?: string;
  /** 종일 이벤트 목록 */
  allDayItems?: AllDayItem[];
  /** 데이터 로딩 중 오버레이 표시 */
  isLoading?: boolean;
  /** 줌 적용 pxPerMinute (기본 PX_PER_MINUTE) */
  pxPerMinute?: number;
  /** 더블클릭/상세설정 → 이벤트 편집 모달 열기 */
  onOpenEventEditNew?: (params: { date?: string; endDate?: string; startTime?: string; endTime?: string; title?: string; description?: string; label?: string; subject?: string; rrule?: string | null }) => void;
  /** 상담 편집 모달 열기 */
  onOpenConsultationEditNew?: (params: { date?: string; startTime?: string; endTime?: string; studentId?: string; sessionType?: string; consultationMode?: string; title?: string; description?: string; meetingLink?: string; visitor?: string }) => void;
  /** 캘린더 설정의 기본 이벤트 시간 (분) */
  defaultEstimatedMinutes?: number | null;
  /** 캘린더 설정의 기본 알림 (분 단위 배열) */
  defaultReminderMinutes?: number[] | null;
  /** 공휴일 표시 여부 (사이드바 토글) */
  showHolidays?: boolean;
  /** 캘린더별 색상 맵 (calendarId → hex) — 이벤트 블록 + 종일 바에 사용 */
  calendarColorMap?: Map<string, string>;
  /** 활성 캘린더 이름 (QuickCreate 표시용) */
  calendarName?: string;
  /** 생성자 역할별 분할 보기 (선생님 | 학생) */
  splitByCreator?: boolean;
  /** 관리자 모드 여부 (학생 모드에서는 관리자 이벤트 수정 불가) */
  isAdminMode?: boolean;
}

/** 레이아웃 계산 완료된 이벤트 블록 */
type PlanBlock = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  plan: PlanItemData;
  original: DailyPlan | PlanItemData;
  level: number;
  totalLevels: number;
  expandedSpan: number;
  top: number;
  height: number;
  left: number;
  width: number;
};

const ALL_DAY_COLLAPSE_THRESHOLD = 2;

/**
 * 세로 시간축 일간 그리드 뷰
 * 구글 캘린더 스타일의 시간축 기반 레이아웃
 */
export const DailyDockGridView = memo(function DailyDockGridView({
  plans,
  customItems,
  nonStudyItems,
  selectedDate,
  displayRange = DEFAULT_DISPLAY_RANGE,
  studentId,
  tenantId,
  planGroupId,
  calendarId,
  onEdit,
  onRefresh,
  onCreatePlanAtSlot,
  onDelete,
  searchQuery,
  allDayItems,
  isLoading = false,
  pxPerMinute: ppmProp,
  onOpenEventEditNew,
  onOpenConsultationEditNew,
  defaultEstimatedMinutes,
  defaultReminderMinutes,
  showHolidays = true,
  calendarColorMap,
  calendarName: calendarNameProp,
  splitByCreator = false,
  isAdminMode = true,
}: DailyDockGridViewProps) {
  const router = useRouter();
  const ppm = ppmProp ?? PX_PER_MINUTE;
  const { isCollapsed: deadZoneCollapsed, toggle: toggleDeadZone } = useDeadZoneCollapse();
  const { pushUndoable } = useUndo();
  const { showToast } = usePlanToast();
  const { optimisticStatusChange, optimisticColorChange, optimisticTimeChange, revalidate } =
    useOptimisticCalendarUpdate(calendarId);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pullDistance, pullProgress, isRefreshing: isPtrRefreshing, isPulling } = usePullToRefresh({
    containerRef,
    onRefresh,
    enabled: true,
  });
  useGridKeyboardNav(containerRef);

  // 현재 캘린더의 프리뷰 색상 (drag-to-create, quick-create 등)
  const previewColor = calendarColorMap?.get(calendarId ?? '') ?? '#039be5';
  const previewColors = resolveCalendarColors(null, previewColor, 'confirmed', false);

  const [allDayExpanded, setAllDayExpanded] = useState(false);
  const rangeStartMin = timeToMinutes(displayRange.start);
  const rangeEndMin = timeToMinutes(displayRange.end);
  const totalHeight = (rangeEndMin - rangeStartMin) * ppm;

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

  // 플랜 + 비학습 블록 통합 레이아웃 (Google Calendar: 모든 이벤트 동등 컬럼 배치)
  const computeBlocks = useCallback((items: { id: string; startMinutes: number; endMinutes: number; plan: PlanItemData; original: DailyPlan | PlanItemData }[]): PlanBlock[] => {
    const withLevels = assignLevels(items);
    return withLevels.map((item) => {
      const pos = computeLayoutPosition(item.level, item.totalLevels, item.expandedSpan);
      const source = items.find((p) => p.id === item.id)!;
      return {
        ...source,
        level: item.level,
        totalLevels: item.totalLevels,
        expandedSpan: item.expandedSpan,
        top: minutesToPx(source.startMinutes, rangeStartMin, ppm),
        height: (source.endMinutes - source.startMinutes) * ppm,
        left: pos.left,
        width: pos.width,
      };
    });
  }, [rangeStartMin, ppm]);

  const { planBlocks, adminBlocks, studentBlocks } = useMemo(() => {
    const planItems = [
      ...plans
        .filter((p) => p.start_time && p.end_time)
        .map((p) => ({
          id: p.id,
          startMinutes: timeToMinutes(p.start_time!),
          endMinutes: timeToMinutes(p.end_time!),
          plan: toPlanItemData(p, 'plan'),
          original: p as DailyPlan | PlanItemData,
        })),
      ...customItems
        .filter((item): item is PlanItemData & { startTime: string; endTime: string } =>
          !!item.startTime && !!item.endTime
        )
        .map((item) => ({
          id: item.id,
          startMinutes: timeToMinutes(item.startTime),
          endMinutes: timeToMinutes(item.endTime),
          plan: item,
          original: item as DailyPlan | PlanItemData,
        })),
      ...nonStudyItems
        .filter((item) => item.startTime && item.endTime)
        .map((item, idx) => ({
          id: item.id || `ns-${idx}-${item.startTime}`,
          startMinutes: timeToMinutes(item.startTime!),
          endMinutes: timeToMinutes(item.endTime!),
          plan: item,
          original: item as DailyPlan | PlanItemData,
        })),
    ];

    if (!splitByCreator) {
      return { planBlocks: computeBlocks(planItems), adminBlocks: [] as PlanBlock[], studentBlocks: [] as PlanBlock[] };
    }

    // Split mode: 각 그룹 독립적으로 레이아웃 계산
    const adminItems = planItems.filter(i => i.plan.creatorRole !== 'student');
    const studentItems = planItems.filter(i => i.plan.creatorRole === 'student');
    const ab = computeBlocks(adminItems);
    const sb = computeBlocks(studentItems);
    return {
      planBlocks: [...ab, ...sb], // resizingBlock 검색용 (레이아웃 재계산 없이 합산)
      adminBlocks: ab,
      studentBlocks: sb,
    };
  }, [plans, customItems, nonStudyItems, splitByCreator, computeBlocks]);

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
    if (nowMinutes == null || !containerRef.current || hasScrolledRef.current) return;
    const scrollTarget = minutesToPx(nowMinutes, rangeStartMin, ppm) - 200;
    containerRef.current.scrollTop = Math.max(0, scrollTarget);
    hasScrolledRef.current = true;
  }, [nowMinutes, rangeStartMin, ppm]);

  // ★ popover → quick create 레이스 방지: mousedown 시점에 popover 상태 캡처
  const popoverOpenOnMouseDownRef = useRef(false);

  // EventDetailPopover (useEventDetailPopover 훅)
  const { showPopover, closePopover, isPopoverOpen, popoverProps, recurringModalState, closeRecurringModal } = useEventDetailPopover({
    onEdit: (id, et) => { onEdit?.(id, et); },
    onDelete: (id) => { onDelete?.(id); },
    onQuickStatusChange: (planId, newStatus, prevStatus, instanceDate) => {
      handleQuickStatusChange(planId, newStatus, prevStatus, instanceDate);
    },
    onColorChange: async (planId, color) => {
      const rollback = optimisticColorChange(planId, color);
      const { updateEventColor } = await import('@/lib/domains/calendar/actions/calendarEventActions');
      const result = await updateEventColor(planId, color);
      if (result?.success === false) {
        rollback();
      } else {
        revalidate();
      }
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
    onConsultationStatusChange: async (eventId: string, status: 'completed' | 'no_show' | 'cancelled' | 'scheduled') => {
      const { updateScheduleStatus } = await import('@/lib/domains/consulting/actions/schedule');
      await updateScheduleStatus(eventId, status, studentId, status === 'cancelled');
      revalidate();
    },
    isAdminMode,
  });

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
  /** 더블클릭 판별을 위한 싱글클릭 지연 타이머 */
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag-to-Create (퀵생성보다 먼저 선언 → clearDragPreview 참조 가능)
  const { dragState, previewStyle: dragPreviewStyle, clearDragPreview } = useDragToCreate({
    containerRef,
    displayRange,
    pxPerMinute: ppm,
    snapMinutes: SNAP_MINUTES,
    deadZoneCollapsed,
    enabled: !!calendarId,
    onDragEnd: useCallback(
      (_date: string, startMin: number, endMin: number) => {
        if (!calendarId) return;
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
            y: colRect ? colRect.top + minutesToPx(startMin, rangeStartMin, ppm) : 0,
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
      // fallback: floating ref가 아직 세팅 안 됐을 때 data attribute로 체크
      if ((e.target as HTMLElement).closest?.('[data-quick-create]')) return;
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
      if (!calendarId) return;

      // 이미 열려있으면 닫기만 하고 리턴 (ref로 즉시 확인 → 클로저/리렌더 무관)
      if (quickCreateOpenRef.current) {
        closeQuickCreate();
        return;
      }

      // EventDetailPopover가 열려있거나 "mousedown 시점에 열려있었으면" 퀵생성 열지 않음
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

      // 클릭 위치 → 시간 계산 (timeout 안에서 event 참조 불가하므로 미리 추출)
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top + e.currentTarget.scrollTop;
      const clickedMinutes = rangeStartMin + offsetY / ppm;
      const snappedStart = Math.floor(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const clickDuration = defaultEstimatedMinutes ?? 60;
      const clampedEnd = Math.min(snappedStart + clickDuration, rangeEndMin);
      const clientX = e.clientX;
      const clientY = e.clientY;

      // 더블클릭 판별 대기 (250ms) — GCal: 싱글클릭 = 퀵생성, 더블클릭 = 전체편집
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        const slot: EmptySlot = {
          startTime: minutesToTime(snappedStart),
          endTime: minutesToTime(clampedEnd),
          durationMinutes: clampedEnd - snappedStart,
        };
        quickCreateOpenRef.current = true;
        setQuickCreateState({
          slot,
          virtualRect: { x: clientX, y: clientY, width: 0, height: 0 },
        });
      }, 250);
    },
    [rangeStartMin, rangeEndMin, ppm, calendarId, closeQuickCreate, closePopover, defaultEstimatedMinutes]
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

      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top + e.currentTarget.scrollTop;
      const clickedMinutes = rangeStartMin + offsetY / ppm;
      const snappedStart = Math.floor(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const dbClickDuration = defaultEstimatedMinutes ?? 60;
      const snappedEnd = Math.min(snappedStart + dbClickDuration, rangeEndMin);

      if (onOpenEventEditNew) {
        onOpenEventEditNew({
          date: selectedDate,
          startTime: minutesToTime(snappedStart),
          endTime: minutesToTime(snappedEnd),
        });
      } else {
        const params = new URLSearchParams({
          date: selectedDate,
          startTime: minutesToTime(snappedStart),
          endTime: minutesToTime(snappedEnd),
        });
        if (calendarId) params.set('calendarId', calendarId);
        router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
      }
    },
    [calendarId, rangeStartMin, rangeEndMin, ppm, selectedDate, studentId, router, onOpenEventEditNew, closeQuickCreate, closePopover, isPopoverOpen, defaultEstimatedMinutes],
  );

  // P1-4: 리사이즈 상태 관리
  const [resizingPlanId, setResizingPlanId] = useState<string | null>(null);
  const [resizingEdge, setResizingEdge] = useState<'top' | 'bottom'>('bottom');
  const resizingBlock = resizingPlanId
    ? planBlocks.find((b) => b.id === resizingPlanId)
    : null;

  const { currentHeight: resizeHeight, isResizing, resizeHandleProps } = useResizable({
    initialHeight: resizingBlock?.height ?? 60,
    minHeight: SNAP_MINUTES * ppm,
    maxHeight: resizingBlock
      ? resizingEdge === 'top'
        ? resizingBlock.top + resizingBlock.height   // top: 위로 확장 한계 (그리드 최상단까지)
        : totalHeight - resizingBlock.top             // bottom: 아래로 확장 한계
      : totalHeight,
    snapIncrement: SNAP_MINUTES * ppm,
    edge: resizingEdge,
    onResizeEnd: useCallback(async (newHeightPx: number) => {
      if (!resizingPlanId || !resizingBlock || !calendarId) {
        setResizingPlanId(null);
        return;
      }

      const newDurationMinutes = newHeightPx / ppm;
      const plan = resizingBlock.plan;
      if (!plan.startTime || !plan.endTime) {
        setResizingPlanId(null);
        return;
      }

      // 이전 값 캡처 (undo용)
      const prevStartTime = plan.startTime;
      const prevEndTime = plan.endTime;
      const prevEstimatedMinutes = plan.estimatedMinutes ?? undefined;

      const currentEdge = resizingEdge;
      let newStartTime: string;
      let newEndTime: string;

      if (currentEdge === 'top') {
        // 상단 리사이즈: 종료 시간 유지, 시작 시간 변경
        const endMin = timeToMinutes(plan.endTime);
        newStartTime = minutesToTime(endMin - newDurationMinutes);
        newEndTime = plan.endTime;
      } else {
        // 하단 리사이즈: 시작 시간 유지, 종료 시간 변경
        const startMin = timeToMinutes(plan.startTime);
        newStartTime = plan.startTime;
        newEndTime = minutesToTime(startMin + newDurationMinutes);
      }

      const planId = resizingPlanId;
      setResizingPlanId(null);

      // 반복 이벤트 가상 인스턴스: exception 생성 (GCal 동작 — "이 이벤트만")
      const isRecurring = !!(plan.rrule || plan.recurringEventId);
      const isRecurringInstance = isRecurring && !plan.isException;

      const rollback = optimisticTimeChange(planId, selectedDate, newStartTime, newEndTime, newDurationMinutes);

      try {
        if (isRecurringInstance) {
          const parentId = plan.recurringEventId ?? planId;
          const startAt = `${selectedDate}T${newStartTime}:00+09:00`;
          const endAt = `${selectedDate}T${newEndTime}:00+09:00`;

          const result = await createRecurringException({
            parentEventId: parentId,
            instanceDate: selectedDate,
            overrides: {
              start_at: startAt,
              end_at: endAt,
            },
          });
          if (!result.success) {
            rollback();
            return;
          }
        } else {
          await updateItemTime({
            studentId,
            calendarId,
            planDate: selectedDate,
            itemId: planId,
            itemType: 'plan',
            newStartTime,
            newEndTime,
            estimatedMinutes: newDurationMinutes,
          });
        }
        revalidate();
        // exception 생성 시 undo 불가 (새 ID로 생성되므로 부모 ID로 되돌릴 수 없음)
        if (!isRecurringInstance) {
          pushUndoable({
            type: 'resize',
            planId,
            studentId,
            calendarId,
            planDate: selectedDate,
            prev: {
              startTime: prevStartTime,
              endTime: prevEndTime,
              estimatedMinutes: prevEstimatedMinutes,
            },
            description: '시간이 변경되었습니다.',
          });
        }
      } catch {
        rollback();
      }
    }, [resizingPlanId, resizingBlock, calendarId, studentId, selectedDate, resizingEdge, optimisticTimeChange, revalidate, pushUndoable]),
  });

  // 개별 블록에서 리사이즈 시작 (edge별 분기)
  const makeResizeHandleProps = useCallback(
    (planId: string, edge: 'top' | 'bottom') => ({
      onMouseDown: (e: React.MouseEvent) => {
        setResizingPlanId(planId);
        setResizingEdge(edge);
        requestAnimationFrame(() => {
          resizeHandleProps.onMouseDown(e);
        });
      },
      onTouchStart: (e: React.TouchEvent) => {
        setResizingPlanId(planId);
        setResizingEdge(edge);
        requestAnimationFrame(() => {
          resizeHandleProps.onTouchStart(e);
        });
      },
    }),
    [resizeHandleProps]
  );

  // M-1: 모바일 롱프레스 → 전체 편집 모달 (더블클릭 대체)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressActivatedRef = useRef(false);
  const LONG_PRESS_THRESHOLD = 15; // px — 모바일 자연스러운 손가락 떨림 허용

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPosRef.current = null;
  }, []);

  // cleanup on unmount
  useEffect(() => clearLongPress, [clearLongPress]);

  const handleGridTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-grid-block]')) return;
      if (!calendarId || isResizing || isPopoverOpen || quickCreateState || dragState) return;
      if (!e.touches || e.touches.length === 0) return;

      longPressActivatedRef.current = false;
      const touch = e.touches[0];
      longPressPosRef.current = { x: touch.clientX, y: touch.clientY };

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        const pos = longPressPosRef.current;
        longPressPosRef.current = null;
        if (!pos) return;

        // 싱글클릭 퀵생성 타이머 취소 (롱프레스가 우선)
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        closeQuickCreate();

        // 터치 위치에서 시간 슬롯 계산 (스크롤 위치는 타이머 시점에 재계산)
        const colEl = containerRef.current?.querySelector('[data-column-date]') as HTMLElement | null;
        if (!colEl) return;
        const rect = colEl.getBoundingClientRect();
        const offsetY = pos.y - rect.top;
        const clickedMinutes = rangeStartMin + offsetY / ppm;
        const snappedStart = Math.floor(clickedMinutes / SNAP_MINUTES) * SNAP_MINUTES;
        const longPressDuration = defaultEstimatedMinutes ?? 60;
        const snappedEnd = Math.min(snappedStart + longPressDuration, rangeEndMin);

        // 햅틱 피드백 (유효한 슬롯 확인 후)
        if (navigator.vibrate) navigator.vibrate(10);
        longPressActivatedRef.current = true;

        if (onOpenEventEditNew) {
          onOpenEventEditNew({
            date: selectedDate,
            startTime: minutesToTime(snappedStart),
            endTime: minutesToTime(snappedEnd),
          });
        } else {
          const params = new URLSearchParams({
            date: selectedDate,
            startTime: minutesToTime(snappedStart),
            endTime: minutesToTime(snappedEnd),
          });
          if (calendarId) params.set('calendarId', calendarId);
          router.push(`/admin/students/${studentId}/plans/event/new?${params}`);
        }
      }, 500);
    },
    [calendarId, rangeStartMin, rangeEndMin, ppm, selectedDate, studentId, router, onOpenEventEditNew, closeQuickCreate, isResizing, isPopoverOpen, quickCreateState, dragState],
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
  const handleAllDayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-allday-item]')) return;
      if (!calendarId) return;
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
        virtualRect: { x: e.clientX, y: e.clientY, width: 0, height: 0 },
        isAllDay: true,
      });
    },
    [calendarId, closeQuickCreate, isPopoverOpen, closePopover],
  );

  // 종일 이벤트 클릭 → EventDetailPopover
  const handleAllDayItemClick = useCallback(
    (item: AllDayItem, anchorRect: DOMRect) => {
      if (item.type === 'holiday') return;
      if (quickCreateOpenRef.current) closeQuickCreate();
      const planItem: PlanItemData = {
        id: item.id,
        type: 'plan',
        title: item.label,
        status: 'pending',
        isCompleted: false,
        planDate: item.startDate ?? selectedDate,
        startTime: null,
        endTime: null,
        label: item.exclusionType ?? item.label ?? '기타',
        isExclusion: !!item.exclusionType,
        isTask: false,
      };
      showPopover(planItem, anchorRect);
    },
    [closeQuickCreate, showPopover, selectedDate],
  );

  // 퀵 상태 변경 핸들러 (옵티미스틱: 즉시 색상 반영)
  const handleQuickStatusChange = useCallback(
    async (planId: string, newStatus: PlanStatus, prevStatus?: PlanStatus, instanceDate?: string) => {
      const rollback = optimisticStatusChange(planId, newStatus);
      const result = await updatePlanStatus({
        planId,
        status: newStatus,
        skipRevalidation: true,
        instanceDate,
      });
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
    [optimisticStatusChange, revalidate, pushUndoable]
  );

  const handleBlockClick = useCallback(
    (plan: PlanItemData, anchorRect: DOMRect) => {
      closeQuickCreate(); // 퀵생성 닫기 (상호 배타)
      showPopover(plan, anchorRect);
    },
    [closeQuickCreate, showPopover],
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
      if (!calendarId || quickCreateState || isResizing || isPopoverOpen || dragState) {
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
    [calendarId, quickCreateState, isResizing, isPopoverOpen, dragState, rangeStartMin],
  );

  const handleGridMouseLeave = useCallback(() => {
    hoveredSlotTopRef.current = null;
    setHoveredSlotTop(null);
  }, []);

  const nowTop =
    nowMinutes != null && nowMinutes >= rangeStartMin && nowMinutes <= rangeEndMin
      ? minutesToPx(nowMinutes, rangeStartMin, ppm)
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
  const holidayName = showHolidays ? getHolidayName(selectedDate) : null;
  const queryLower = searchQuery?.toLowerCase() ?? '';

  /** 이벤트 블록 렌더링 헬퍼 (통합/분할 양쪽에서 사용) */
  const renderEventBlocks = (blocks: PlanBlock[]) =>
    blocks.map((block) => {
      const isThisResizing = isResizing && resizingPlanId === block.id;
      const isHighlighted = queryLower
        ? [block.plan.title, block.plan.subject].some((f) => f?.toLowerCase().includes(queryLower))
        : block.id === newlyCreatedPlanId;
      const currentResizeTop = isThisResizing && resizingEdge === 'top'
        ? block.top - (resizeHeight - block.height)
        : undefined;
      // 학생 모드에서 관리자 이벤트는 리사이즈 불가
      const canModifyBlock = isAdminMode || block.plan.creatorRole !== 'admin';
      return (
        <div key={block.id} data-grid-block>
          <GridPlanBlock
            plan={block.plan}
            calendarColor={calendarColorMap?.get(block.plan.calendarId ?? '') ?? undefined}
            top={block.top}
            height={block.height}
            left={block.left}
            width={block.width}
            zIndex={computeZIndex(block.level)}
            onBlockClick={handleBlockClick}
            resizeHandleProps={calendarId && !block.plan.isCompleted && canModifyBlock ? makeResizeHandleProps(block.id, 'bottom') : undefined}
            topResizeHandleProps={calendarId && !block.plan.isCompleted && canModifyBlock ? makeResizeHandleProps(block.id, 'top') : undefined}
            currentResizeHeight={isThisResizing ? resizeHeight : undefined}
            resizingEdge={isThisResizing ? resizingEdge : undefined}
            currentResizeTop={currentResizeTop}
            isResizing={isThisResizing}
            isHighlighted={isHighlighted}
            suppressHover={!!quickCreateState || !!dragState}
          />
        </div>
      );
    });

  return (
    <>
    <div
      ref={containerRef}
      role="grid"
      aria-label="일간 캘린더 그리드"
      aria-busy={isLoading}
      className="relative overflow-x-hidden h-full scroll-gpu"
      style={{ overflowY: 'auto', scrollbarGutter: 'stable' }}
    >
      {/* Pull-to-Refresh 인디케이터 */}
      {(isPulling || isPtrRefreshing) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-transform duration-100"
          style={{ top: `${pullDistance - 36}px` }}
        >
          <div className={cn(
            'w-9 h-9 rounded-full bg-[var(--color-background)] shadow-lg border border-[rgb(var(--color-secondary-200))] flex items-center justify-center',
          )}>
            {isPtrRefreshing ? (
              <div className="w-4 h-4 rounded-full border-2 border-[rgb(var(--color-primary-500))] border-t-transparent animate-spin" />
            ) : (
              <svg
                className="w-4 h-4 text-[var(--text-secondary)] transition-transform duration-100"
                style={{ transform: `rotate(${pullProgress * 180}deg)` }}
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
      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgb(var(--color-secondary-50))]/60 z-40 pointer-events-none">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--color-primary-500))] border-t-transparent" />
        </div>
      )}
      {/* 헤더 영역 (sticky) — Google Calendar 일일뷰: 날짜가 거터에, 종일 이벤트가 오른쪽에 */}
      <div className="sticky top-0 z-10 bg-[rgb(var(--color-secondary-50))]">
        <div
          data-allday-row
          className="flex border-b border-[rgb(var(--color-secondary-200))]"
          style={{ minHeight: Math.max(28, allDayMinHeight) }}
        >
          {/* 거터: 날짜 + 종일 라벨 + 셰브론 */}
          <div
            className="shrink-0 flex flex-col items-center pt-2 pb-1 border-r border-[rgb(var(--color-secondary-200))]"
            style={{ width: TIME_GUTTER_WIDTH }}
          >
            <span className={cn('text-xs font-medium',
              dayInfo.isToday ? 'text-blue-600 dark:text-blue-400'
                : holidayName ? 'text-red-500 dark:text-red-400'
                : dayInfo.isPast ? 'text-[rgb(var(--color-secondary-300))]'
                : 'text-[var(--text-tertiary)]')}>
              {dayInfo.dayName}
            </span>
            <span className={cn(
              'flex items-center justify-center rounded-full text-[26px] font-medium leading-none mt-0.5 transition-colors',
              'w-[44px] h-[44px]',
              dayInfo.isToday ? 'bg-blue-600 dark:bg-blue-700 text-white'
                : holidayName ? 'text-red-500 dark:text-red-400'
                : dayInfo.isPast ? 'text-[rgb(var(--color-secondary-300))]'
                : 'text-[var(--text-primary)]',
            )}>
              {dayInfo.dateNum}
            </span>
            {holidayName && (
              <span className="text-[9px] text-red-400 dark:text-red-300 leading-none mt-0.5 truncate max-w-full px-0.5">
                {holidayName}
              </span>
            )}
            <span className="text-[11px] text-[var(--text-tertiary)] font-medium mt-1">종일</span>
            {allDayItemCount > ALL_DAY_COLLAPSE_THRESHOLD && (
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
          {/* 콘텐츠: 종일 이벤트 — 우측 거터: 시간 블록 이벤트(8%)와 시각적 일관성 */}
          <div
            className={cn(
              'flex-1 py-0.5 space-y-px',
              calendarId && 'cursor-cell hover:bg-blue-50/30 dark:bg-blue-900/20 dark:hover:bg-blue-900/20 transition-colors',
            )}
            onMouseDown={() => { popoverOpenOnMouseDownRef.current = isPopoverOpen; }}
            onClick={handleAllDayClick}
          >
            {/* Split 모드 컬럼 헤더 */}
            {splitByCreator && (
              <div className="flex border-b border-[rgb(var(--color-secondary-200))] -mx-px mb-0.5">
                <div className="flex-1 text-center text-[11px] font-semibold text-blue-600 dark:text-blue-400 py-0.5 border-r border-[rgb(var(--color-secondary-200))]">
                  선생님 계획
                </div>
                <div className="flex-1 text-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 py-0.5">
                  학생 자율
                </div>
              </div>
            )}
            {allDayVisibleItems?.map((item) => (
              <div key={item.id} style={{ marginLeft: 2, marginRight: `${SINGLE_RIGHT_GUTTER_PCT}%` }}>
                <AllDayItemBar item={item} calendarColor={calendarColorMap?.get(item.calendarId ?? '')} onClick={handleAllDayItemClick} />
              </div>
            ))}
            {allDayShowOverflow && (
              <button
                className="text-[11px] text-[var(--text-tertiary)] hover:text-blue-600 dark:hover:text-blue-400 font-medium px-1.5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setAllDayExpanded(true);
                }}
              >
                +{allDayItemCount - ALL_DAY_COLLAPSE_THRESHOLD}개 더
              </button>
            )}
            {quickCreateState?.isAllDay && (
              <div style={{ marginLeft: 2, marginRight: `${SINGLE_RIGHT_GUTTER_PCT}%` }}>
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded animate-in fade-in-0 duration-150 pointer-events-none"
                  style={{ backgroundColor: previewColors.bgHex }}
                >
                  <span className={cn('font-medium truncate', previewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>
                    (제목 없음) 종일
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex" style={{ height: `${totalHeight}px` }}>
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

        {/* 이벤트 컬럼 — 그리드라인은 CSS gradient로 렌더링 */}
        {/* Split 모드: 2개 컬럼 / 통합 모드: 1개 컬럼 */}
        {splitByCreator ? (
          <div className="flex-1 flex">
            {/* 선생님 계획 컬럼 */}
            <div
              data-column-date={selectedDate}
              data-split-column="admin"
              className={cn('flex-1 relative', calendarId && 'cursor-cell', 'border-r border-[rgb(var(--color-secondary-200))]')}
              onMouseDown={() => { popoverOpenOnMouseDownRef.current = isPopoverOpen; }}
              onClick={handleGridClick}
              onDoubleClick={handleGridDoubleClick}
              onMouseMove={handleGridMouseMove}
              onMouseLeave={handleGridMouseLeave}
              onTouchStart={handleGridTouchStart}
              onTouchMove={handleGridTouchMove}
              onTouchEnd={handleGridTouchEnd}
            >
              {dayInfo.isPast && <div className="absolute inset-0 bg-[rgb(var(--color-secondary-50))]/40 pointer-events-none" />}
              {dayInfo.isToday && <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/20 pointer-events-none" />}
              <div className="absolute inset-0 pointer-events-none" style={createGridBackgroundStyle(rangeStartMin, ppm)} />
              {hoveredSlotTop != null && (
                <div className="absolute left-0 right-0 bg-blue-100/40 dark:bg-blue-900/30 pointer-events-none rounded-sm z-[1]" style={{ top: `${hoveredSlotTop}px`, height: `${SNAP_MINUTES * ppm}px` }} />
              )}
              {dragState && dragPreviewStyle && (
                <div className="absolute left-0 right-0 rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden" style={{ top: dragPreviewStyle.top, height: dragPreviewStyle.height, backgroundColor: previewColors.bgHex, border: '1px solid white' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
                  <div className="pl-3 py-0.5 flex flex-col">
                    <span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>(제목 없음)</span>
                    <span className={cn('text-[10px]', previewColors.textIsWhite ? 'text-white/70' : 'text-gray-600 dark:text-gray-400')}>{minutesToTime(dragState.startMinutes)} – {minutesToTime(dragState.endMinutes)}</span>
                  </div>
                </div>
              )}
              {quickCreateState && !dragState && !quickCreateState.isAllDay && (
                <div className="absolute left-0 right-0 rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden" style={{ top: `${minutesToPx(timeToMinutes(quickCreateState.slot.startTime), rangeStartMin, ppm)}px`, height: `${quickCreateState.slot.durationMinutes * ppm}px`, backgroundColor: previewColors.bgHex, border: '1px solid white' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
                  <div className="pl-3 py-0.5"><span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>(제목 없음)</span></div>
                </div>
              )}
              {renderEventBlocks(adminBlocks)}
              {nowTop != null && (
                <div className="absolute left-0 right-0 z-[5] pointer-events-none flex items-center" style={{ top: `${nowTop}px` }}>
                  <div className="flex-1 border-t-2 border-red-500 dark:border-red-400" />
                </div>
              )}
            </div>

            {/* 학생 자율 컬럼 */}
            <div
              data-column-date={selectedDate}
              data-split-column="student"
              className={cn('flex-1 relative', calendarId && 'cursor-cell')}
              onMouseDown={() => { popoverOpenOnMouseDownRef.current = isPopoverOpen; }}
              onClick={handleGridClick}
              onDoubleClick={handleGridDoubleClick}
              onMouseMove={handleGridMouseMove}
              onMouseLeave={handleGridMouseLeave}
              onTouchStart={handleGridTouchStart}
              onTouchMove={handleGridTouchMove}
              onTouchEnd={handleGridTouchEnd}
            >
              {dayInfo.isPast && <div className="absolute inset-0 bg-[rgb(var(--color-secondary-50))]/40 pointer-events-none" />}
              {dayInfo.isToday && <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/20 pointer-events-none" />}
              <div className="absolute inset-0 pointer-events-none" style={createGridBackgroundStyle(rangeStartMin, ppm)} />
              {hoveredSlotTop != null && (
                <div className="absolute left-0 right-0 bg-blue-100/40 dark:bg-blue-900/30 pointer-events-none rounded-sm z-[1]" style={{ top: `${hoveredSlotTop}px`, height: `${SNAP_MINUTES * ppm}px` }} />
              )}
              {renderEventBlocks(studentBlocks)}
              {/* 학생 컬럼에 이벤트가 없을 때 안내 */}
              {studentBlocks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs text-[var(--text-tertiary)]">학생이 등록한 일정 없음</span>
                </div>
              )}
              {nowTop != null && (
                <div className="absolute left-0 right-0 z-[5] pointer-events-none flex items-center" style={{ top: `${nowTop}px` }}>
                  <div className="flex-1 border-t-2 border-red-500 dark:border-red-400" />
                </div>
              )}
            </div>
          </div>
        ) : (
        <div
          data-column-date={selectedDate}
          className={cn('flex-1 relative', calendarId && 'cursor-cell')}
          onMouseDown={() => { popoverOpenOnMouseDownRef.current = isPopoverOpen; }}
          onClick={handleGridClick}
          onDoubleClick={handleGridDoubleClick}
          onMouseMove={handleGridMouseMove}
          onMouseLeave={handleGridMouseLeave}
          onTouchStart={handleGridTouchStart}
          onTouchMove={handleGridTouchMove}
          onTouchEnd={handleGridTouchEnd}
        >
          {/* 과거 컬럼 희미 처리 (WeeklyGridColumn과 동일) */}
          {dayInfo.isPast && (
            <div className="absolute inset-0 bg-[rgb(var(--color-secondary-50))]/40 pointer-events-none" />
          )}

          {/* 오늘 컬럼 하이라이트 (WeeklyGridColumn과 동일) */}
          {dayInfo.isToday && (
            <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/20 pointer-events-none" />
          )}

          {/* 그리드라인 레이어 (오버레이 위, 이벤트 아래 — WeeklyGridColumn과 동일) */}
          <div className="absolute inset-0 pointer-events-none" style={createGridBackgroundStyle(rangeStartMin, ppm)} />

          {/* 호버 하이라이트 */}
          {hoveredSlotTop != null && (
            <div
              className="absolute left-0 right-0 bg-blue-100/40 dark:bg-blue-900/30 pointer-events-none rounded-sm z-[1]"
              style={{ top: `${hoveredSlotTop}px`, height: `${SNAP_MINUTES * ppm}px` }}
            />
          )}

          {/* Drag-to-Create 프리뷰 (Google Calendar 스타일) */}
          {dragState && dragPreviewStyle && (
            <div
              className="absolute left-0 right-0 rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden"
              style={{
                top: dragPreviewStyle.top,
                height: dragPreviewStyle.height,
                backgroundColor: previewColors.bgHex,
                border: '1px solid white',
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
              <div className="pl-3 py-0.5 flex flex-col">
                <span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>(제목 없음)</span>
                <span className={cn('text-[10px]', previewColors.textIsWhite ? 'text-white/70' : 'text-gray-600 dark:text-gray-400')}>
                  {minutesToTime(dragState.startMinutes)} – {minutesToTime(dragState.endMinutes)}
                </span>
              </div>
            </div>
          )}

          {/* 퀵생성 임시 슬롯 블록 — 시간 이벤트 전용 (종일은 종일 영역에서만 프리뷰) */}
          {quickCreateState && !dragState && !quickCreateState.isAllDay && (
            <div
              className="absolute left-0 right-0 rounded-lg z-[45] pointer-events-none shadow-sm overflow-hidden"
              style={{
                top: `${minutesToPx(timeToMinutes(quickCreateState.slot.startTime), rangeStartMin, ppm)}px`,
                height: `${quickCreateState.slot.durationMinutes * ppm}px`,
                backgroundColor: previewColors.bgHex,
                border: '1px solid white',
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: previewColors.barHex }} />
              <div className="pl-3 py-0.5">
                <span className={cn('text-xs font-medium', previewColors.textIsWhite ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>(제목 없음)</span>
              </div>
            </div>
          )}

          {/* 이벤트 블록 (학습 + 비학습 통합, GCal 단색 스타일) */}
          {renderEventBlocks(planBlocks)}

          {/* 현재 시간 인디케이터 */}
          {nowTop != null && (
            <div
              className="absolute left-0 right-0 z-[5] pointer-events-none flex items-center"
              style={{ top: `${nowTop}px` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
              <div className="flex-1 border-t-2 border-red-500 dark:border-red-400" />
            </div>
          )}

        </div>
        )}
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
            calendarName={calendarNameProp}
            calendarColorHex={calendarColorMap?.get(calendarId ?? '') ?? undefined}
            planDate={selectedDate}
            planGroupId={planGroupId}
            defaultEstimatedMinutes={defaultEstimatedMinutes}
            defaultReminderMinutes={defaultReminderMinutes}
            onSuccess={(createdInfo) => {
              onRefresh();
              if (createdInfo) {
                setNewlyCreatedPlanId(createdInfo.planId);
                const targetPx = minutesToPx(timeToMinutes(createdInfo.startTime), rangeStartMin, ppm);
                setTimeout(() => {
                  containerRef.current?.scrollTo({ top: Math.max(0, targetPx - 100), behavior: 'smooth' });
                }, 300);
              }
            }}
            onClose={closeQuickCreate}
            onOpenFullModal={(slot) => {
              if (onOpenEventEditNew) {
                onOpenEventEditNew({
                  date: selectedDate,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                });
              } else if (calendarId) {
                const params = new URLSearchParams({
                  date: selectedDate,
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
            onOpenConsultationModal={onOpenConsultationEditNew ? (slot, extra) => {
              onOpenConsultationEditNew({
                date: selectedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                studentId: extra?.studentId,
                sessionType: extra?.sessionType,
                consultationMode: extra?.consultationMode,
                title: extra?.title,
                description: extra?.description,
                meetingLink: extra?.meetingLink,
                visitor: extra?.visitor,
              });
              closeQuickCreate();
            } : undefined}
          />
        </div>
      </div>,
      document.body
    )}

    {/* EventDetailPopover (portal) */}
    {popoverProps && <EventDetailPopover {...popoverProps} />}

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
    </>
  );
});
