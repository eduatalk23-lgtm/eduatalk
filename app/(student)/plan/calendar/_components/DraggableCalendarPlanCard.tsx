"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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
        "relative group",
        isDragging && "opacity-50 shadow-xl",
        disabled && "cursor-not-allowed",
        className
      )}
      {...attributes}
    >
      {/* Drag Handle */}
      {!disabled && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "cursor-grab active:cursor-grabbing",
            "bg-gradient-to-r from-gray-100/80 to-transparent",
            "rounded-l-md"
          )}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      )}

      {/* Content with padding for drag handle */}
      <div className={cn(!disabled && "pl-4")}>
        {children}
      </div>
    </div>
  );
}
