"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import { DroppableTargetData, useCalendarDrag } from "../_context/CalendarDragContext";
import { ReactNode } from "react";

interface DroppableDayCellProps {
  date: string; // YYYY-MM-DD format
  startTime?: string; // HH:mm format (optional, for time-slot drops)
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DroppableDayCell({
  date,
  startTime,
  children,
  className,
  disabled = false,
}: DroppableDayCellProps) {
  const { isDragging, activePlan } = useCalendarDrag();

  const droppableData: DroppableTargetData = {
    targetType: startTime ? "time-slot" : "date",
    date,
    startTime,
  };

  const { isOver, setNodeRef } = useDroppable({
    id: startTime ? `${date}-${startTime}` : date,
    data: droppableData,
    disabled,
  });

  // 같은 날짜면 드롭 힌트 비활성화
  const isSameDate = activePlan?.originalDate === date;
  const isSameTimeSlot = isSameDate && activePlan?.originalStartTime === startTime;
  const showDropHint = isDragging && !isSameTimeSlot && !disabled;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative transition-colors duration-150",
        showDropHint && "ring-2 ring-blue-400 ring-inset",
        isOver && showDropHint && "bg-blue-50",
        className
      )}
    >
      {children}

      {/* Drop indicator overlay */}
      {isOver && showDropHint && (
        <div className="absolute inset-0 bg-blue-100/30 pointer-events-none flex items-center justify-center z-10">
          <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-sm">
            이동
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Time slot drop zone for DayView
 */
interface DroppableTimeSlotProps {
  date: string;
  hour: number;
  children?: ReactNode;
  className?: string;
}

export function DroppableTimeSlot({
  date,
  hour,
  children,
  className,
}: DroppableTimeSlotProps) {
  const startTime = `${String(hour).padStart(2, "0")}:00`;

  return (
    <DroppableDayCell
      date={date}
      startTime={startTime}
      className={cn("min-h-12", className)}
    >
      {children}
    </DroppableDayCell>
  );
}
