"use client";

import { memo } from "react";
import { formatTime, TimeStats, formatTimestamp } from "../_utils/planGroupUtils";
import { usePlanTimer } from "@/lib/hooks/usePlanTimer";
import type { TimerStatus } from "@/lib/store/planTimerStore";
import { TimerDisplay } from "./timer/TimerDisplay";
import { TimerControls } from "./timer/TimerControls";
import { cn } from "@/lib/cn";
import {
  cardBase,
  textMuted,
} from "@/lib/utils/darkMode";
import type { PendingAction } from "@/lib/domains/today/types";

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
  /** 가상 플랜 여부 (true이면 시작 버튼 비활성화) */
  isVirtual?: boolean;
};

function PlanTimerComponent({
  planId,
  timeStats,
  isLoading,
  onStart,
  onPause,
  onResume,
  onComplete,
  onPostpone,
  canPostpone = false,
  pendingAction,
  compact = false,
  status,
  accumulatedSeconds,
  startedAt,
  serverNow,
  isVirtual = false,
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
          <div className={cn(
            "flex flex-col gap-2 rounded-lg border p-3 text-xs",
            "border-indigo-100 dark:border-indigo-800",
            "bg-indigo-50 dark:bg-indigo-900/30",
            "text-indigo-900 dark:text-indigo-200"
          )}>
            <div className={cn("font-semibold", "text-indigo-950 dark:text-indigo-100")}>학습 완료 기록</div>
            <dl className="grid grid-cols-[92px,1fr] gap-1">
              <dt className="text-indigo-700 dark:text-indigo-300">시작 시간</dt>
              <dd className="text-right font-medium">{formattedStartTime}</dd>
              <dt className="text-indigo-700 dark:text-indigo-300">종료 시간</dt>
              <dd className="text-right font-medium">{formattedEndTime}</dd>
              <dt className="text-indigo-700 dark:text-indigo-300">총 학습</dt>
              <dd className={cn("text-right font-semibold", "text-indigo-950 dark:text-indigo-100")}>{formattedPureStudyTime}</dd>
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
          isVirtual={isVirtual}
        />

        {timeStats.pauseCount > 0 && showTimer && (
          <div className={cn("text-xs", textMuted)}>
            일시정지: {timeStats.pauseCount}회
            {timeStats.pausedDuration > 0 && <span> ({formatTime(timeStats.pausedDuration)})</span>}
          </div>
        )}
      </div>
    );
  }

  // 전체 뷰
  return (
    <div className={cn(cardBase, "p-6")}>
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
          <div className={cn(
            "flex flex-col gap-3 rounded-lg border p-4",
            "border-indigo-100 dark:border-indigo-800",
            "bg-indigo-50 dark:bg-indigo-900/30"
          )}>
            <h4 className={cn("text-sm font-semibold", "text-indigo-900 dark:text-indigo-200")}>학습 완료 기록</h4>
            <div className={cn("grid gap-3 text-sm md:grid-cols-3", "text-indigo-950 dark:text-indigo-100")}>
              <div className={cn("flex flex-col gap-1 rounded-md p-3", "bg-white/60 dark:bg-white/10")}>
                <span className={cn("text-xs", "text-indigo-600 dark:text-indigo-300")}>시작 시간</span>
                <span className="text-sm font-semibold">{formattedStartTime}</span>
              </div>
              <div className={cn("flex flex-col gap-1 rounded-md p-3", "bg-white/60 dark:bg-white/10")}>
                <span className={cn("text-xs", "text-indigo-600 dark:text-indigo-300")}>종료 시간</span>
                <span className="text-sm font-semibold">{formattedEndTime}</span>
              </div>
              <div className={cn("flex flex-col gap-1 rounded-md p-3", "bg-white/60 dark:bg-white/10")}>
                <span className={cn("text-xs", "text-indigo-600 dark:text-indigo-300")}>총 학습 시간 (일시정지 제외)</span>
                <span className={cn("text-lg font-bold", "text-indigo-900 dark:text-indigo-200")}>{formattedPureStudyTime}</span>
              </div>
            </div>
          </div>
        )}

        {timeStats.pauseCount > 0 && showTimer && (
          <div className={cn("text-xs", textMuted)}>
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
          isVirtual={isVirtual}
        />
      </div>
    </div>
  );
}

// React.memo로 불필요한 리렌더링 방지
export const PlanTimer = memo(PlanTimerComponent, (prevProps, nextProps) => {
  // 핵심 props만 비교하여 불필요한 리렌더링 방지
  return (
    prevProps.planId === nextProps.planId &&
    prevProps.status === nextProps.status &&
    prevProps.accumulatedSeconds === nextProps.accumulatedSeconds &&
    prevProps.startedAt === nextProps.startedAt &&
    prevProps.serverNow === nextProps.serverNow &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.pendingAction === nextProps.pendingAction &&
    prevProps.compact === nextProps.compact &&
    prevProps.canPostpone === nextProps.canPostpone &&
    prevProps.timeStats.isCompleted === nextProps.timeStats.isCompleted &&
    prevProps.timeStats.pauseCount === nextProps.timeStats.pauseCount &&
    prevProps.timeStats.pausedDuration === nextProps.timeStats.pausedDuration &&
    // 함수 props는 참조 동일성으로 비교 (부모에서 useCallback 사용 필요)
    prevProps.onStart === nextProps.onStart &&
    prevProps.onPause === nextProps.onPause &&
    prevProps.onResume === nextProps.onResume &&
    prevProps.onComplete === nextProps.onComplete &&
    prevProps.onPostpone === nextProps.onPostpone
  );
});
