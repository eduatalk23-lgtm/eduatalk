"use client";

import { useEffect, useState } from "react";
import { Clock, Play, Pause, CheckCircle } from "lucide-react";
import { formatTime, formatTimestamp, type TimeStats } from "../_utils/planGroupUtils";

type TimeCheckSectionProps = {
  timeStats: TimeStats;
  isPaused: boolean;
  activePlanStartTime?: string | null; // 활성 플랜의 시작 시간 (실시간 계산용)
};

export function TimeCheckSection({
  timeStats,
  isPaused,
  activePlanStartTime,
}: TimeCheckSectionProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 실시간 타이머 계산
  useEffect(() => {
    if (!timeStats.isActive || !activePlanStartTime || isPaused) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      try {
        const start = new Date(activePlanStartTime).getTime();
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
  }, [timeStats.isActive, activePlanStartTime, isPaused]);

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
      {!timeStats.isActive && timeStats.lastEndTime && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-green-50 p-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-semibold text-green-900">학습 완료</span>
        </div>
      )}
    </div>
  );
}

