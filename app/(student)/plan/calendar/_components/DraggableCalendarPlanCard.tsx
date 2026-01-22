"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { DraggablePlanData } from "../_context/CalendarDragContext";
import { ReactNode } from "react";

interface DraggableCalendarPlanCardProps {
  planData: DraggablePlanData;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DraggableCalendarPlanCard({
  planData,
  children,
  className,
  disabled = false,
}: DraggableCalendarPlanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${planData.type}-${planData.id}`,
    data: planData,
    disabled,
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        zIndex: isDragging ? 100 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group transition-all",
        isDragging && "opacity-50 shadow-xl",
        disabled && "cursor-not-allowed",
        !disabled && "cursor-grab hover:ring-1 hover:ring-gray-200 hover:shadow-sm rounded-lg",
        className
      )}
      {...attributes}
    >
      {/* Content - 카드 전체로 드래그 */}
      <div {...listeners}>
        {children}
      </div>
    </div>
  );
}
