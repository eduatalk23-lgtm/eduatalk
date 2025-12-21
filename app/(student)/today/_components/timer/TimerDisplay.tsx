"use client";

import { memo } from "react";
import { Clock } from "lucide-react";
import { formatTime } from "../../_utils/planGroupUtils";
import { StatusBadge } from "./StatusBadge";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { cn } from "@/lib/cn";
import {
  bgSurfaceVar,
  bgPageVar,
  borderDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
} from "@/lib/utils/darkMode";

type TimerDisplayProps = {
  seconds: number;
  status: TimerStatus;
  subtitle?: string;
  showStatusBadge?: boolean;
  compact?: boolean;
  className?: string;
};

function TimerDisplayComponent({
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
        <div className={cn("flex items-center justify-between rounded-lg p-2", bgPageVar)}>
          <div className="flex items-center gap-2">
            <Clock className={cn("h-4 w-4", textTertiaryVar)} />
            <span className={cn("text-sm font-medium", textSecondaryVar)}>
              {subtitle || "학습 시간"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showStatusBadge && <StatusBadge status={status} size="sm" />}
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
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
        "rounded-lg border p-4 shadow-sm",
        bgSurfaceVar,
        borderDefaultVar,
        className
      )}
    >
      <div className="flex flex-col gap-3">
        <div className={cn("flex flex-col gap-3 rounded-lg p-4", bgPageVar)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className={cn("h-5 w-5", textTertiaryVar)} />
              <span className={cn("text-base font-medium", textSecondaryVar)}>
                {subtitle || "학습 시간"}
              </span>
            </div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
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

// React.memo로 불필요한 리렌더링 방지
export const TimerDisplay = memo(TimerDisplayComponent, (prevProps, nextProps) => {
  // 핵심 props만 비교하여 불필요한 리렌더링 방지
  return (
    prevProps.seconds === nextProps.seconds &&
    prevProps.status === nextProps.status &&
    prevProps.subtitle === nextProps.subtitle &&
    prevProps.showStatusBadge === nextProps.showStatusBadge &&
    prevProps.compact === nextProps.compact &&
    prevProps.className === nextProps.className
  );
});

