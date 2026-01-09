"use client";

import { useMemo, useCallback, memo } from "react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, DailyScheduleInfo, AcademySchedule } from "@/lib/types/plan";
import type { AdHocPlanForCalendar } from "./PlanCalendarView";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import type { GetPlanConnectionStateFn } from "../_hooks/usePlanConnectionState";
import type { DragItem } from "../_hooks/useCalendarDragDrop";
import { formatDateString } from "@/lib/date/calendarUtils";
import { MemoizedDayCell } from "./MemoizedDayCell";

const TOTAL_CELLS = 42;

type CalendarGridProps = {
  year: number;
  month: number;
  daysInMonth: number;
  startingDayOfWeek: number;
  plansByDate: Map<string, PlanWithContent[]>;
  adHocPlansByDate: Map<string, AdHocPlanForCalendar[]>;
  exclusionsByDate: Map<string, PlanExclusion[]>;
  academySchedulesByDay: Map<number, AcademySchedule[]>;
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  todayStr: string;
  showOnlyStudyTime: boolean;
  studentId?: string;
  getPlanConnectionState: GetPlanConnectionStateFn;
  onDateClick: (date: Date) => void;
  onPlanClick: (plan: PlanWithContent) => void;
  onQuickAdd: (dateStr: string) => void;
  // 드래그 앤 드롭 관련
  dropTarget: string | null;
  draggedItem: DragItem | null;
  isDragging: boolean;
  isMoving: boolean;
  dropHandlers: {
    onDragEnter: (e: React.DragEvent, date: string) => void;
    onDragOver: (e: React.DragEvent, date: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, targetDate: string, targetStartTime?: string) => Promise<void>;
  };
  dragHandlers: {
    onDragStart: (e: React.DragEvent, item: DragItem) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
};

/**
 * 캘린더 그리드 컴포넌트
 */
function CalendarGridComponent({
  year,
  month,
  daysInMonth,
  startingDayOfWeek,
  plansByDate,
  adHocPlansByDate,
  exclusionsByDate,
  academySchedulesByDay,
  dayTypes,
  dailyScheduleMap,
  todayStr,
  showOnlyStudyTime,
  studentId,
  getPlanConnectionState,
  onDateClick,
  onPlanClick,
  onQuickAdd,
  dropTarget,
  draggedItem,
  isDragging,
  isMoving,
  dropHandlers,
  dragHandlers,
}: CalendarGridProps) {
  // 빈 셀 렌더링
  const renderEmptyCell = useCallback(
    (key: string) => (
      <div
        key={key}
        className="min-h-[120px] md:min-h-[140px] lg:min-h-[160px] border border-gray-200 bg-gray-50 rounded-lg"
      />
    ),
    []
  );

  // 캘린더 그리드 생성 (메모이제이션)
  const cells = useMemo(() => {
    const result: React.ReactElement[] = [];

    // 첫 주의 빈 셀
    for (let i = 0; i < startingDayOfWeek; i++) {
      result.push(renderEmptyCell(`empty-${i}`));
    }

    // 날짜 셀
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDateString(date);
      const dayPlans = plansByDate.get(dateStr) || [];
      const dayAdHocPlans = adHocPlansByDate.get(dateStr) || [];
      const dayExclusions = exclusionsByDate.get(dateStr) || [];
      const dayTypeInfo = dayTypes.get(dateStr);
      const dailySchedule = dailyScheduleMap.get(dateStr);
      const dayOfWeek = date.getDay();
      const dayAcademySchedules = academySchedulesByDay.get(dayOfWeek) || [];
      const isToday = dateStr === todayStr;
      const isDropTargetCell = dropTarget === dateStr;
      const canDropHere = draggedItem && draggedItem.planDate !== dateStr;

      result.push(
        <MemoizedDayCell
          key={day}
          dateInfo={{ day, year, month, dateStr }}
          dayData={{ dayPlans, dayAdHocPlans, dayExclusions, dayAcademySchedules }}
          metadata={{ dayTypeInfo, dailySchedule, isToday, showOnlyStudyTime, studentId }}
          handlers={{
            getConnectionState: getPlanConnectionState,
            onDateClick,
            onPlanClick,
            onQuickAdd,
          }}
          dragDropState={{
            isDropTarget: isDropTargetCell,
            canDrop: !!canDropHere,
            isDragging,
            isMoving,
            draggedItemPlanId: draggedItem?.planId,
          }}
          dragDropHandlers={{
            onDragEnter: dropHandlers.onDragEnter,
            onDragOver: dropHandlers.onDragOver,
            onDragLeave: dropHandlers.onDragLeave,
            onDrop: dropHandlers.onDrop,
            onDragStart: dragHandlers.onDragStart,
            onDragEnd: dragHandlers.onDragEnd,
          }}
        />
      );
    }

    // 마지막 주의 빈 셀 (총 42개 셀 유지)
    const remainingCells = TOTAL_CELLS - result.length;
    for (let i = 0; i < remainingCells; i++) {
      result.push(renderEmptyCell(`empty-end-${i}`));
    }

    return result;
  }, [
    startingDayOfWeek,
    daysInMonth,
    year,
    month,
    plansByDate,
    adHocPlansByDate,
    exclusionsByDate,
    dayTypes,
    dailyScheduleMap,
    academySchedulesByDay,
    todayStr,
    showOnlyStudyTime,
    studentId,
    getPlanConnectionState,
    onDateClick,
    onPlanClick,
    onQuickAdd,
    dropTarget,
    draggedItem,
    isDragging,
    isMoving,
    dropHandlers,
    dragHandlers,
    renderEmptyCell,
  ]);

  return (
    <div className="grid grid-cols-7 gap-2 md:gap-3" role="rowgroup">
      {cells}
    </div>
  );
}

export const CalendarGrid = memo(CalendarGridComponent);
