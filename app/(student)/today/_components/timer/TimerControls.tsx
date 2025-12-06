"use client";

import { Play, Pause, Square, CheckCircle2, Loader2 } from "lucide-react";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { cn } from "@/lib/cn";

type PendingAction = "start" | "pause" | "resume" | "complete" | null;

type TimerControlsProps = {
  status: TimerStatus;
  isLoading: boolean;
  pendingAction?: PendingAction;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onPostpone?: () => void;
  canPostpone?: boolean;
  compact?: boolean;
  className?: string;
};

const pendingMessages: Record<
  Exclude<PendingAction, null>,
  string
> = {
  start: "학습 중...",
  resume: "학습 중...",
  pause: "일시정지 중...",
  complete: "완료 처리 중...",
};

export function TimerControls({
  status,
  isLoading,
  pendingAction = null,
  onStart,
  onPause,
  onResume,
  onComplete,
  onPostpone,
  canPostpone = false,
  compact = false,
  className,
}: TimerControlsProps) {
  const currentPendingMessage =
    isLoading && pendingAction
      ? pendingMessages[pendingAction as Exclude<PendingAction, null>]
      : null;

  const buttonSize = compact ? "text-sm px-3 py-1.5" : "text-sm px-4 py-2";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {currentPendingMessage && (
        <div
          className={cn(
            "text-center font-semibold text-indigo-600",
            compact ? "text-[11px]" : "text-sm"
          )}
        >
          {currentPendingMessage}
        </div>
      )}

      <div className="flex gap-2">
        {status === "NOT_STARTED" && (
          <button
            onClick={onStart}
            disabled={isLoading}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50",
              buttonSize
            )}
          >
            {isLoading && pendingAction === "start" ? (
              <Loader2 className={cn("animate-spin", iconSize)} />
            ) : (
              <Play className={iconSize} />
            )}
            시작하기
          </button>
        )}

        {status === "RUNNING" && (
          <>
            <button
              onClick={onPause}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50",
                buttonSize
              )}
            >
              {isLoading && pendingAction === "pause" ? (
                <Loader2 className={cn("animate-spin", iconSize)} />
              ) : (
                <Pause className={iconSize} />
              )}
              일시정지
            </button>
            <button
              onClick={onComplete}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50",
                buttonSize
              )}
            >
              {isLoading && pendingAction === "complete" ? (
                <Loader2 className={cn("animate-spin", iconSize)} />
              ) : (
                <Square className={iconSize} />
              )}
              학습 결과 입력
            </button>
          </>
        )}

        {status === "PAUSED" && (
          <>
            <button
              onClick={onResume}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50",
                buttonSize
              )}
            >
              {isLoading && pendingAction === "resume" ? (
                <Loader2 className={cn("animate-spin", iconSize)} />
              ) : (
                <Play className={iconSize} />
              )}
              재시작
            </button>
            <button
              onClick={onComplete}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 font-semibold text-white transition hover:bg-green-700 disabled:opacity-50",
                buttonSize
              )}
            >
              {isLoading && pendingAction === "complete" ? (
                <Loader2 className={cn("animate-spin", iconSize)} />
              ) : (
                <Square className={iconSize} />
              )}
              학습 결과 입력
            </button>
          </>
        )}

        {status === "COMPLETED" && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 font-semibold text-emerald-700",
              buttonSize
            )}
          >
            <CheckCircle2 className={iconSize} />
            완료됨
          </div>
        )}
      </div>

      {canPostpone && onPostpone && status !== "COMPLETED" && (
        <button
          onClick={onPostpone}
          disabled={isLoading}
          className={cn(
            "w-full rounded-lg border border-orange-200 bg-orange-50 font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50",
            compact ? "px-3 py-1.5 text-xs" : "px-3 py-2 text-sm"
          )}
        >
          오늘 일정 미루기
        </button>
      )}
    </div>
  );
}

