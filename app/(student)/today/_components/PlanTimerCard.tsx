"use client";

import { useState } from "react";
import { Play, Pause, Square, Clock } from "lucide-react";
import { startPlan, pausePlan, resumePlan, completePlan } from "../actions/todayActions";
import { useRouter } from "next/navigation";
import { formatTime, calculateStudyTimeFromTimestamps } from "../_utils/planGroupUtils";

type PlanTimerCardProps = {
  planId: string;
  planTitle: string;
  contentType: "book" | "lecture" | "custom";
  startTime?: string | null;
  endTime?: string | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  totalDurationSeconds?: number | null;
  pausedDurationSeconds?: number | null;
  pauseCount?: number | null;
  activeSessionId?: string | null;
  isPaused?: boolean;
};

export function PlanTimerCard({
  planId,
  planTitle,
  contentType,
  startTime,
  endTime,
  actualStartTime,
  actualEndTime,
  totalDurationSeconds,
  pausedDurationSeconds,
  pauseCount,
  activeSessionId,
  isPaused: initialIsPaused = false,
}: PlanTimerCardProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(!!actualStartTime && !actualEndTime && !initialIsPaused);
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [isLoading, setIsLoading] = useState(false);

  // 타임스탬프 기반 시간 계산 (실시간 업데이트 제거)
  const elapsedSeconds = calculateStudyTimeFromTimestamps(
    actualStartTime,
    actualEndTime,
    pausedDurationSeconds
  );


  const handleStart = async () => {
    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await startPlan(planId, timestamp);
      if (result.success) {
        setIsRunning(true);
        setIsPaused(false);
        router.refresh();
      } else {
        alert(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    // 이미 로딩 중이거나 일시정지된 상태면 중복 호출 방지
    if (isLoading || isPaused) {
      return;
    }

    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await pausePlan(planId, timestamp);
      if (result.success) {
        setIsPaused(true);
        setIsRunning(false);
        router.refresh();
      } else {
        // "이미 일시정지된 상태입니다" 에러는 무시 (중복 호출 방지)
        if (result.error && !result.error.includes("이미 일시정지된 상태입니다")) {
          alert(result.error || "플랜 일시정지에 실패했습니다.");
        }
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await resumePlan(planId, timestamp);
      if (result.success) {
        setIsPaused(false);
        setIsRunning(true);
        router.refresh();
      } else {
        alert(result.error || "플랜 재개에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm("플랜을 완료하시겠습니까?")) {
      return;
    }

    setIsLoading(true);
    try {
      // 완료 페이지로 이동 (실제 완료는 완료 페이지에서 처리)
      router.push(`/today/plan/${planId}`);
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const isCompleted = !!actualEndTime;
  const showTimer = isRunning || isPaused || isCompleted;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900">{planTitle}</h3>
        <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
          <span className="text-xs">
            {contentType === "book" ? "📚" : contentType === "lecture" ? "🎧" : "📝"}
          </span>
          {startTime && endTime && (
            <span>
              {startTime} ~ {endTime}
            </span>
          )}
        </div>
      </div>

      {showTimer && (
        <div className="mb-3 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">학습 시간</span>
            </div>
            <div className="text-lg font-bold text-indigo-600">
              {formatTime(elapsedSeconds)}
            </div>
          </div>
          {pauseCount !== null && pauseCount > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              일시정지: {pauseCount}회
              {pausedDurationSeconds !== null && pausedDurationSeconds > 0 && (
                <span> ({formatTime(pausedDurationSeconds)})</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {!isRunning && !isPaused && !isCompleted && (
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            시작하기
          </button>
        )}

        {isRunning && !isPaused && (
          <>
            <button
              onClick={handlePause}
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
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={handleResume}
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              다시시작
            </button>
            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              완료하기
            </button>
          </>
        )}

        {isCompleted && (
          <button
            onClick={() => router.push(`/today/plan/${planId}`)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            상세보기
          </button>
        )}
      </div>
    </div>
  );
}

