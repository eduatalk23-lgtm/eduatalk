"use client";

import { formatTime, TimeStats, formatTimestamp } from "../_utils/planGroupUtils";
import { usePlanTimer } from "@/lib/hooks/usePlanTimer";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { TimerDisplay } from "./timer/TimerDisplay";
import { TimerControls } from "./timer/TimerControls";

type PendingAction = "start" | "pause" | "resume" | "complete" | null;

type PlanTimerProps = {
  planId: string;
  timeStats: TimeStats;
  isPaused: boolean;
  isActive: boolean;
  isLoading: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onPostpone?: () => void;
  canPostpone?: boolean;
  pendingAction?: PendingAction;
  compact?: boolean;
  status: TimerStatus;
  accumulatedSeconds: number;
  startedAt: string | null;
  serverNow: number;
};

export function PlanTimer({
  planId,
  timeStats,
  isLoading,
  onStart,
  onPause,
  onResume,
  onComplete,
  onPostpone,
  canPostpone = false,
  pendingAction = null,
  compact = false,
  status,
  accumulatedSeconds,
  startedAt,
  serverNow,
}: PlanTimerProps) {
  // 새로운 스토어 기반 타이머 훅 사용
  const { seconds, status: timerStatus } = usePlanTimer({
    planId,
    status,
    accumulatedSeconds,
    startedAt,
    serverNow,
    isCompleted: timeStats.isCompleted,
  });

  const formattedStartTime = timeStats.firstStartTime
    ? formatTimestamp(timeStats.firstStartTime)
    : "-";
  const formattedEndTime = timeStats.lastEndTime
    ? formatTimestamp(timeStats.lastEndTime)
    : "-";
  const formattedPureStudyTime = formatTime(Math.max(0, timeStats.pureStudyTime || 0));

  const isCompleted = timeStats.isCompleted;
  const showTimer = status === "RUNNING" || status === "PAUSED" || status === "COMPLETED";
  const showCompletionMeta = isCompleted && (timeStats.firstStartTime || timeStats.lastEndTime);

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {showTimer && (
          <TimerDisplay
            seconds={seconds}
            status={timerStatus}
            subtitle="학습 시간"
            showStatusBadge={true}
            compact={true}
          />
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
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onComplete={onComplete}
          onPostpone={onPostpone}
          canPostpone={canPostpone}
          compact={true}
        />

        {timeStats.pauseCount > 0 && showTimer && (
          <div className="text-xs text-gray-500">
            일시정지: {timeStats.pauseCount}회
            {timeStats.pausedDuration > 0 && <span> ({formatTime(timeStats.pausedDuration)})</span>}
          </div>
        )}
      </div>
    );
  }

  // 전체 뷰
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        {showTimer && (
          <TimerDisplay
            seconds={seconds}
            status={timerStatus}
            subtitle="학습 시간"
            showStatusBadge={true}
            compact={false}
          />
        )}

        {showCompletionMeta && (
          <div className="flex flex-col gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <h4 className="text-sm font-semibold text-indigo-900">학습 완료 기록</h4>
            <div className="grid gap-3 text-sm text-indigo-950 md:grid-cols-3">
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">시작 시간</span>
                <span className="text-sm font-semibold">{formattedStartTime}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">종료 시간</span>
                <span className="text-sm font-semibold">{formattedEndTime}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-md bg-white/60 p-3">
                <span className="text-xs text-indigo-600">총 학습 시간 (일시정지 제외)</span>
                <span className="text-lg font-bold text-indigo-900">{formattedPureStudyTime}</span>
              </div>
            </div>
          </div>
        )}

        {timeStats.pauseCount > 0 && showTimer && (
          <div className="text-xs text-gray-500">
            일시정지: {timeStats.pauseCount}회
            {timeStats.pausedDuration > 0 && <span> ({formatTime(timeStats.pausedDuration)})</span>}
          </div>
        )}

        <TimerControls
          status={timerStatus}
          isLoading={isLoading}
          pendingAction={pendingAction}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onComplete={onComplete}
          onPostpone={onPostpone}
          canPostpone={canPostpone}
          compact={false}
        />
      </div>
    </div>
  );
}
