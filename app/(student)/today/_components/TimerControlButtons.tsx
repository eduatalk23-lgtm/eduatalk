"use client";

import { memo } from "react";
import { Play, Pause, Square, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";

type TimerControlButtonsProps = {
  planId: string;
  isActive: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  isLoading?: boolean;
  hasOtherActivePlan?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  className?: string;
  campMode?: boolean; // 캠프 모드 여부
};

function TimerControlButtonsComponent({
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
  campMode = false,
}: TimerControlButtonsProps) {
  const router = useRouter();

  const handleComplete = () => {
    if (!confirm("지금까지의 학습을 기준으로 이 플랜을 완료 입력 화면으로 이동할까요?")) {
      return;
    }
    onComplete();
  };

  if (isCompleted) {
    return (
      <button
        onClick={() => router.push(buildPlanExecutionUrl(planId, campMode))}
        aria-label="완료한 플랜 상세보기"
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 ${
          className || ""
        }`}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        상세보기
      </button>
    );
  }

  if (!isActive && !isPaused) {
    return (
      <button
        onClick={onStart}
        disabled={isLoading || hasOtherActivePlan}
        aria-label="학습 시작하기"
        aria-disabled={isLoading || hasOtherActivePlan}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 ${
          className || ""
        }`}
        title={hasOtherActivePlan ? "다른 플랜의 타이머가 실행 중입니다. 먼저 해당 플랜의 타이머를 중지해주세요." : ""}
      >
        <Play className="h-4 w-4" aria-hidden="true" />
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
          aria-label="학습 일시정지"
          aria-pressed={false}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50"
        >
          <Pause className="h-4 w-4" aria-hidden="true" />
          일시정지
        </button>
        <button
          onClick={handleComplete}
          disabled={isLoading}
          aria-label="학습 완료하기"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          <Square className="h-4 w-4" aria-hidden="true" />
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
          aria-label="학습 재개하기"
          aria-pressed={true}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          재개
        </button>
        <button
          onClick={handleComplete}
          disabled={isLoading}
          aria-label="학습 완료하기"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          <Square className="h-4 w-4" aria-hidden="true" />
          완료하기
        </button>
      </div>
    );
  }

  return null;
}

export const TimerControlButtons = memo(TimerControlButtonsComponent, (prevProps, nextProps) => {
  // 핵심 props만 비교하여 불필요한 리렌더링 방지
  // 함수 props는 참조 동일성으로 비교 (useCallback으로 메모이제이션 필요)
  return (
    prevProps.planId === nextProps.planId &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPaused === nextProps.isPaused &&
    prevProps.isCompleted === nextProps.isCompleted &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.hasOtherActivePlan === nextProps.hasOtherActivePlan &&
    prevProps.campMode === nextProps.campMode &&
    prevProps.className === nextProps.className &&
    // 함수 props는 참조 동일성으로 비교 (부모에서 useCallback 사용 필요)
    prevProps.onStart === nextProps.onStart &&
    prevProps.onPause === nextProps.onPause &&
    prevProps.onResume === nextProps.onResume &&
    prevProps.onComplete === nextProps.onComplete
  );
});

