"use client";

import { cn } from "@/lib/cn";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { formatTime } from "../_utils/planGroupUtils";
import {
  statusCardStyles,
  statusTextStyles,
  statusBadgeStyles,
  textTertiary,
  textMuted,
  bgSurface,
  borderDefault,
  bgStyles,
} from "@/lib/utils/darkMode";

type TimelineItem = {
  id: string;
  title: string;
  subtitle?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  status: "completed" | "in_progress" | "pending";
};

type PlanTimelineProps = {
  items: TimelineItem[];
  className?: string;
};

export function PlanTimeline({ items, className }: PlanTimelineProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative flex flex-col gap-6", className)}>
      {/* 세로 연결선 */}
      <div className="absolute left-[15px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-indigo-200 via-gray-200 to-gray-100" aria-hidden="true" />

      {items.map((item, index) => {
        const isCompleted = item.status === "completed";
        const isInProgress = item.status === "in_progress";
        const isPending = item.status === "pending";

        return (
          <div key={item.id} className="relative flex gap-4">
            {/* 타임라인 마커 */}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
                bgSurface,
                isCompleted && "border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/30",
                isInProgress && "border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50",
                isPending && cn(borderDefault, bgStyles.gray)
              )}
              aria-label={
                isCompleted ? "완료됨" : isInProgress ? "진행 중" : "대기 중"
              }
            >
              {isCompleted && (
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
              )}
              {isInProgress && (
                <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-pulse" aria-hidden="true" />
              )}
              {isPending && (
                <Circle className={cn("h-3 w-3", textMuted)} aria-hidden="true" />
              )}
            </div>

            {/* 콘텐츠 카드 */}
            <div
              className={cn(
                "flex flex-1 flex-col gap-2 rounded-lg border p-4 transition-all",
                isCompleted && statusCardStyles.completed,
                isInProgress && statusCardStyles.inProgress,
                isPending && statusCardStyles.pending
              )}
            >
              {/* 제목 영역 */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h3
                    className={cn(
                      "text-sm font-semibold",
                      isCompleted && statusTextStyles.completed,
                      isInProgress && statusTextStyles.inProgress,
                      isPending && statusTextStyles.pending
                    )}
                  >
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p
                      className={cn(
                        "text-xs",
                        isCompleted && statusTextStyles.completedSubtext,
                        isInProgress && statusTextStyles.inProgressSubtext,
                        isPending && statusTextStyles.pendingSubtext
                      )}
                    >
                      {item.subtitle}
                    </p>
                  )}
                </div>

                {/* 상태 뱃지 */}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    isCompleted && statusBadgeStyles.completed,
                    isInProgress && statusBadgeStyles.inProgress,
                    isPending && statusBadgeStyles.pending
                  )}
                >
                  {isCompleted && "완료"}
                  {isInProgress && "진행 중"}
                  {isPending && "대기"}
                </span>
              </div>

              {/* 시간 정보 */}
              {(item.startTime || item.endTime || item.duration !== undefined) && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {item.startTime && (
                    <div className={cn("flex items-center gap-1", textTertiary)}>
                      <span className="font-medium">시작:</span>
                      <span>{new Date(item.startTime).toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}</span>
                    </div>
                  )}
                  {item.endTime && (
                    <div className={cn("flex items-center gap-1", textTertiary)}>
                      <span className="font-medium">종료:</span>
                      <span>{new Date(item.endTime).toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}</span>
                    </div>
                  )}
                  {item.duration !== undefined && (
                    <div
                      className={cn(
                        "ml-auto flex items-center gap-1 font-semibold",
                        isCompleted && statusTextStyles.completedSubtext,
                        isInProgress && statusTextStyles.inProgressSubtext,
                        isPending && textTertiary
                      )}
                    >
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>{formatTime(item.duration)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

