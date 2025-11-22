"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, Play, Pause, CheckCircle, RotateCcw } from "lucide-react";
import { formatTime, formatTimestamp, type TimeStats } from "../_utils/planGroupUtils";
import { TimerControlButtons } from "./TimerControlButtons";
import { getTimerLogsByPlanNumber } from "../actions/timerLogActions";
import type { TimerLog } from "../actions/timerLogActions";

type TimeCheckSectionProps = {
  timeStats: TimeStats;
  isPaused: boolean;
  activePlanStartTime?: string | null; // 활성 플랜의 시작 시간 (실시간 계산용)
  planId: string; // 타이머 컨트롤용 플랜 ID
  isActive: boolean; // 진행 중인지 여부
  isLoading?: boolean; // 로딩 상태
  planNumber: number | null; // 플랜 그룹 번호 (초기화용)
  planDate: string; // 플랜 날짜 (초기화용)
  onStart: () => void; // 시작 핸들러
  onPause: () => void; // 일시정지 핸들러
  onResume: () => void; // 재개 핸들러
  onComplete: () => void; // 완료 핸들러
  onReset?: () => void; // 초기화 핸들러
};

export function TimeCheckSection({
  timeStats,
  isPaused,
  activePlanStartTime,
  planId,
  isActive,
  isLoading = false,
  planNumber,
  planDate,
  onStart,
  onPause,
  onResume,
  onComplete,
  onReset,
}: TimeCheckSectionProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerLogs, setTimerLogs] = useState<TimerLog[]>([]);
  const [isPending, startTransition] = useTransition();
  
  // Optimistic 상태 관리 (서버 응답 전 즉시 UI 업데이트)
  const [optimisticIsPaused, setOptimisticIsPaused] = useState<boolean | null>(null);
  const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(null);

  // activePlanStartTime을 정규화 (null 또는 문자열로 통일)
  const normalizedStartTime = activePlanStartTime ?? null;
  
  // props가 변경되면 optimistic 상태 초기화 (서버 상태와 동기화)
  useEffect(() => {
    setOptimisticIsPaused(null);
    setOptimisticIsActive(null);
  }, [isPaused, isActive]);

  // 타이머 로그 조회 (서버 상태 변경 시에만 조회, optimistic 상태 변경은 제외)
  useEffect(() => {
    const loadTimerLogs = async () => {
      const result = await getTimerLogsByPlanNumber(planNumber, planDate);
      if (result.success && result.logs) {
        setTimerLogs(result.logs);
      } else {
        // 로그가 없으면 빈 배열로 설정 (초기화 후 상태 반영)
        setTimerLogs([]);
      }
    };
    // planNumber, planDate, timeStats의 모든 필드가 변경될 때 조회
    // 초기화 후 timeStats가 변경되면 로그도 다시 조회됨
    loadTimerLogs();
  }, [
    planNumber,
    planDate,
    timeStats.firstStartTime,
    timeStats.lastEndTime,
    timeStats.totalDuration,
    timeStats.pausedDuration,
    timeStats.pauseCount,
    timeStats.isActive,
    timeStats.isCompleted,
  ]);

  // dependency array를 안정화하기 위해 모든 값을 명시적으로 정규화
  const isCompleted = Boolean(timeStats.isCompleted);
  // Optimistic 상태가 있으면 우선 사용, 없으면 props 사용
  const isActiveState = optimisticIsActive !== null ? optimisticIsActive : Boolean(isActive);
  const hasStartTime = normalizedStartTime !== null && normalizedStartTime !== undefined;
  const isPausedState = optimisticIsPaused !== null ? optimisticIsPaused : Boolean(isPaused);

  // 실시간 타이머 계산
  useEffect(() => {
    // 완료되었거나 비활성 상태면 타이머 중지
    if (isCompleted || !isActiveState || !hasStartTime || isPausedState) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      try {
        const start = new Date(normalizedStartTime!).getTime();
        const now = Date.now();
        const total = Math.floor((now - start) / 1000);
        // 일시정지 시간 제외 (PlanItem과 동일한 로직)
        const pausedSeconds = timeStats.pausedDuration || 0;
        setElapsedSeconds(Math.max(0, total - pausedSeconds));
      } catch {
        setElapsedSeconds(0);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [isCompleted, isActiveState, hasStartTime, isPausedState, normalizedStartTime, timeStats.pausedDuration]);

  // 현재 진행 중인 총 시간 계산 (기존 시간 + 경과 시간)
  // 완료되었으면 경과 시간을 더하지 않음
  const currentTotalSeconds = isCompleted
    ? timeStats.totalDuration
    : timeStats.isActive
    ? timeStats.totalDuration + elapsedSeconds
    : timeStats.totalDuration;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Clock className="h-4 w-4" />
        시간 정보
      </h3>

      {/* 시작/종료 시간 및 타이머 로그 */}
      <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
        {/* 타이머 로그에서 시작/일시정지/재개/완료 시간 표시 */}
        {timerLogs.length > 0 ? (
          <>
            {timerLogs
              .filter((log) => log.event_type === "start")
              .slice(0, 1)
              .map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">시작 시간</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              ))}
            {timerLogs
              .filter((log) => log.event_type === "pause")
              .slice(-1)
              .map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <span className="text-sm text-amber-600">일시정지 시간</span>
                  <span className="text-sm font-medium text-amber-900">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              ))}
            {timerLogs
              .filter((log) => log.event_type === "resume")
              .slice(-1)
              .map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <span className="text-sm text-blue-600">재시작 시간</span>
                  <span className="text-sm font-medium text-blue-900">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              ))}
            {timerLogs
              .filter((log) => log.event_type === "complete")
              .slice(0, 1)
              .map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">종료 시간</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              ))}
          </>
        ) : (
          <>
            {/* 로그가 없을 때는 기존 방식으로 표시 */}
            {timeStats.firstStartTime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">시작 시간</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatTimestamp(timeStats.firstStartTime)}
                </span>
              </div>
            )}
            {timeStats.currentPausedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-600">일시정지 시간</span>
                <span className="text-sm font-medium text-amber-900">
                  {formatTimestamp(timeStats.currentPausedAt)}
                </span>
              </div>
            )}
            {timeStats.lastResumedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-600">재시작 시간</span>
                <span className="text-sm font-medium text-blue-900">
                  {formatTimestamp(timeStats.lastResumedAt)}
                </span>
              </div>
            )}
            {timeStats.lastEndTime && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">종료 시간</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatTimestamp(timeStats.lastEndTime)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 학습 시간 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-blue-50 p-3">
          <div className="text-xs text-blue-600">총 학습</div>
          <div className="mt-1 text-lg font-bold text-blue-900">
            {formatTime(currentTotalSeconds)}
          </div>
        </div>
        <div className="rounded-lg bg-green-50 p-3">
          <div className="text-xs text-green-600">순수 학습</div>
          <div className="mt-1 text-lg font-bold text-green-900">
            {formatTime(
              isCompleted
                ? timeStats.pureStudyTime
                : timeStats.pureStudyTime + (timeStats.isActive && !isPausedState ? elapsedSeconds : 0)
            )}
          </div>
        </div>
      </div>

      {/* 일시정지 정보 */}
      {timeStats.pauseCount > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-amber-50 p-3">
          <div>
            <div className="text-xs text-amber-600">일시정지</div>
            <div className="mt-1 text-sm font-semibold text-amber-900">
              {timeStats.pauseCount}회 / {formatTime(timeStats.pausedDuration)}
            </div>
          </div>
        </div>
      )}

      {/* 현재 진행 시간 (진행 중인 경우, 완료되지 않은 경우만) */}
      {timeStats.isActive && !isCompleted && (
        <div className={`mt-4 rounded-lg p-4 ${isPaused ? "bg-gray-50" : "bg-indigo-50"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPaused ? (
                <Pause className="h-5 w-5 text-gray-500" />
              ) : (
                <Play className="h-5 w-5 text-indigo-500" />
              )}
              <span className="text-sm font-semibold text-gray-700">
                {isPaused ? "일시정지 중" : "진행 중"}
              </span>
            </div>
            <div className="text-2xl font-bold text-indigo-900">
              {formatTime(elapsedSeconds)}
            </div>
          </div>
        </div>
      )}

      {/* 완료 상태 표시 */}
      {timeStats.isCompleted && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-green-50 p-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-semibold text-green-900">학습 완료</span>
        </div>
      )}

      {/* 타이머 컨트롤 버튼 */}
      <div className="mt-6">
        <TimerControlButtons
          planId={planId}
          isActive={isActive}
          isPaused={isPaused}
          isCompleted={!!timeStats.lastEndTime}
          isLoading={isLoading || isPending}
          onStart={() => {
            setOptimisticIsActive(true);
            setOptimisticIsPaused(false);
            // 에러는 상위 핸들러에서 처리되므로 여기서는 optimistic 상태만 설정
            onStart();
          }}
          onPause={() => {
            setOptimisticIsPaused(true);
            // 에러는 상위 핸들러에서 처리되므로 여기서는 optimistic 상태만 설정
            onPause();
          }}
          onResume={() => {
            setOptimisticIsPaused(false);
            // 에러는 상위 핸들러에서 처리되므로 여기서는 optimistic 상태만 설정
            onResume();
          }}
          onComplete={onComplete}
        />
      </div>

      {/* 타이머 초기화 버튼 */}
      {(timeStats.firstStartTime || timeStats.lastEndTime || timeStats.totalDuration > 0) && onReset && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <button
            onClick={async () => {
              if (onReset) {
                // 즉시 타이머 로그를 빈 배열로 설정하여 UI 업데이트
                setTimerLogs([]);
                await onReset();
                // 초기화 후 서버 상태 반영을 위해 약간의 딜레이 후 타이머 로그 다시 조회
                setTimeout(async () => {
                  const result = await getTimerLogsByPlanNumber(planNumber, planDate);
                  if (result.success && result.logs) {
                    setTimerLogs(result.logs);
                  } else {
                    setTimerLogs([]);
                  }
                }, 300);
              }
            }}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            타이머 기록 초기화
          </button>
        </div>
      )}
    </div>
  );
}

