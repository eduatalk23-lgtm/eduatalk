"use client";

import { Clock } from "lucide-react";
import { formatTime } from "../../_utils/planGroupUtils";
import { StatusBadge } from "./StatusBadge";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { cn } from "@/lib/cn";

type TimerDisplayProps = {
  seconds: number;
  status: TimerStatus;
  subtitle?: string;
  showStatusBadge?: boolean;
  compact?: boolean;
  className?: string;
};

export function TimerDisplay({
  seconds,
  status,
  subtitle,
  showStatusBadge = true,
  compact = false,
  className,
}: TimerDisplayProps) {
  const formattedTime = formatTime(seconds);

  if (compact) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {subtitle || "학습 시간"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showStatusBadge && <StatusBadge status={status} size="sm" />}
            <div className="text-lg font-bold text-indigo-600">
              {formattedTime}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <span className="text-base font-medium text-gray-700">
                {subtitle || "학습 시간"}
              </span>
            </div>
            <div className="text-2xl font-bold text-indigo-600">
              {formattedTime}
            </div>
          </div>
          {showStatusBadge && (
            <div className="flex items-center justify-center">
              <StatusBadge status={status} size="md" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

