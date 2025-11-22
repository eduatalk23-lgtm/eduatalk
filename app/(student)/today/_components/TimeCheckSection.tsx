"use client";

import { useEffect, useState } from "react";
import { Clock, Play, Pause, CheckCircle, RotateCcw } from "lucide-react";
import { formatTime, formatTimestamp, type TimeStats } from "../_utils/planGroupUtils";
import { TimerControlButtons } from "./TimerControlButtons";

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

  // activePlanStartTime을 정규화 (null 또는 문자열로 통일)
  const normalizedStartTime = activePlanStartTime ?? null;

  // dependency array를 안정화하기 위해 모든 값을 명시적으로 정규화
  const isCompleted = Boolean(timeStats.isCompleted);
  const isActive = Boolean(timeStats.isActive);
  const hasStartTime = normalizedStartTime !== null && normalizedStartTime !== undefined;
  const isPausedState = Boolean(isPaused);

  // 실시간 타이머 계산
  useEffect(() => {
    // 완료되었거나 비활성 상태면 타이머 중지
    if (isCompleted || !isActive || !hasStartTime || isPausedState) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      try {
        const start = new Date(normalizedStartTime!).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
      } catch {
        setElapsedSeconds(0);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [isCompleted, isActive, hasStartTime, isPausedState, normalizedStartTime]);

  // 현재 진행 중인 총 시간 계산 (기존 시간 + 경과 시간)
  const currentTotalSeconds = timeStats.isActive
    ? timeStats.totalDuration + elapsedSeconds
    : timeStats.totalDuration;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Clock className="h-4 w-4" />
        시간 정보
      </h3>

      {/* 시작/종료 시간 */}
      <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
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
            {formatTime(timeStats.pureStudyTime + (timeStats.isActive && !isPaused ? elapsedSeconds : 0))}
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

      {/* 현재 진행 시간 (진행 중인 경우) */}
      {timeStats.isActive && (
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
          isLoading={isLoading}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onComplete={onComplete}
        />
      </div>

      {/* 타이머 초기화 버튼 */}
      {(timeStats.firstStartTime || timeStats.lastEndTime || timeStats.totalDuration > 0) && onReset && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <button
            onClick={onReset}
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

