"use client";

import { Play, Pause, Square, Clock, CheckCircle2 } from "lucide-react";
import { formatTime, TimeStats, formatTimestamp } from "../_utils/planGroupUtils";
import { cn } from "@/lib/cn";
import { usePlanTimer } from "@/lib/hooks/usePlanTimer";
import type { TimerStatus } from "@/lib/store/planTimerStore";

type PendingAction = "start" | "pause" | "resume" | "complete" | null;

type PlanTimerProps = {
  planId: string;
  timeStats: TimeStats;
  isPaused: boolean;
  isActive: boolean;
  isLoading: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onPostpone?: () => void;
  canPostpone?: boolean;
  pendingAction?: PendingAction;
  compact?: boolean;
  status: TimerStatus;
  accumulatedSeconds: number;
  startedAt: string | null;
  serverNow: number;
};

export function PlanTimer({
  planId,
  timeStats,
  isPaused,
  isActive,
  isLoading,
  onStart,
  onPause,
  onResume,
  onComplete,
  onPostpone,
  canPostpone = false,
  pendingAction = null,
  compact = false,
  status,
  accumulatedSeconds,
  startedAt,
  serverNow,
}: PlanTimerProps) {
  // 새로운 스토어 기반 타이머 훅 사용
  const { seconds } = usePlanTimer({
    planId,
    status,
    accumulatedSeconds,
    startedAt,
    serverNow,
    isCompleted: timeStats.isCompleted,
  });

  const formattedStartTime = timeStats.firstStartTime
    ? formatTimestamp(timeStats.firstStartTime)
    : "-";
  const formattedEndTime = timeStats.lastEndTime
    ? formatTimestamp(timeStats.lastEndTime)
    : "-";
  const formattedPureStudyTime = formatTime(Math.max(0, timeStats.pureStudyTime || 0));

  const isCompleted = timeStats.isCompleted;
  const showTimer = isActive || isPaused || isCompleted;
  const showCompletionMeta = isCompleted && (timeStats.firstStartTime || timeStats.lastEndTime);
  const pendingMessages: Record<Exclude<PendingAction, null>, string> = {
    start: "학습 중...",
    resume: "학습 중...",
    pause: "일시정지 중...",
    complete: "완료 처리 중...",
  };
  const currentPendingMessage =
    isLoading && pendingAction ? pendingMessages[pendingAction as Exclude<PendingAction, null>] : null;

  const completionBannerClass =
    "flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 font-semibold text-emerald-700";

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {showTimer && (
          <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">학습 시간</span>
              </div>
              <div className="text-lg font-bold text-indigo-600">{formatTime(seconds)}</div>
            </div>
            {currentPendingMessage && (
              <div className="text-right text-[11px] font-semibold text-indigo-600">{currentPendingMessage}</div>
            )}
          </div>
        )}

        {showCompletionMeta && (
          <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
            <div className="font-semibold text-indigo-950">학습 완료 기록</div>
            <dl className="grid grid-cols-[92px,1fr] gap-1">
              <dt className="text-indigo-700">시작 시간</dt>
              <dd className="text-right font-medium">{formattedStartTime}</dd>
              <dt className="text-indigo-700">종료 시간</dt>
              <dd className="text-right font-medium">{formattedEndTime}</dd>
              <dt className="text-indigo-700">총 학습</dt>
              <dd className="text-right font-semibold text-indigo-950">{formattedPureStudyTime}</dd>
            </dl>
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
            <div className={cn(completionBannerClass, "text-sm")}>
              <CheckCircle2 className="h-4 w-4" />
              완료됨
            </div>
          )}
        </div>

        {canPostpone && onPostpone && (
          <button
            onClick={onPostpone}
            disabled={isLoading}
            className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
          >
            오늘 일정 미루기
          </button>
        )}
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
              <div className="text-2xl font-bold text-indigo-600">{formatTime(seconds)}</div>
            </div>
            {currentPendingMessage && (
              <div className="mt-2 text-sm font-semibold text-indigo-600">{currentPendingMessage}</div>
            )}
            {timeStats.pauseCount > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                일시정지: {timeStats.pauseCount}회
                {timeStats.pausedDuration > 0 && <span> ({formatTime(timeStats.pausedDuration)})</span>}
              </div>
            )}
          </div>
        )}

        {showCompletionMeta && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <h4 className="text-sm font-semibold text-indigo-900">학습 완료 기록</h4>
            <div className="mt-3 grid gap-3 text-sm text-indigo-950 md:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">시작 시간</span>
                <span className="text-sm font-semibold">{formattedStartTime}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">종료 시간</span>
                <span className="text-sm font-semibold">{formattedEndTime}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">총 학습 시간 (일시정지 제외)</span>
                <span className="text-lg font-bold text-indigo-900">{formattedPureStudyTime}</span>
              </div>
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
            <div className={cn(completionBannerClass, "text-sm")}>
              <CheckCircle2 className="h-4 w-4" />
              완료됨
            </div>
          )}
        </div>

        {canPostpone && onPostpone && (
          <button
            onClick={onPostpone}
            disabled={isLoading}
            className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
          >
            오늘 일정 미루기
          </button>
        )}
      </div>
    </div>
  );
}

