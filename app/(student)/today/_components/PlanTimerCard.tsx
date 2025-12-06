"use client";

import { useState, useMemo } from "react";
import { Play, Pause, Square, Clock } from "lucide-react";
import { startPlan, pausePlan, resumePlan } from "../actions/todayActions";
import { useRouter } from "next/navigation";
import { formatTime, formatTimestamp } from "../_utils/planGroupUtils";
import { usePlanTimer } from "@/lib/hooks/usePlanTimer";

type PendingAction = "start" | "pause" | "resume" | "complete" | null;

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
  currentPausedAt?: string | null; // 현재 일시정지 시작 시간
  allowTimerControl?: boolean;
  // 세션 정보 (타이머 초기값 계산용)
  sessionStartedAt?: string | null;
  sessionPausedDurationSeconds?: number | null;
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
  currentPausedAt,
  allowTimerControl = true,
  sessionStartedAt,
  sessionPausedDurationSeconds,
}: PlanTimerCardProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(!!actualStartTime && !actualEndTime && !initialIsPaused);
  const [isPaused, setIsPaused] = useState(initialIsPaused);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // 서버에서 계산된 초기 타이머 상태 계산
  const initialTimerState = useMemo(() => {
    // 완료된 경우
    if (actualEndTime && totalDurationSeconds !== null && totalDurationSeconds !== undefined) {
      return {
        initialDuration: totalDurationSeconds,
        isInitiallyRunning: false,
      };
    }

    // 시작하지 않은 경우
    if (!actualStartTime) {
      return {
        initialDuration: 0,
        isInitiallyRunning: false,
      };
    }

    const startMs = new Date(actualStartTime).getTime();
    if (!Number.isFinite(startMs)) {
      return {
        initialDuration: 0,
        isInitiallyRunning: false,
      };
    }

    const now = Date.now();

    // 일시정지 중인 경우
    if (initialIsPaused && currentPausedAt) {
      const pausedAtMs = new Date(currentPausedAt).getTime();
      if (Number.isFinite(pausedAtMs)) {
        // 일시정지 시점까지의 경과 시간 계산
        const elapsedUntilPause = Math.floor((pausedAtMs - startMs) / 1000);
        const sessionPausedDuration = sessionPausedDurationSeconds || 0;
        const planPausedDuration = pausedDurationSeconds || 0;
        const accumulatedSeconds = Math.max(0, elapsedUntilPause - sessionPausedDuration - planPausedDuration);

        return {
          initialDuration: accumulatedSeconds,
          isInitiallyRunning: false,
        };
      }
    }

    // 실행 중인 경우
    if (sessionStartedAt) {
      const sessionStartMs = new Date(sessionStartedAt).getTime();
      if (Number.isFinite(sessionStartMs)) {
        const elapsed = Math.floor((now - sessionStartMs) / 1000);
        const sessionPausedDuration = sessionPausedDurationSeconds || 0;
        const planPausedDuration = pausedDurationSeconds || 0;
        const accumulatedSeconds = Math.max(0, elapsed - sessionPausedDuration - planPausedDuration);

        return {
          initialDuration: accumulatedSeconds,
          isInitiallyRunning: true,
        };
      }
    }

    // 활성 세션이 없지만 플랜이 시작된 경우
    const elapsed = Math.floor((now - startMs) / 1000);
    const pausedDuration = pausedDurationSeconds || 0;
    const accumulatedSeconds = Math.max(0, elapsed - pausedDuration);

    return {
      initialDuration: accumulatedSeconds,
      isInitiallyRunning: true,
    };
  }, [
    actualStartTime,
    actualEndTime,
    totalDurationSeconds,
    pausedDurationSeconds,
    initialIsPaused,
    currentPausedAt,
    sessionStartedAt,
    sessionPausedDurationSeconds,
  ]);

  // 타이머 훅 사용
  const { seconds: elapsedSeconds } = usePlanTimer({
    initialDuration: initialTimerState.initialDuration,
    isInitiallyRunning: initialTimerState.isInitiallyRunning,
    isPaused: initialIsPaused,
    isCompleted: !!actualEndTime,
  });

  // 완료된 학습 시간 계산 (표시용)
  const completedStudySeconds = useMemo(() => {
    if (actualEndTime && totalDurationSeconds !== null && totalDurationSeconds !== undefined) {
      return totalDurationSeconds;
    }
    return elapsedSeconds;
  }, [actualEndTime, totalDurationSeconds, elapsedSeconds]);

  const formattedStartTime = actualStartTime ? formatTimestamp(actualStartTime) : "-";
  const formattedEndTime = actualEndTime ? formatTimestamp(actualEndTime) : "-";
  const formattedPureStudyTime = formatTime(Math.max(0, completedStudySeconds));


  const handleStart = async () => {
    setIsLoading(true);
    setPendingAction("start");
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await startPlan(planId, timestamp);
      if (result.success) {
        setIsRunning(true);
        setIsPaused(false);
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
      } else {
        alert(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    // 이미 로딩 중이거나 일시정지된 상태면 중복 호출 방지
    if (isLoading || isPaused) {
      return;
    }

    setIsLoading(true);
    setPendingAction("pause");
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await pausePlan(planId, timestamp);
      if (result.success) {
        setIsPaused(true);
        setIsRunning(false);
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
      } else {
        // "이미 일시정지된 상태입니다" 에러는 무시 (중복 호출 방지)
        if (result.error && !result.error.includes("이미 일시정지된 상태입니다")) {
          alert(result.error || "플랜 일시정지에 실패했습니다.");
        }
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    setPendingAction("resume");
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await resumePlan(planId, timestamp);
      if (result.success) {
        setIsPaused(false);
        setIsRunning(true);
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
      } else {
        alert(result.error || "플랜 재개에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm("플랜을 완료하시겠습니까?")) {
      return;
    }

    setIsLoading(true);
    setPendingAction("complete");
    try {
      // 완료 페이지로 이동 (실제 완료는 완료 페이지에서 처리)
      router.push(`/today/plan/${planId}`);
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const isCompleted = !!actualEndTime;
  const showCompletionMeta = isCompleted && actualStartTime && actualEndTime;
  const showTimer = isRunning || isPaused || isCompleted;

  if (!allowTimerControl && !isRunning && !isPaused && !isCompleted) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900">{planTitle}</h3>
          <p className="mt-1 text-xs text-gray-500">
            이 블록은 같은 플랜 번호의 대표 타이머 카드에서 제어됩니다.
          </p>
        </div>
        <button
          onClick={() => router.push(`/today/plan/${planId}`)}
          className="w-full rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          상세보기
        </button>
      </div>
    );
  }

  const pendingMessages: Record<Exclude<PendingAction, null>, string> = {
    start: "학습 중...",
    resume: "학습 중...",
    pause: "일시정지 중...",
    complete: "완료 처리 중...",
  };
  const currentPendingMessage =
    isLoading && pendingAction ? pendingMessages[pendingAction as Exclude<PendingAction, null>] : null;

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
            <div className="text-lg font-bold text-indigo-600">{formatTime(elapsedSeconds)}</div>
          </div>
          {currentPendingMessage && (
            <div className="mt-2 text-xs font-semibold text-indigo-600">{currentPendingMessage}</div>
          )}
          {pauseCount != null && pauseCount > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              일시정지: {pauseCount}회
              {pausedDurationSeconds != null && pausedDurationSeconds > 0 && (
                <span> ({formatTime(pausedDurationSeconds)})</span>
              )}
            </div>
          )}
        </div>
      )}

      {showCompletionMeta && (
        <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
          <div className="font-semibold text-indigo-950">학습 완료 기록</div>
          <dl className="mt-2 grid grid-cols-[92px,1fr] gap-1">
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

