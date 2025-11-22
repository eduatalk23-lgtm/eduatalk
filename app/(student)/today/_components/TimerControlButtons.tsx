"use client";

import { Play, Pause, Square, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

type TimerControlButtonsProps = {
  planId: string;
  isActive: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  isLoading?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  className?: string;
};

export function TimerControlButtons({
  planId,
  isActive,
  isPaused,
  isCompleted,
  isLoading = false,
  hasOtherActivePlan = false,
  onStart,
  onPause,
  onResume,
  onComplete,
  className,
}: TimerControlButtonsProps) {
  const router = useRouter();

  const handleComplete = () => {
    if (!confirm("플랜을 완료하시겠습니까?")) {
      return;
    }
    onComplete();
  };

  if (isCompleted) {
    return (
      <button
        onClick={() => router.push(`/today/plan/${planId}`)}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 ${
          className || ""
        }`}
      >
        <FileText className="h-4 w-4" />
        상세보기
      </button>
    );
  }

  if (!isActive && !isPaused) {
    return (
      <button
        onClick={onStart}
        disabled={isLoading || hasOtherActivePlan}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 ${
          className || ""
        }`}
        title={hasOtherActivePlan ? "다른 플랜의 타이머가 실행 중입니다. 먼저 해당 플랜의 타이머를 중지해주세요." : ""}
      >
        <Play className="h-4 w-4" />
        시작하기
      </button>
    );
  }

  if (isActive && !isPaused) {
    return (
      <div className={`flex gap-2 ${className || ""}`}>
        <button
          onClick={onPause}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50"
        >
          <Pause className="h-4 w-4" />
          일시정지
        </button>
        <button
          onClick={handleComplete}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          <Square className="h-4 w-4" />
          완료하기
        </button>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className={`flex gap-2 ${className || ""}`}>
        <button
          onClick={onResume}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          재개
        </button>
        <button
          onClick={handleComplete}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          <Square className="h-4 w-4" />
          완료하기
        </button>
      </div>
    );
  }

  return null;
}

