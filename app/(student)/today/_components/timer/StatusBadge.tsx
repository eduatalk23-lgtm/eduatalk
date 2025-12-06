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
    className: "bg-gray-100 text-gray-800 border-gray-300",
  },
  RUNNING: {
    label: "진행 중",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  PAUSED: {
    label: "일시정지",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  COMPLETED: {
    label: "완료",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
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
        "inline-flex items-center rounded-full border-2 font-bold shadow-sm",
        config.className,
        sizeClass,
        className
      )}
    >
      {config.label}
    </span>
  );
}

