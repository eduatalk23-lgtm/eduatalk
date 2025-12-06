"use client";

import { useState, useMemo } from "react";
import { startPlan, pausePlan, resumePlan, preparePlanCompletion } from "../actions/todayActions";
import { useRouter } from "next/navigation";
import { formatTime, formatTimestamp } from "../_utils/planGroupUtils";
import { usePlanTimer } from "@/lib/hooks/usePlanTimer";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { TimerDisplay } from "./timer/TimerDisplay";
import { TimerControls } from "./timer/TimerControls";
import { useToast } from "@/components/ui/ToastProvider";

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
  currentPausedAt?: string | null;
  allowTimerControl?: boolean;
  sessionStartedAt?: string | null;
  sessionPausedDurationSeconds?: number | null;
  serverNow?: number;
  campMode?: boolean; // 캠프 모드 여부
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
  serverNow = Date.now(),
  campMode = false,
}: PlanTimerCardProps) {
  const router = useRouter();
  const { showError } = useToast();
  const timerStore = usePlanTimerStore();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // 서버에서 계산된 초기 타이머 상태 계산
  const timerState = useMemo(() => {
    // 완료된 경우
    if (actualEndTime && totalDurationSeconds !== null && totalDurationSeconds !== undefined) {
      return {
        status: "COMPLETED" as TimerStatus,
        accumulatedSeconds: totalDurationSeconds,
        startedAt: null,
      };
    }

    // 시작하지 않은 경우
    if (!actualStartTime) {
      return {
        status: "NOT_STARTED" as TimerStatus,
        accumulatedSeconds: 0,
        startedAt: null,
      };
    }

    const startMs = new Date(actualStartTime).getTime();
    if (!Number.isFinite(startMs)) {
      return {
        status: "NOT_STARTED" as TimerStatus,
        accumulatedSeconds: 0,
        startedAt: null,
      };
    }

    const now = Date.now();

    // 일시정지 중인 경우
    if (initialIsPaused && currentPausedAt) {
      const pausedAtMs = new Date(currentPausedAt).getTime();
      if (Number.isFinite(pausedAtMs)) {
        const elapsedUntilPause = Math.floor((pausedAtMs - startMs) / 1000);
        const sessionPausedDuration = sessionPausedDurationSeconds || 0;
        const planPausedDuration = pausedDurationSeconds || 0;
        const accumulatedSeconds = Math.max(0, elapsedUntilPause - sessionPausedDuration - planPausedDuration);

        return {
          status: "PAUSED" as TimerStatus,
          accumulatedSeconds,
          startedAt: null,
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
          status: "RUNNING" as TimerStatus,
          accumulatedSeconds,
          startedAt: sessionStartedAt,
        };
      }
    }

    // 활성 세션이 없지만 플랜이 시작된 경우
    const elapsed = Math.floor((now - startMs) / 1000);
    const pausedDuration = pausedDurationSeconds || 0;
    const accumulatedSeconds = Math.max(0, elapsed - pausedDuration);

    return {
      status: "RUNNING" as TimerStatus,
      accumulatedSeconds,
      startedAt: actualStartTime,
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

  // 새로운 스토어 기반 타이머 훅 사용
  const { seconds, status: timerStatus } = usePlanTimer({
    planId,
    status: timerState.status,
    accumulatedSeconds: timerState.accumulatedSeconds,
    startedAt: timerState.startedAt,
    serverNow,
    isCompleted: !!actualEndTime,
  });

  const formattedStartTime = actualStartTime ? formatTimestamp(actualStartTime) : "-";
  const formattedEndTime = actualEndTime ? formatTimestamp(actualEndTime) : "-";
  const formattedPureStudyTime = formatTime(Math.max(0, seconds));

  const handleStart = async () => {
    setIsLoading(true);
    setPendingAction("start");
    try {
      const timestamp = new Date().toISOString();
      const result = await startPlan(planId, timestamp);
      if (result.success) {
        if (result.serverNow && result.status && result.startedAt) {
          timerStore.startTimer(planId, result.serverNow, result.startedAt);
        }
      } else {
        showError(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (isLoading || timerStatus === "PAUSED") {
      return;
    }

    setIsLoading(true);
    setPendingAction("pause");
    try {
      const timestamp = new Date().toISOString();
      const result = await pausePlan(planId, timestamp);
      if (result.success) {
        if (result.serverNow && result.accumulatedSeconds !== undefined) {
          timerStore.pauseTimer(planId, result.accumulatedSeconds);
        }
      } else {
        if (result.error && !result.error.includes("이미 일시정지된 상태입니다")) {
          showError(result.error || "플랜 일시정지에 실패했습니다.");
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
      const timestamp = new Date().toISOString();
      const result = await resumePlan(planId, timestamp);
      if (result.success) {
        if (result.serverNow && result.status && result.startedAt) {
          timerStore.startTimer(planId, result.serverNow, result.startedAt);
        }
      } else {
        showError(result.error || "플랜 재개에 실패했습니다.");
      }
    } catch (error) {
      alert("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    // 확인 다이얼로그
    const confirmed = confirm(
      "지금까지의 학습을 기준으로 이 플랜을 완료 입력 화면으로 이동할까요?"
    );
    
    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setPendingAction("complete");
    try {
      const result = await preparePlanCompletion(planId);
      
      if (!result.success) {
        showError(result.error || "플랜 완료 준비에 실패했습니다.");
        return;
      }

      // 타이머 정지 (스토어에서 제거)
      timerStore.removeTimer(planId);
      
      // 완료 입력 페이지로 이동 (campMode에 따라 쿼리 파라미터 추가)
      const query = campMode ? "?mode=camp" : "";
      router.push(`/today/plan/${planId}${query}`);
    } catch (error) {
      console.error("[PlanTimerCard] 완료 처리 오류:", error);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const isCompleted = !!actualEndTime;
  const showCompletionMeta = isCompleted && actualStartTime && actualEndTime;
  const showTimer = timerStatus === "RUNNING" || timerStatus === "PAUSED" || timerStatus === "COMPLETED";

  if (!allowTimerControl && timerStatus === "NOT_STARTED") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900">{planTitle}</h3>
          <p className="mt-1 text-xs text-gray-500">
            이 블록은 같은 플랜 번호의 대표 타이머 카드에서 제어됩니다.
          </p>
        </div>
        <button
          onClick={() => {
            const query = campMode ? "?mode=camp" : "";
            router.push(`/today/plan/${planId}${query}`);
          }}
          className="w-full rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          상세보기
        </button>
      </div>
    );
  }

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
        <div className="mb-3">
          <TimerDisplay
            seconds={seconds}
            status={timerStatus}
            subtitle="학습 시간"
            showStatusBadge={true}
            compact={true}
          />
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

      <TimerControls
        status={timerStatus}
        isLoading={isLoading}
        pendingAction={pendingAction}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onComplete={handleComplete}
        compact={true}
      />

      {isCompleted && (
        <button
          onClick={() => router.push(`/today/plan/${planId}`)}
          className="mt-2 w-full rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          상세보기
        </button>
      )}
    </div>
  );
}
