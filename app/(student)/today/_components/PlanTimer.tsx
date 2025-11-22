"use client";

import { useState, useEffect } from "react";
import { Play, Pause, Square, Clock, CheckCircle2 } from "lucide-react";
import { formatTime, TimeStats } from "../_utils/planGroupUtils";
import { cn } from "@/lib/cn";

type PlanTimerProps = {
  timeStats: TimeStats;
  isPaused: boolean;
  isActive: boolean;
  isLoading: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  compact?: boolean;
};

export function PlanTimer({
  timeStats,
  isPaused,
  isActive,
  isLoading,
  onStart,
  onPause,
  onResume,
  onComplete,
  compact = false,
}: PlanTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 실시간 시간 업데이트
  useEffect(() => {
    if (!isActive || isPaused || timeStats.isCompleted) {
      // 타임스탬프 기반 계산
      const start = timeStats.firstStartTime ? new Date(timeStats.firstStartTime).getTime() : 0;
      const end = timeStats.lastEndTime ? new Date(timeStats.lastEndTime).getTime() : Date.now();
      const totalSeconds = start > 0 ? Math.floor((end - start) / 1000) : 0;
      const pausedSeconds = timeStats.pausedDuration || 0;
      const currentPausedSeconds = timeStats.currentPausedAt && isPaused
        ? Math.floor((Date.now() - new Date(timeStats.currentPausedAt).getTime()) / 1000)
        : 0;
      setElapsedSeconds(Math.max(0, totalSeconds - pausedSeconds - currentPausedSeconds));
      return;
    }

    // 활성 상태일 때만 실시간 업데이트
    const interval = setInterval(() => {
      const start = timeStats.firstStartTime ? new Date(timeStats.firstStartTime).getTime() : 0;
      const now = Date.now();
      const totalSeconds = start > 0 ? Math.floor((now - start) / 1000) : 0;
      const pausedSeconds = timeStats.pausedDuration || 0;
      setElapsedSeconds(Math.max(0, totalSeconds - pausedSeconds));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, timeStats, timeStats.isCompleted]);

  const isCompleted = timeStats.isCompleted;
  const showTimer = isActive || isPaused || isCompleted;

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {showTimer && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">학습 시간</span>
            </div>
            <div className="text-lg font-bold text-indigo-600">
              {formatTime(elapsedSeconds)}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isActive && !isPaused && !isCompleted && (
            <button
              onClick={onStart}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              )}
            >
              <Play className="h-4 w-4" />
              시작하기
            </button>
          )}

          {isActive && !isPaused && (
            <>
              <button
                onClick={onPause}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50"
                )}
              >
                <Pause className="h-4 w-4" />
                일시정지
              </button>
              <button
                onClick={onComplete}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                )}
              >
                <Square className="h-4 w-4" />
                완료하기
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={onResume}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                )}
              >
                <Play className="h-4 w-4" />
                다시시작
              </button>
              <button
                onClick={onComplete}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                )}
              >
                <Square className="h-4 w-4" />
                완료하기
              </button>
            </>
          )}

          {isCompleted && (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
              <CheckCircle2 className="h-4 w-4" />
              완료됨
            </div>
          )}
        </div>
      </div>
    );
  }

  // 전체 뷰
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        {showTimer && (
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <span className="text-base font-medium text-gray-700">학습 시간</span>
              </div>
              <div className="text-2xl font-bold text-indigo-600">
                {formatTime(elapsedSeconds)}
              </div>
            </div>
            {timeStats.pauseCount > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                일시정지: {timeStats.pauseCount}회
                {timeStats.pausedDuration > 0 && (
                  <span> ({formatTime(timeStats.pausedDuration)})</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!isActive && !isPaused && !isCompleted && (
            <button
              onClick={onStart}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              )}
            >
              <Play className="h-4 w-4" />
              시작하기
            </button>
          )}

          {isActive && !isPaused && (
            <>
              <button
                onClick={onPause}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50"
                )}
              >
                <Pause className="h-4 w-4" />
                일시정지
              </button>
              <button
                onClick={onComplete}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                )}
              >
                <Square className="h-4 w-4" />
                완료하기
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={onResume}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                )}
              >
                <Play className="h-4 w-4" />
                다시시작
              </button>
              <button
                onClick={onComplete}
                disabled={isLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                )}
              >
                <Square className="h-4 w-4" />
                완료하기
              </button>
            </>
          )}

          {isCompleted && (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600">
              완료됨
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

