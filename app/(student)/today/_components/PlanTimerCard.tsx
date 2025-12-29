"use client";

import { useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { formatTime, formatTimestamp } from "../_utils/planGroupUtils";
import { usePlanTimer } from "@/lib/hooks/usePlanTimer";
import { usePlanCardActions } from "@/lib/hooks/usePlanCardActions";
import { TimerDisplay } from "./timer/TimerDisplay";
import { TimerControls } from "./timer/TimerControls";
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";
import type { PlanGroup } from "../_utils/planGroupUtils";

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
  campMode?: boolean;
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
  isPaused: initialIsPaused = false,
  currentPausedAt,
  allowTimerControl = true,
  sessionStartedAt,
  sessionPausedDurationSeconds,
  serverNow = Date.now(),
  campMode = false,
}: PlanTimerCardProps) {
  const router = useRouter();

  // 플랜 핵심 상태 (변경 빈도 낮음)
  const planCore = useMemo(
    () => ({
      id: planId,
      contentType,
      title: planTitle,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
    }),
    [planId, contentType, planTitle, startTime, endTime]
  );

  // 진행 상태 (타이머 동작 시 변경)
  const progressState = useMemo(
    () => ({
      actualStartTime: actualStartTime ?? null,
      actualEndTime: actualEndTime ?? null,
      totalDurationSeconds: totalDurationSeconds ?? null,
      pausedDurationSeconds: pausedDurationSeconds ?? null,
    }),
    [actualStartTime, actualEndTime, totalDurationSeconds, pausedDurationSeconds]
  );

  // 세션 상태 (실시간 변경)
  const sessionState = useMemo(
    () => ({
      isPaused: initialIsPaused,
      startedAt: sessionStartedAt ?? null,
      pausedAt: currentPausedAt ?? null,
      pausedDurationSeconds: sessionPausedDurationSeconds ?? null,
    }),
    [initialIsPaused, sessionStartedAt, currentPausedAt, sessionPausedDurationSeconds]
  );

  // PlanTimerCard props를 PlanGroup/sessions 형태로 변환
  const { group, sessions } = useMemo(() => {
    // 최소한의 plan 객체 생성
    const minimalPlan = {
      id: planCore.id,
      content_type: planCore.contentType,
      actual_start_time: progressState.actualStartTime,
      actual_end_time: progressState.actualEndTime,
      total_duration_seconds: progressState.totalDurationSeconds,
      paused_duration_seconds: progressState.pausedDurationSeconds,
      is_reschedulable: false, // PlanTimerCard는 연기 기능 없음
      // 필수 필드 추가 (사용되지 않지만 타입 호환성을 위해)
      plan_date: "",
      content_id: "",
      chapter: null,
      planned_start_page_or_time: null,
      planned_end_page_or_time: null,
      start_time: planCore.startTime,
      end_time: planCore.endTime,
      sequence: null,
      block_index: null,
      plan_number: null,
      progress: null,
    };

    const minimalGroup: PlanGroup = {
      planNumber: null,
      plan: minimalPlan as unknown as PlanGroup["plan"],
      content: { title: planCore.title } as unknown as PlanGroup["content"],
      sequence: null,
    };

    const sessionsMap = new Map<
      string,
      {
        isPaused: boolean;
        startedAt?: string | null;
        pausedAt?: string | null;
        resumedAt?: string | null;
        pausedDurationSeconds?: number | null;
      }
    >();

    if (progressState.actualStartTime && !progressState.actualEndTime) {
      sessionsMap.set(planCore.id, {
        isPaused: sessionState.isPaused,
        startedAt: sessionState.startedAt,
        pausedAt: sessionState.pausedAt,
        resumedAt: null,
        pausedDurationSeconds: sessionState.pausedDurationSeconds,
      });
    }

    return { group: minimalGroup, sessions: sessionsMap };
  }, [planCore, progressState, sessionState]);

  // Hook으로 추출된 타이머 액션 및 상태
  const {
    isLoading,
    pendingAction,
    timerState,
    handleStart,
    handlePause,
    handleResume,
    handleComplete,
  } = usePlanCardActions({ group, sessions, campMode });

  // 스토어 기반 타이머 훅 사용
  const { seconds, status: timerStatus, syncState } = usePlanTimer({
    planId,
    status: timerState.status,
    accumulatedSeconds: timerState.accumulatedSeconds,
    startedAt: timerState.startedAt,
    serverNow,
    isCompleted: !!actualEndTime,
  });

  const formattedStartTime = actualStartTime
    ? formatTimestamp(actualStartTime)
    : "-";
  const formattedEndTime = actualEndTime
    ? formatTimestamp(actualEndTime)
    : "-";
  const formattedPureStudyTime = formatTime(Math.max(0, seconds));

  const isCompleted = !!actualEndTime;
  const showCompletionMeta = isCompleted && actualStartTime && actualEndTime;
  const showTimer =
    timerStatus === "RUNNING" ||
    timerStatus === "PAUSED" ||
    timerStatus === "COMPLETED";

  if (!allowTimerControl && timerStatus === "NOT_STARTED") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {planTitle}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
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
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {planTitle}
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="text-xs">
            {contentType === "book"
              ? "📚"
              : contentType === "lecture"
              ? "🎧"
              : "📝"}
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
          <div className="relative">
            <TimerDisplay
              seconds={seconds}
              status={timerStatus}
              subtitle="학습 시간"
              showStatusBadge={true}
              compact={true}
            />
            {/* 동기화 상태 배지 */}
            {syncState !== "idle" && timerStatus === "RUNNING" && (
              <span
                className={`absolute -right-1 -top-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  syncState === "syncing"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : syncState === "synced"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                }`}
              >
                {syncState === "syncing" && (
                  <>
                    <span className="h-2 w-2 animate-spin rounded-full border border-blue-500 border-t-transparent" />
                    동기화
                  </>
                )}
                {syncState === "synced" && (
                  <>
                    <span className="text-green-500">✓</span>
                    저장됨
                  </>
                )}
                {syncState === "error" && (
                  <>
                    <span className="text-red-500">!</span>
                    오프라인
                  </>
                )}
              </span>
            )}
          </div>
          {pauseCount != null && pauseCount > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              일시정지: {pauseCount}회
              {pausedDurationSeconds != null && pausedDurationSeconds > 0 && (
                <span> ({formatTime(pausedDurationSeconds)})</span>
              )}
            </div>
          )}
        </div>
      )}

      {showCompletionMeta && (
        <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">
          <div className="font-semibold text-indigo-950 dark:text-indigo-100">
            학습 완료 기록
          </div>
          <dl className="grid grid-cols-[92px,1fr] gap-1">
            <dt className="text-indigo-700 dark:text-indigo-300">시작 시간</dt>
            <dd className="text-right font-medium">{formattedStartTime}</dd>
            <dt className="text-indigo-700 dark:text-indigo-300">종료 시간</dt>
            <dd className="text-right font-medium">{formattedEndTime}</dd>
            <dt className="text-indigo-700 dark:text-indigo-300">총 학습</dt>
            <dd className="text-right font-semibold text-indigo-950 dark:text-indigo-100">
              {formattedPureStudyTime}
            </dd>
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

export const PlanTimerCard = memo(
  PlanTimerCardComponent,
  (prevProps, nextProps) => {
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
      prevProps.sessionPausedDurationSeconds ===
        nextProps.sessionPausedDurationSeconds &&
      prevProps.serverNow === nextProps.serverNow &&
      prevProps.campMode === nextProps.campMode
    );
  }
);
