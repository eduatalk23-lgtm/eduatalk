"use client";

/**
 * 드롭 가능한 간트 날짜 열
 *
 * @dnd-kit/core의 useDroppable을 사용하여 드롭 영역 제공
 * 각 날짜 열이 독립적인 드롭 타겟이 됨
 */

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/cn";
import { useAdminCalendarDrag } from "./_context/AdminCalendarDragContext";
import type { DroppableTargetData } from "./_types/adminCalendar";

// 날짜 셀 너비 (px)
const DAY_WIDTH = 40;

interface DroppableGanttDateColumnProps {
  dateStr: string;
  dayOffset: number;
  isExclusion: boolean;
}

/**
 * Props 비교 함수
 */
function arePropsEqual(
  prevProps: DroppableGanttDateColumnProps,
  nextProps: DroppableGanttDateColumnProps
): boolean {
  return (
    prevProps.dateStr === nextProps.dateStr &&
    prevProps.dayOffset === nextProps.dayOffset &&
    prevProps.isExclusion === nextProps.isExclusion
  );
}

function DroppableGanttDateColumnComponent({
  dateStr,
  dayOffset,
  isExclusion,
}: DroppableGanttDateColumnProps) {
  // 드롭 타겟 데이터
  const dropData: DroppableTargetData = {
    date: dateStr,
    isExclusion,
  };

  const { isDragging, canDropOnDate } = useAdminCalendarDrag();

  const { setNodeRef, isOver } = useDroppable({
    id: `gantt-day-${dateStr}`,
    data: dropData,
    disabled: isExclusion,
  });

  // 드롭 가능 여부
  const canDrop = canDropOnDate(dateStr);
  const showDropIndicator = isDragging && !isExclusion;
  const showInvalidDrop = isDragging && isExclusion;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-0 bottom-0 transition-all duration-200",
        // 제외일 배경
        isExclusion && "bg-gray-100 opacity-50",
        // 드래그 중 드롭 가능 표시 - 그라데이션 추가
        showDropIndicator && canDrop && "bg-gradient-to-b from-blue-100/40 to-transparent",
        isOver && canDrop && "bg-blue-100/60 ring-2 ring-inset ring-blue-400 shadow-inner",
        // 드롭 불가 표시 - 그라데이션 추가
        showInvalidDrop && "bg-gradient-to-b from-red-100/40 to-transparent",
        isOver && !canDrop && "bg-red-100/60 ring-2 ring-inset ring-red-400"
      )}
      style={{
        left: dayOffset * DAY_WIDTH,
        width: DAY_WIDTH,
      }}
    />
  );
}

/**
 * 메모이제이션된 드롭 가능한 간트 날짜 열
 */
const DroppableGanttDateColumn = memo(
  DroppableGanttDateColumnComponent,
  arePropsEqual
);

export default DroppableGanttDateColumn;
