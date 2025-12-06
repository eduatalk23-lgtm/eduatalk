"use client";

import type { TimerStatus } from "@/lib/store/planTimerStore";
import { cn } from "@/lib/cn";

type StatusBadgeProps = {
  status: TimerStatus;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const statusConfig: Record<
  TimerStatus,
  { label: string; className: string }
> = {
  NOT_STARTED: {
    label: "대기",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  RUNNING: {
    label: "진행 중",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  PAUSED: {
    label: "일시정지",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  COMPLETED: {
    label: "완료",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

export function StatusBadge({
  status,
  className,
  size = "md",
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        config.className,
        sizeClass,
        className
      )}
    >
      {config.label}
    </span>
  );
}

