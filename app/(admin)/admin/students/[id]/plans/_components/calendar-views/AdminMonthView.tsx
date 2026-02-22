"use client";

/**
 * 관리자 월간 캘린더 뷰
 *
 * 한 달 전체 플랜을 7열 그리드로 표시합니다.
 * 드래그앤드롭으로 플랜 날짜 변경 지원
 */

import { useMemo, useCallback, useState, useEffect } from "react";
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
import { usePopoverPosition, placementToTransformOrigin } from "../hooks/usePopoverPosition";
import { calculateEmptySlots, type EmptySlot, type OccupiedSlot } from "@/lib/domains/admin-plan/utils/emptySlotCalculation";
import type {
  AdminMonthViewProps,
  CalendarPlan,
  DayCellStatus,
  DayCellStats,
} from "./_types/adminCalendar";

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

// 요일 헤더
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function AdminMonthView({
  studentId,
  tenantId,
  plannerId,
  planGroupId,
  currentMonth,
  selectedDate,
  onDateSelect,
  plansByDate,
  exclusionsByDate,
  dailySchedulesByDate,
  dateTimeSlots,
  onTimelineClick,
  onPlanClick,
  onContextMenu: onContextMenuProp,
  onExclusionToggle,
  onRefresh,
  isSelectionMode = false,
  selectedPlanIds,
  onPlanSelect,
  highlightedPlanIds,
}: AdminMonthViewProps) {
  // 캘린더 날짜 배열 생성 (6주 * 7일 = 42일)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

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

      const totalPlans = plans.length;
      const completedPlans = plans.filter((p) => p.status === "completed").length;
      const inProgressPlans = plans.filter((p) => p.status === "in_progress").length;
      const pendingPlans = plans.filter(
        (p) => p.status === "pending" || !p.status
      ).length;
      const completionRate =
        totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
      const totalEstimatedMinutes = plans.reduce(
        (sum, p) => sum + (p.estimated_minutes || 0),
        0
      );

      // Phase 4: 시간대 유형별 통계
      const studySlotPlans = plans.filter(
        (p) => (p as { time_slot_type?: string }).time_slot_type === "study"
      ).length;
      const selfStudySlotPlans = plans.filter(
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

  const { refs: qcRefs, floatingStyles: qcStyles, resolvedPlacement: qcPlacement } =
    usePopoverPosition({
      virtualRect: quickCreateState?.virtualRect ?? null,
      placement: 'bottom-start',
      open: !!quickCreateState,
    });

  const handleQuickCreate = useCallback((dateStr: string, anchorRect: DOMRect) => {
    setPopoverState(null); // 다른 팝오버 닫기
    const datePlans = plansByDate[dateStr] || [];
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
  }, [plansByDate]);

  const closeQuickCreate = useCallback(() => setQuickCreateState(null), []);

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

  // 외부 클릭 닫기
  useEffect(() => {
    if (!quickCreateState) return;
    const handleClick = (e: MouseEvent) => {
      const floatingEl = qcRefs.floating.current;
      if (floatingEl?.contains(e.target as Node)) return;
      closeQuickCreate();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

  return (
    <div className="flex flex-col h-full p-2">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "text-center text-sm font-medium py-2",
              index === 0 && "text-red-500",
              index === 6 && "text-blue-500"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7 gap-px flex-1 bg-gray-200 rounded-lg overflow-hidden">
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
              onPlanClick={onPlanClick}
              onContextMenu={handleContextMenu}
              isSelectionMode={isSelectionMode}
              selectedPlanIds={selectedPlanIds}
              onPlanSelect={onPlanSelect}
              highlightedPlanIds={mergedHighlightedPlanIds}
              onOverflowClick={handleOverflowClick}
              onQuickCreate={plannerId ? handleQuickCreate : undefined}
              isQuickCreateTarget={quickCreateState?.date === dateStr}
              quickCreateSlot={quickCreateState?.date === dateStr ? quickCreateState.slot : null}
              isQuickCreateAllDay={quickCreateState?.date === dateStr ? quickCreateState.isAllDay : undefined}
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
          onPlanClick={onPlanClick}
          onDateClick={handlePopoverDateClick}
        />
      )}

      {/* 월간뷰 인라인 퀵생성 (Portal) */}
      {quickCreateState && plannerId && createPortal(
        <div
          ref={qcRefs.setFloating}
          style={{ ...qcStyles, transformOrigin: placementToTransformOrigin(qcPlacement) }}
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
              planGroupId={planGroupId}
              onSuccess={(createdInfo) => {
                onRefresh();
                if (createdInfo) {
                  setNewlyCreatedPlanId(createdInfo.planId);
                }
                closeQuickCreate();
              }}
              onClose={closeQuickCreate}
              onOpenFullModal={() => closeQuickCreate()}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
