"use client";

import { memo, useCallback, useState } from "react";
import { GripHorizontal, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PlanWithContent } from "../_types/plan";
import { CalendarPlanCard } from "./CalendarPlanCard";
import { usePlanResize, type ResizeDirection } from "../_hooks/usePlanResize";
import { type PlanType } from "@/lib/domains/plan/actions/calendarDrag";

interface ResizablePlanCardProps {
  plan: PlanWithContent;
  planType?: PlanType;
  compact?: boolean;
  showTime?: boolean;
  showProgress?: boolean;
  isConnected?: boolean;
  onLinkContent?: (planId: string, slotIndex: number) => void;
  onResizeStart?: (planId: string) => void;
  onResizeEnd?: (planId: string, newStart: string, newEnd: string) => void;
  onResizeError?: (error: string) => void;
  enableResize?: boolean;
}

function ResizablePlanCardComponent({
  plan,
  planType = "student_plan",
  compact = false,
  showTime = true,
  showProgress = true,
  isConnected = false,
  onLinkContent,
  onResizeStart,
  onResizeEnd,
  onResizeError,
  enableResize = true,
}: ResizablePlanCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const {
    state,
    isSubmitting,
    startResize,
    isResizingPlan,
    getPreviewTimes,
  } = usePlanResize({
    minuteHeight: 2,
    snapMinutes: 5,
    minDuration: 15,
    maxDuration: 240,
    onResizeStart,
    onResizeEnd,
    onResizeError,
  });

  const isResizing = isResizingPlan(plan.id);
  const previewTimes = getPreviewTimes(plan.id);

  const handleResizeStart = useCallback(
    (direction: ResizeDirection, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!plan.start_time || !plan.end_time) {
        onResizeError?.("시간 정보가 없는 플랜입니다.");
        return;
      }

      startResize(
        plan.id,
        direction,
        plan.start_time,
        plan.end_time,
        e.clientY
      );
    },
    [plan.id, plan.start_time, plan.end_time, startResize, onResizeError]
  );

  // 시간이 없는 플랜은 리사이즈 비활성화
  const canResize = enableResize && plan.start_time && plan.end_time;

  // 표시할 시간 (리사이즈 중이면 프리뷰 시간)
  const displayStartTime = isResizing && previewTimes?.startTime
    ? previewTimes.startTime
    : plan.start_time;
  const displayEndTime = isResizing && previewTimes?.endTime
    ? previewTimes.endTime
    : plan.end_time;

  return (
    <div
      className={cn(
        "relative group",
        isResizing && "z-50",
        isSubmitting && "opacity-70 pointer-events-none"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 상단 리사이즈 핸들 */}
      {canResize && (
        <div
          className={cn(
            "absolute -top-1 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize z-10",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isResizing && state.direction === "top" && "opacity-100"
          )}
          onMouseDown={(e) => handleResizeStart("top", e)}
        >
          <div
            className={cn(
              "flex items-center justify-center px-3 py-0.5 rounded-full bg-blue-500 text-white shadow-md",
              "transform -translate-y-1/2"
            )}
          >
            <GripHorizontal className="w-4 h-3" />
          </div>
        </div>
      )}

      {/* 플랜 카드 */}
      <div
        className={cn(
          "transition-all",
          isResizing && "ring-2 ring-blue-500 ring-offset-1 shadow-lg"
        )}
      >
        <CalendarPlanCard
          plan={plan}
          compact={compact}
          showTime={showTime}
          showProgress={showProgress}
          isConnected={isConnected}
          onLinkContent={onLinkContent}
        />

        {/* 리사이즈 중 시간 프리뷰 */}
        {isResizing && displayStartTime && displayEndTime && (
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-md shadow-lg whitespace-nowrap">
              <Clock className="w-3 h-3" />
              <span>{displayStartTime} ~ {displayEndTime}</span>
            </div>
          </div>
        )}
      </div>

      {/* 하단 리사이즈 핸들 */}
      {canResize && (
        <div
          className={cn(
            "absolute -bottom-1 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize z-10",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isResizing && state.direction === "bottom" && "opacity-100"
          )}
          onMouseDown={(e) => handleResizeStart("bottom", e)}
        >
          <div
            className={cn(
              "flex items-center justify-center px-3 py-0.5 rounded-full bg-blue-500 text-white shadow-md",
              "transform translate-y-1/2"
            )}
          >
            <GripHorizontal className="w-4 h-3" />
          </div>
        </div>
      )}

      {/* 로딩 오버레이 */}
      {isSubmitting && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export const ResizablePlanCard = memo(ResizablePlanCardComponent, (prev, next) => {
  return (
    prev.plan.id === next.plan.id &&
    prev.plan.start_time === next.plan.start_time &&
    prev.plan.end_time === next.plan.end_time &&
    prev.plan.progress === next.plan.progress &&
    prev.compact === next.compact &&
    prev.showTime === next.showTime &&
    prev.showProgress === next.showProgress &&
    prev.isConnected === next.isConnected &&
    prev.enableResize === next.enableResize
  );
});
