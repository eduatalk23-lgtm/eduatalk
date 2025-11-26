"use client";

import { Play, Pause, Square } from "lucide-react";
import { cn } from "@/lib/cn";

type MobileActionBarProps = {
  isVisible: boolean;
  isActive: boolean;
  isPaused: boolean;
  planTitle?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  isLoading?: boolean;
};

export function MobileActionBar({
  isVisible,
  isActive,
  isPaused,
  planTitle = "학습 플랜",
  onStart,
  onPause,
  onResume,
  onComplete,
  isLoading = false,
}: MobileActionBarProps) {
  if (!isVisible) {
    return null;
  }

  const handleComplete = () => {
    if (!confirm("플랜을 완료하시겠습니까?")) {
      return;
    }
    onComplete();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg md:hidden">
      <div className="flex flex-col gap-3">
        {(isActive || isPaused) && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">진행 중</span>
              <span className="text-sm font-semibold text-gray-900 line-clamp-1">
                {planTitle}
              </span>
            </div>
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isPaused ? "bg-yellow-500" : "bg-green-500 animate-pulse"
              )}
              aria-label={isPaused ? "일시정지 상태" : "학습 진행 중"}
            />
          </div>
        )}

        <div className="flex gap-2">
          {!isActive && !isPaused && (
            <button
              onClick={onStart}
              disabled={isLoading}
              aria-label="학습 시작하기"
              className="flex flex-1 min-h-[48px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play className="h-5 w-5" aria-hidden="true" />
              시작하기
            </button>
          )}

          {isActive && !isPaused && (
            <>
              <button
                onClick={onPause}
                disabled={isLoading}
                aria-label="학습 일시정지"
                className="flex flex-1 min-h-[48px] items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50"
              >
                <Pause className="h-5 w-5" aria-hidden="true" />
                일시정지
              </button>
              <button
                onClick={handleComplete}
                disabled={isLoading}
                aria-label="학습 완료하기"
                className="flex flex-1 min-h-[48px] items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                <Square className="h-5 w-5" aria-hidden="true" />
                완료
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={onResume}
                disabled={isLoading}
                aria-label="학습 재개하기"
                className="flex flex-1 min-h-[48px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                재개
              </button>
              <button
                onClick={handleComplete}
                disabled={isLoading}
                aria-label="학습 완료하기"
                className="flex flex-1 min-h-[48px] items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                <Square className="h-5 w-5" aria-hidden="true" />
                완료
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

