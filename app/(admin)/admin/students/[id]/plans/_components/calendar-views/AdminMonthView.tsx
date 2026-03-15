"use client";

/**
 * 관리자 월간 캘린더 뷰
 *
 * 한 달 전체 플랜을 7열 그리드로 표시합니다.
 * 드래그앤드롭으로 플랜 날짜 변경 지원
 */

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from "date-fns";

import { cn } from "@/lib/cn";
import DroppableAdminDayCell from "./DroppableAdminDayCell";
import DayPlanPopover from "./DayPlanPopover";
import { InlineQuickCreate } from "../items/InlineQuickCreate";
import { EventDetailPopover } from "../items/EventDetailPopover";
import { useEventDetailPopover } from "../hooks/useEventDetailPopover";
import { usePopoverPosition } from "../hooks/usePopoverPosition";
import { updatePlanStatus } from "@/lib/domains/calendar/actions/calendarEventActions";
import { calculateEmptySlots, type EmptySlot, type OccupiedSlot } from "@/lib/domains/admin-plan/utils/emptySlotCalculation";
import type { PlanItemData } from "@/lib/types/planItem";
import type { CalendarPlan } from "./_types/adminCalendar";
import type {
  AdminMonthViewProps,
  DayCellStatus,
  DayCellStats,
} from "./_types/adminCalendar";
import { useAdminPlanBasic } from "../context/AdminPlanBasicContext";
import { useAdminPlanFilter } from "../context/AdminPlanFilterContext";
import { getRotatedWeekdayLabels } from "../utils/weekDateUtils";

// 스마트 기본 슬롯: 기존 플랜의 빈 시간대를 계산하여 기본값 설정
const FALLBACK_SLOT: EmptySlot = { startTime: '09:00', endTime: '10:00', durationMinutes: 60 };

function getDefaultQuickCreateSlot(plans: CalendarPlan[]): EmptySlot {
  const occupied: OccupiedSlot[] = plans
    .filter((p) => p.start_time && p.end_time)
    .map((p) => ({
      id: p.id,
      startTime: p.start_time!.substring(0, 5),
      endTime: p.end_time!.substring(0, 5),
      type: 'plan' as const,
    }));

  if (occupied.length === 0) return FALLBACK_SLOT;

  const emptySlots = calculateEmptySlots(occupied);
  if (emptySlots.length === 0) return FALLBACK_SLOT;

  // 60분 이상 빈 슬롯 우선, 없으면 가장 큰 슬롯
  const best = emptySlots.find((s) => s.durationMinutes >= 60) ?? emptySlots[0];
  const startMin = parseInt(best.startTime.split(':')[0]) * 60 + parseInt(best.startTime.split(':')[1]);
  const dur = Math.min(best.durationMinutes, 60);
  const endMin = startMin + dur;
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

  return { startTime: best.startTime, endTime, durationMinutes: dur };
}

/** CalendarPlan → PlanItemData 어댑터 (월간뷰 팝오버용) */
function calendarPlanToItem(plan: CalendarPlan): PlanItemData {
  return {
    id: plan.id,
    type: 'plan',
    title: plan.custom_title || plan.content_title || '플랜',
    subject: plan.content_subject_category ?? undefined,
    contentType: plan.content_type ?? undefined,
    status: (plan.status as PlanItemData['status']) ?? 'pending',
    isCompleted: plan.status === 'completed',
    planDate: plan.plan_date ?? undefined,
    startTime: plan.start_time,
    endTime: plan.end_time,
    estimatedMinutes: plan.estimated_minutes,
    progress: plan.progress,
    color: plan.color,
    calendarId: plan.calendar_id,
  };
}

export default function AdminMonthView({
  studentId,
  tenantId,
  calendarId,
  planGroupId,
  currentMonth,
  selectedDate,
  onDateSelect,
  plansByDate,
  exclusionsByDate,
  dailySchedulesByDate,
  dateTimeSlots,
  onTimelineClick,
  onPlanClick: _onPlanClickLegacy,
  onPlanEdit,
  onPlanDelete,
  onContextMenu: onContextMenuProp,
  onExclusionToggle,
  onRefresh,
  isSelectionMode = false,
  selectedPlanIds,
  onPlanSelect,
  highlightedPlanIds,
  onDoubleClickDate,
  showHolidays = true,
  onOpenEventEditNew,
  onOpenConsultationEditNew,
  checkInDates,
}: AdminMonthViewProps) {
  // 주 시작 요일 (context에서)
  const { selectedCalendarSettings } = useAdminPlanBasic();
  const { calendarColorMap } = useAdminPlanFilter();
  const weekStartsOn = selectedCalendarSettings?.weekStartsOn ?? 0;
  const WEEKDAY_LABELS = useMemo(() => getRotatedWeekdayLabels(weekStartsOn), [weekStartsOn]);

  // EventDetailPopover 훅 (GCal 스타일 팝오버)
  const { showPopover: showEventPopover, closePopover, isPopoverOpen, popoverProps: eventPopoverProps } = useEventDetailPopover({
    onEdit: (id, et) => { onPlanEdit?.(id, et); },
    onDelete: (id) => { onPlanDelete?.(id); },
    onQuickStatusChange: async (planId, newStatus, _prevStatus, instanceDate) => {
      await updatePlanStatus({ planId, status: newStatus, skipRevalidation: true, instanceDate });
      onRefresh();
    },
    onColorChange: async (planId, color) => {
      const { updateEventColor } = await import('@/lib/domains/calendar/actions/calendarEventActions');
      await updateEventColor(planId, color);
      onRefresh();
    },
    onConsultationStatusChange: async (eventId: string, status: 'completed' | 'no_show' | 'cancelled' | 'scheduled') => {
      const { updateScheduleStatus } = await import('@/lib/domains/consulting/actions/schedule');
      await updateScheduleStatus(eventId, status, studentId, status === 'cancelled');
      onRefresh();
    },
  });

  // ★ popover → quick create 레이스 방지: mousedown 시점에 popover 상태 캡처
  const popoverOpenOnMouseDownRef = useRef(false);

  // 캘린더 날짜 배열 생성 (6주 * 7일 = 42일)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const weekCount = Math.ceil(calendarDays.length / 7);

  // 날짜별 상태 계산
  const getDayCellStatus = useCallback(
    (date: Date): DayCellStatus => {
      const dateStr = format(date, "yyyy-MM-dd");
      const exclusion = exclusionsByDate[dateStr];
      const dailySchedule = dailySchedulesByDate?.[dateStr];
      const today = startOfDay(new Date());

      return {
        isExclusion: !!exclusion,
        exclusionType: exclusion?.exclusion_type,
        exclusionReason: exclusion?.reason || undefined,
        isToday: isToday(date),
        isSelected: dateStr === selectedDate,
        isCurrentMonth: isSameMonth(date, currentMonth),
        isPast: isBefore(date, today),
        isDragOver: false, // DnD 컨텍스트에서 관리
        // 1730 Timetable 주기 정보
        weekNumber: dailySchedule?.week_number,
        cycleDayNumber: dailySchedule?.cycle_day_number,
        dayType: dailySchedule?.day_type,
      };
    },
    [currentMonth, selectedDate, exclusionsByDate, dailySchedulesByDate]
  );

  // 날짜별 통계 계산
  const getDayCellStats = useCallback(
    (date: Date): DayCellStats => {
      const dateStr = format(date, "yyyy-MM-dd");
      const plans = plansByDate[dateStr] || [];

      // 학습 태스크만 완료 카운트 대상 (일반 이벤트 제외)
      const taskPlans = plans.filter((p) => p.is_task);
      const totalPlans = taskPlans.length;
      const completedPlans = taskPlans.filter((p) => p.status === "completed").length;
      const inProgressPlans = taskPlans.filter((p) => p.status === "in_progress").length;
      const pendingPlans = taskPlans.filter(
        (p) => p.status === "pending" || !p.status
      ).length;
      const completionRate =
        totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
      const totalEstimatedMinutes = taskPlans.reduce(
        (sum, p) => sum + (p.estimated_minutes || 0),
        0
      );

      // Phase 4: 시간대 유형별 통계 (태스크만)
      const studySlotPlans = taskPlans.filter(
        (p) => (p as { time_slot_type?: string }).time_slot_type === "study"
      ).length;
      const selfStudySlotPlans = taskPlans.filter(
        (p) => (p as { time_slot_type?: string }).time_slot_type === "self_study"
      ).length;
      const noSlotPlans = totalPlans - studySlotPlans - selfStudySlotPlans;

      return {
        totalPlans,
        completedPlans,
        inProgressPlans,
        pendingPlans,
        completionRate,
        totalEstimatedMinutes,
        studySlotPlans,
        selfStudySlotPlans,
        noSlotPlans,
      };
    },
    [plansByDate]
  );

  // 날짜 클릭 핸들러 (dateStr을 직접 받음 - 메모이제이션 최적화)
  const handleDateClick = useCallback(
    (dateStr: string) => {
      onDateSelect(dateStr);
    },
    [onDateSelect]
  );

  // 컨텍스트 메뉴 핸들러 (dateStr을 직접 받음 - 메모이제이션 최적화)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, dateStr: string) => {
      e.preventDefault();
      const hasExclusion = !!exclusionsByDate[dateStr];

      // 외부 핸들러가 있으면 사용, 없으면 기본 토글
      if (onContextMenuProp) {
        onContextMenuProp(e, dateStr, hasExclusion);
      } else {
        onExclusionToggle(dateStr, hasExclusion);
      }
    },
    [exclusionsByDate, onContextMenuProp, onExclusionToggle]
  );

  // 오버플로 팝오버 상태
  const [popoverState, setPopoverState] = useState<{
    dateStr: string;
    plans: CalendarPlan[];
    stats: DayCellStats;
    anchorRect: DOMRect;
  } | null>(null);

  const handleOverflowClick = useCallback(
    (dateStr: string, plans: CalendarPlan[], stats: DayCellStats, anchorRect: DOMRect) => {
      setPopoverState({ dateStr, plans, stats, anchorRect });
    },
    []
  );

  const handlePopoverClose = useCallback(() => {
    setPopoverState(null);
  }, []);

  const handlePopoverDateClick = useCallback(
    (dateStr: string) => {
      setPopoverState(null);
      onDateSelect(dateStr);
    },
    [onDateSelect]
  );

  // 퀵생성 상태 (월간뷰 빈 영역 / "+" 클릭)
  const [quickCreateState, setQuickCreateState] = useState<{
    date: string;
    slot: EmptySlot;
    virtualRect: { x: number; y: number; width: number; height: number };
    isAllDay: boolean;
  } | null>(null);
  const quickCreateOpenRef = useRef(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const { refs: qcRefs, floatingStyles: qcStyles, isPositioned: isQcPositioned } =
    usePopoverPosition({
      virtualRect: quickCreateState?.virtualRect ?? null,
      placement: 'bottom-start',
      open: !!quickCreateState,
    });

  // 퀵생성 닫기 헬퍼 (ref + state 동기화)
  const closeQuickCreate = useCallback(() => {
    quickCreateOpenRef.current = false;
    setQuickCreateState(null);
  }, []);

  // CalendarPlan → EventDetailPopover (월간뷰 전용 핸들러)
  const handlePlanClick = useCallback(
    (plan: CalendarPlan, anchorRect: DOMRect) => {
      closeQuickCreate(); // 퀵생성 열려있으면 닫기 (상호 배타)
      showEventPopover(calendarPlanToItem(plan), anchorRect);
    },
    [showEventPopover, closeQuickCreate],
  );

  const handleQuickCreate = useCallback((dateStr: string, anchorRect: DOMRect) => {
    // 이미 열려있으면 닫기만 하고 리턴 (주간뷰 패턴: close → return)
    if (quickCreateOpenRef.current) {
      closeQuickCreate();
      return;
    }
    // EventDetailPopover가 열려있거나 "mousedown 시점에 열려있었으면" 퀵생성 열지 않음 (GCal 동작)
    if (isPopoverOpen || popoverOpenOnMouseDownRef.current) {
      popoverOpenOnMouseDownRef.current = false;
      closePopover();
      return;
    }
    setPopoverState(null); // 오버플로 팝오버 닫기
    const datePlans = plansByDate[dateStr] || [];
    quickCreateOpenRef.current = true;
    setQuickCreateState({
      date: dateStr,
      slot: getDefaultQuickCreateSlot(datePlans),
      virtualRect: {
        x: anchorRect.left,
        y: anchorRect.bottom,
        width: anchorRect.width,
        height: 0,
      },
      isAllDay: true,
    });
  }, [plansByDate, closeQuickCreate, isPopoverOpen, closePopover]);

  // 퀵생성 후 하이라이트 (2초 자동 해제)
  const [newlyCreatedPlanId, setNewlyCreatedPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (!newlyCreatedPlanId) return;
    const timer = setTimeout(() => setNewlyCreatedPlanId(null), 2000);
    return () => clearTimeout(timer);
  }, [newlyCreatedPlanId]);

  // 부모의 highlightedPlanIds + 새로 생성된 플랜 병합
  const mergedHighlightedPlanIds = useMemo(() => {
    if (!newlyCreatedPlanId && !highlightedPlanIds) return highlightedPlanIds;
    const merged = new Set(highlightedPlanIds);
    if (newlyCreatedPlanId) merged.add(newlyCreatedPlanId);
    return merged;
  }, [highlightedPlanIds, newlyCreatedPlanId]);

  // 외부 클릭 닫기 (그리드 내부 클릭은 handleQuickCreate가 처리)
  useEffect(() => {
    if (!quickCreateOpenRef.current) return;

    const handleDocumentClick = (e: MouseEvent) => {
      // floating 팝오버 내부 클릭 무시
      const floatingEl = qcRefs.floating.current;
      if (floatingEl?.contains(e.target as Node)) return;
      // 그리드 내부 클릭은 handleQuickCreate가 처리
      if (gridContainerRef.current?.contains(e.target as Node)) return;
      closeQuickCreate();
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [quickCreateState, closeQuickCreate, qcRefs.floating]);

  // ESC 키 닫기
  useEffect(() => {
    if (!quickCreateState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuickCreate();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [quickCreateState, closeQuickCreate]);

  // --- 월간 드래그-투-크리에이트 ---
  const monthDragRef = useRef<{ startDate: string; activated: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [monthDrag, setMonthDrag] = useState<{
    startDate: string;
    currentDate: string;
  } | null>(null);

  // 드래그 선택 날짜 범위 (Set)
  const dragSelectedDates = useMemo(() => {
    if (!monthDrag) return null;
    const { startDate, currentDate } = monthDrag;
    const from = startDate <= currentDate ? startDate : currentDate;
    const to = startDate <= currentDate ? currentDate : startDate;

    const dates = new Set<string>();
    const d = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (d <= end) {
      dates.add(format(d, 'yyyy-MM-dd'));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [monthDrag]);

  const getDateFromElement = useCallback((target: EventTarget): string | null => {
    return (target as HTMLElement).closest?.('[data-date]')?.getAttribute('data-date') ?? null;
  }, []);

  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    // ★ popover 상태를 mousedown 시점에 캡처 (React batch rerender 전)
    popoverOpenOnMouseDownRef.current = isPopoverOpen;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-plan-chip], [data-date-number], [data-quick-create-btn], [data-overflow-btn]')) return;
    const dateStr = getDateFromElement(e.target);
    if (!dateStr) return;
    monthDragRef.current = { startDate: dateStr, activated: false };
  }, [getDateFromElement, isPopoverOpen]);

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!monthDragRef.current) return;
    const dateStr = getDateFromElement(e.target);
    if (!dateStr) return;

    // 다른 셀로 이동해야 드래그 활성화
    if (!monthDragRef.current.activated) {
      if (dateStr === monthDragRef.current.startDate) return;
      monthDragRef.current.activated = true;
    }

    if (monthDrag?.currentDate === dateStr) return;
    setMonthDrag({
      startDate: monthDragRef.current.startDate,
      currentDate: dateStr,
    });
  }, [getDateFromElement, monthDrag?.currentDate]);

  const handleGridMouseUp = useCallback((e: React.MouseEvent) => {
    const dragInfo = monthDragRef.current;
    monthDragRef.current = null;

    if (!dragInfo?.activated || !monthDrag) {
      setMonthDrag(null);
      return;
    }

    const { startDate } = dragInfo;
    const { currentDate } = monthDrag;
    setMonthDrag(null);

    if (startDate !== currentDate && calendarId) {
      suppressClickRef.current = true;
      const from = startDate <= currentDate ? startDate : currentDate;
      const anchorEl = (e.target as HTMLElement).closest('[data-date]');
      if (anchorEl) {
        // 드래그로 생성 시에는 기존 퀵생성 닫고 새로 열기
        if (quickCreateOpenRef.current) {
          quickCreateOpenRef.current = false;
          setQuickCreateState(null);
        }
        setPopoverState(null);
        const datePlans = plansByDate[from] || [];
        const rect = anchorEl.getBoundingClientRect();
        quickCreateOpenRef.current = true;
        setQuickCreateState({
          date: from,
          slot: getDefaultQuickCreateSlot(datePlans),
          virtualRect: { x: rect.left, y: rect.bottom, width: rect.width, height: 0 },
          isAllDay: true,
        });
      }
    }
  }, [monthDrag, calendarId, plansByDate]);

  const handleGridMouseLeave = useCallback(() => {
    if (monthDragRef.current) {
      monthDragRef.current = null;
      setMonthDrag(null);
    }
  }, []);

  // Capture phase: 드래그 종료 후 클릭 이벤트 억제
  const handleGridClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }, []);

  // 드래그 중 Escape 취소
  useEffect(() => {
    if (!monthDrag) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        monthDragRef.current = null;
        setMonthDrag(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [monthDrag]);

  return (
    <div className="flex flex-col h-full p-1 sm:p-2">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={cn(
              "text-center font-medium",
              "text-xs py-1 sm:text-sm sm:py-2",
              label === "일" && "text-red-500",
              label === "토" && "text-blue-500"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div
        ref={gridContainerRef}
        className="grid grid-cols-7 gap-px flex-1 bg-[rgb(var(--color-secondary-200))] rounded-lg overflow-hidden"
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleGridMouseMove}
        onMouseUp={handleGridMouseUp}
        onMouseLeave={handleGridMouseLeave}
        onClickCapture={handleGridClickCapture}
        style={{
          gridTemplateRows: `repeat(${weekCount}, 1fr)`,
          ...(monthDrag ? { userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties : {}),
        }}
      >
        {calendarDays.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const status = getDayCellStatus(date);
          const stats = getDayCellStats(date);
          const plans = plansByDate[dateStr] || [];

          return (
            <DroppableAdminDayCell
              key={dateStr}
              date={date}
              status={status}
              stats={stats}
              plans={plans}
              onDateClick={handleDateClick}
              onPlanClick={handlePlanClick}
              onContextMenu={handleContextMenu}
              isSelectionMode={isSelectionMode}
              selectedPlanIds={selectedPlanIds}
              onPlanSelect={onPlanSelect}
              highlightedPlanIds={mergedHighlightedPlanIds}
              onOverflowClick={handleOverflowClick}
              onQuickCreate={calendarId ? handleQuickCreate : undefined}
              onDoubleClick={onDoubleClickDate}
              isQuickCreateTarget={quickCreateState?.date === dateStr}
              quickCreateSlot={quickCreateState?.date === dateStr ? quickCreateState.slot : null}
              isQuickCreateAllDay={quickCreateState?.date === dateStr ? quickCreateState.isAllDay : undefined}
              isInDragSelection={dragSelectedDates?.has(dateStr) ?? false}
              showHolidays={showHolidays}
              calendarColorMap={calendarColorMap}
              activeCalendarColor={calendarColorMap.get(calendarId ?? '')}
              checkedIn={checkInDates?.has(dateStr)}
            />
          );
        })}
      </div>

      {/* 오버플로 팝오버 */}
      {popoverState && (
        <DayPlanPopover
          date={popoverState.dateStr}
          plans={popoverState.plans}
          stats={popoverState.stats}
          anchorRect={popoverState.anchorRect}
          onClose={handlePopoverClose}
          onPlanClick={handlePlanClick}
          onDateClick={handlePopoverDateClick}
          calendarColorMap={calendarColorMap}
        />
      )}

      {/* 월간뷰 인라인 퀵생성 (Portal) */}
      {quickCreateState && calendarId && createPortal(
        <div
          ref={qcRefs.setFloating}
          style={qcStyles}
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
              planGroupId={planGroupId}
              onSuccess={(createdInfo) => {
                onRefresh();
                if (createdInfo) {
                  setNewlyCreatedPlanId(createdInfo.planId);
                }
                closeQuickCreate();
              }}
              onClose={closeQuickCreate}
              onOpenFullModal={(slot) => {
                if (onOpenEventEditNew && quickCreateState) {
                  onOpenEventEditNew({
                    date: quickCreateState.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                  });
                }
                closeQuickCreate();
              }}
              onOpenConsultationModal={onOpenConsultationEditNew ? (slot, extra) => {
                if (quickCreateState) {
                  onOpenConsultationEditNew({
                    date: quickCreateState.date,
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
                }
                closeQuickCreate();
              } : undefined}
            />
          </div>
        </div>,
        document.body
      )}

      {/* EventDetailPopover (GCal 스타일) */}
      {eventPopoverProps && <EventDetailPopover {...eventPopoverProps} />}
    </div>
  );
}
