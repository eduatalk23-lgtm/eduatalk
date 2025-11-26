"use client";

import { cn } from "@/lib/cn";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { formatTime } from "../_utils/planGroupUtils";

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
                "relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white transition-all",
                isCompleted && "border-green-500 bg-green-50",
                isInProgress && "border-indigo-600 bg-indigo-50 shadow-lg shadow-indigo-200",
                isPending && "border-gray-300 bg-gray-50"
              )}
              aria-label={
                isCompleted ? "완료됨" : isInProgress ? "진행 중" : "대기 중"
              }
            >
              {isCompleted && (
                <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
              )}
              {isInProgress && (
                <Clock className="h-4 w-4 text-indigo-600 animate-pulse" aria-hidden="true" />
              )}
              {isPending && (
                <Circle className="h-3 w-3 text-gray-400" aria-hidden="true" />
              )}
            </div>

            {/* 콘텐츠 카드 */}
            <div
              className={cn(
                "flex flex-1 flex-col gap-2 rounded-lg border p-4 transition-all",
                isCompleted && "border-green-200 bg-green-50/50",
                isInProgress && "border-indigo-300 bg-indigo-50 shadow-md",
                isPending && "border-gray-200 bg-white"
              )}
            >
              {/* 제목 영역 */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h3
                    className={cn(
                      "text-sm font-semibold",
                      isCompleted && "text-green-900",
                      isInProgress && "text-indigo-900",
                      isPending && "text-gray-900"
                    )}
                  >
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p
                      className={cn(
                        "text-xs",
                        isCompleted && "text-green-700",
                        isInProgress && "text-indigo-700",
                        isPending && "text-gray-600"
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
                    isCompleted && "bg-green-100 text-green-700",
                    isInProgress && "bg-indigo-100 text-indigo-700",
                    isPending && "bg-gray-100 text-gray-600"
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
                    <div className="flex items-center gap-1 text-gray-600">
                      <span className="font-medium">시작:</span>
                      <span>{new Date(item.startTime).toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}</span>
                    </div>
                  )}
                  {item.endTime && (
                    <div className="flex items-center gap-1 text-gray-600">
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
                        isCompleted && "text-green-700",
                        isInProgress && "text-indigo-700",
                        isPending && "text-gray-600"
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

