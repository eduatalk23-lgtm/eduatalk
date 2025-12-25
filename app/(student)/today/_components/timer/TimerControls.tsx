"use client";

import { Play, Pause, Square, CheckCircle2, Loader2 } from "lucide-react";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { cn } from "@/lib/cn";
import type { PendingAction } from "@/lib/domains/today/types";

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
  /** 가상 플랜 여부 (true이면 시작 버튼 비활성화) */
  isVirtual?: boolean;
};

const pendingMessages: Record<PendingAction, string> = {
  start: "학습 중...",
  resume: "학습 중...",
  pause: "일시정지 중...",
  complete: "완료 처리 중...",
};

export function TimerControls({
  status,
  isLoading,
  pendingAction,
  onStart,
  onPause,
  onResume,
  onComplete,
  onPostpone,
  canPostpone = false,
  compact = false,
  className,
  isVirtual = false,
}: TimerControlsProps) {
  const currentPendingMessage =
    isLoading && pendingAction ? pendingMessages[pendingAction] : null;

  // 모바일 터치 친화적 버튼 크기 (최소 44px 높이)
  const buttonSize = compact ? "text-sm px-3 py-2 min-h-[36px]" : "text-sm px-4 py-3 min-h-[44px]";
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
            disabled={isLoading || isVirtual}
            title={isVirtual ? "콘텐츠가 연결되지 않은 플랜입니다. 먼저 콘텐츠를 연결해주세요." : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg font-bold text-white shadow-sm transition disabled:opacity-50 active:scale-[0.98]",
              isVirtual
                ? "bg-amber-500 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-md",
              buttonSize
            )}
          >
            {isLoading && pendingAction === "start" ? (
              <Loader2 className={cn("animate-spin", iconSize)} />
            ) : (
              <Play className={iconSize} />
            )}
            {isVirtual ? "콘텐츠 연결 필요" : "시작하기"}
          </button>
        )}

        {status === "RUNNING" && (
          <>
            <button
              onClick={onPause}
              disabled={isLoading}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 font-bold text-white shadow-sm transition hover:bg-yellow-700 hover:shadow-md disabled:opacity-50 active:scale-[0.98]",
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
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 font-bold text-white shadow-md transition hover:from-green-700 hover:to-green-800 hover:shadow-lg disabled:opacity-50 active:scale-[0.98]",
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
                "flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 font-bold text-white shadow-md transition hover:from-green-700 hover:to-green-800 hover:shadow-lg disabled:opacity-50 active:scale-[0.98]",
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

