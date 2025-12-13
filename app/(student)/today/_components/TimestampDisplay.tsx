"use client";

import { Clock } from "lucide-react";
import { formatTime, formatTimestamp, calculateStudyTimeFromTimestamps } from "../_utils/planGroupUtils";

type TimestampDisplayProps = {
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  totalDurationSeconds?: number | null;
  pausedDurationSeconds?: number | null;
  pauseCount?: number | null;
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  currentPausedAt?: string | null; // 현재 일시정지 시작 시간
  className?: string;
};

export function TimestampDisplay({
  actualStartTime,
  actualEndTime,
  totalDurationSeconds,
  pausedDurationSeconds,
  pauseCount,
  isRunning,
  isPaused,
  isCompleted,
  currentPausedAt,
  className,
}: TimestampDisplayProps) {
  // 타임스탬프 기반 시간 계산 (현재 일시정지 중인 경우 고려)
  const displaySeconds = calculateStudyTimeFromTimestamps(
    actualStartTime,
    actualEndTime,
    pausedDurationSeconds,
    isPaused,
    currentPausedAt
  );

  return (
    <div className={`rounded-lg bg-gray-50 p-3 ${className || ""}`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {isCompleted ? "총 학습 시간" : "학습 시간"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-lg font-bold text-indigo-600">
          {formatTime(displaySeconds)}
          {isPaused && (
            <span className="text-xs text-gray-500">(일시정지 중)</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {actualStartTime && (
            <div className="text-xs text-gray-600">
              시작: {formatTimestamp(actualStartTime)}
            </div>
          )}

          {actualEndTime && isCompleted && (
            <div className="text-xs text-gray-600">
              종료: {formatTimestamp(actualEndTime)}
            </div>
          )}

          {pauseCount != null && pauseCount > 0 && (
            <div className="text-xs text-gray-500">
              일시정지: {pauseCount}회
              {pausedDurationSeconds != null &&
                pausedDurationSeconds > 0 &&
                ` (${formatTime(pausedDurationSeconds)})`}
            </div>
          )}

          {isCompleted && pausedDurationSeconds && totalDurationSeconds && (
            <div className="text-xs text-gray-500">
              실제 학습: {formatTime(totalDurationSeconds - pausedDurationSeconds)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

