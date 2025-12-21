"use client";

import { useState, useMemo, memo } from "react";
import { startPlan, pausePlan, resumePlan, preparePlanCompletion } from "../actions/todayActions";
import { useRouter } from "next/navigation";
import { formatTime, formatTimestamp } from "../_utils/planGroupUtils";
import { usePlanTimer } from "@/lib/hooks/usePlanTimer";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { TimerDisplay } from "./timer/TimerDisplay";
import { TimerControls } from "./timer/TimerControls";
import { useToast } from "@/components/ui/ToastProvider";
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";
import { calculateTimerState } from "@/lib/utils/timerStateCalculator";

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

function PlanTimerCardComponent({
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
  const { showError, showSuccess } = useToast();
  const timerStore = usePlanTimerStore();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // 서버에서 계산된 초기 타이머 상태 계산 (유틸 함수 사용)
  const timerState = useMemo(() => {
    return calculateTimerState({
      actualStartTime: actualStartTime ?? null,
      actualEndTime: actualEndTime ?? null,
      totalDurationSeconds: totalDurationSeconds ?? null,
      pausedDurationSeconds: pausedDurationSeconds ?? null,
      isPaused: initialIsPaused,
      currentPausedAt: currentPausedAt ?? null,
      sessionStartedAt: sessionStartedAt ?? null,
      sessionPausedDurationSeconds: sessionPausedDurationSeconds ?? null,
    });
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
      console.error("[PlanTimerCard] 시작 오류:", error);
      showError("오류가 발생했습니다.");
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
      console.error("[PlanTimerCard] 일시정지 오류:", error);
      showError("오류가 발생했습니다.");
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
      console.error("[PlanTimerCard] 재개 오류:", error);
      showError("오류가 발생했습니다.");
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

      // 완료 입력 페이지로 이동
      router.push(buildPlanExecutionUrl(planId, campMode));
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
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-gray-900">{planTitle}</h3>
          <p className="text-xs text-gray-500">
            이 블록은 같은 플랜 번호의 대표 타이머 카드에서 제어됩니다.
          </p>
        </div>
        <button
          onClick={() => router.push(buildPlanExecutionUrl(planId, campMode))}
          className="w-full rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          상세보기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-gray-900">{planTitle}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
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
        <div className="flex flex-col gap-2">
          <TimerDisplay
            seconds={seconds}
            status={timerStatus}
            subtitle="학습 시간"
            showStatusBadge={true}
            compact={true}
          />
          {pauseCount != null && pauseCount > 0 && (
            <div className="text-xs text-gray-500">
              일시정지: {pauseCount}회
              {pausedDurationSeconds != null && pausedDurationSeconds > 0 && (
                <span> ({formatTime(pausedDurationSeconds)})</span>
              )}
            </div>
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
          onClick={() => router.push(buildPlanExecutionUrl(planId, campMode))}
          className="w-full rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
        >
          상세보기
        </button>
      )}
    </div>
  );
}

// React.memo로 불필요한 리렌더링 방지
export const PlanTimerCard = memo(PlanTimerCardComponent, (prevProps, nextProps) => {
  // 핵심 props만 비교하여 불필요한 리렌더링 방지
  return (
    prevProps.planId === nextProps.planId &&
    prevProps.planTitle === nextProps.planTitle &&
    prevProps.contentType === nextProps.contentType &&
    prevProps.actualStartTime === nextProps.actualStartTime &&
    prevProps.actualEndTime === nextProps.actualEndTime &&
    prevProps.totalDurationSeconds === nextProps.totalDurationSeconds &&
    prevProps.pausedDurationSeconds === nextProps.pausedDurationSeconds &&
    prevProps.pauseCount === nextProps.pauseCount &&
    prevProps.isPaused === nextProps.isPaused &&
    prevProps.currentPausedAt === nextProps.currentPausedAt &&
    prevProps.allowTimerControl === nextProps.allowTimerControl &&
    prevProps.sessionStartedAt === nextProps.sessionStartedAt &&
    prevProps.sessionPausedDurationSeconds === nextProps.sessionPausedDurationSeconds &&
    prevProps.serverNow === nextProps.serverNow &&
    prevProps.campMode === nextProps.campMode
  );
});
