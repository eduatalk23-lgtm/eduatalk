"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, CheckCircle, RotateCcw } from "lucide-react";
import { formatTimestamp, type TimeStats } from "../_utils/planGroupUtils";
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
  onStart: (timestamp?: string) => void; // 시작 핸들러 (타임스탬프 전달)
  onPause: (timestamp?: string) => void; // 일시정지 핸들러 (타임스탬프 전달)
  onResume: (timestamp?: string) => void; // 재개 핸들러 (타임스탬프 전달)
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
  const [isPending, startTransition] = useTransition();
  
  // Optimistic 상태 관리 (서버 응답 전 즉시 UI 업데이트)
  const [optimisticIsPaused, setOptimisticIsPaused] = useState<boolean | null>(null);
  const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(null);
  // Optimistic 타임스탬프 관리 (버튼 클릭 시 즉시 표시)
  const [optimisticTimestamps, setOptimisticTimestamps] = useState<{
    start?: string;
    pause?: string;
    resume?: string;
  }>({});

  // activePlanStartTime을 정규화 (null 또는 문자열로 통일)
  const normalizedStartTime = activePlanStartTime ?? null;
  
  // props가 변경되면 optimistic 상태 초기화 (서버 상태와 동기화)
  useEffect(() => {
    setOptimisticIsPaused(null);
    setOptimisticIsActive(null);
    // 서버에서 props가 업데이트되면 optimistic 타임스탬프도 제거
    // 클라이언트에서 보낸 타임스탬프를 서버에서 그대로 저장하므로, props가 변경되면 이미 서버에 저장된 것
    // 같은 국가에서 사용한다면 클라이언트 타임스탬프를 그대로 사용해도 문제없음
    setOptimisticTimestamps({});
  }, [isPaused, isActive, timeStats.firstStartTime, timeStats.currentPausedAt, timeStats.lastResumedAt]);

  // 시간 이벤트 조회는 제거
  // 클라이언트에서 타임스탬프를 생성해서 서버에 전달하므로, 서버에서 다시 조회할 필요 없음
  // Optimistic 타임스탬프를 사용하고, props가 업데이트되면 제거
  // 개별 플랜의 타이머는 독립적으로 동작하므로 다른 플랜 상태 동기화 불필요

  // dependency array를 안정화하기 위해 모든 값을 명시적으로 정규화
  const isCompleted = Boolean(timeStats.isCompleted);
  // Optimistic 상태가 있으면 우선 사용, 없으면 props 사용
  const isActiveState = optimisticIsActive !== null ? optimisticIsActive : Boolean(isActive);
  const hasStartTime = normalizedStartTime !== null && normalizedStartTime !== undefined;
  const isPausedState = optimisticIsPaused !== null ? optimisticIsPaused : Boolean(isPaused);



  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Clock className="h-4 w-4" />
        시간 정보
      </h3>

      {/* 시작/종료 시간 및 시간 이벤트 */}
      <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
        {/* Optimistic 타임스탬프 또는 실제 타임스탬프 표시 */}
        {/* 시작 시간 */}
        {(optimisticTimestamps.start || timeStats.firstStartTime) && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">시작 시간</span>
            <span className="text-sm font-medium text-gray-900">
              {formatTimestamp(
                optimisticTimestamps.start || timeStats.firstStartTime || ""
              )}
            </span>
          </div>
        )}
        
        {/* 일시정지 시간 */}
        {(optimisticTimestamps.pause || timeStats.currentPausedAt) && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-600">일시정지 시간</span>
            <span className="text-sm font-medium text-amber-900">
              {formatTimestamp(
                optimisticTimestamps.pause || timeStats.currentPausedAt || ""
              )}
            </span>
          </div>
        )}
        
        {/* 재시작 시간 */}
        {(optimisticTimestamps.resume || timeStats.lastResumedAt) && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-600">재시작 시간</span>
            <span className="text-sm font-medium text-blue-900">
              {formatTimestamp(
                optimisticTimestamps.resume || timeStats.lastResumedAt || ""
              )}
            </span>
          </div>
        )}
        
        {/* 종료 시간 */}
        {timeStats.lastEndTime && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">종료 시간</span>
            <span className="text-sm font-medium text-gray-900">
              {formatTimestamp(timeStats.lastEndTime)}
            </span>
          </div>
        )}
      </div>




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
          isActive={isActiveState}
          isPaused={isPausedState}
          isCompleted={!!timeStats.lastEndTime}
          isLoading={isLoading || isPending}
          onStart={() => {
            const timestamp = new Date().toISOString();
            setOptimisticIsActive(true);
            setOptimisticIsPaused(false);
            // Optimistic 타임스탬프 설정 (즉시 표시)
            setOptimisticTimestamps((prev) => ({
              ...prev,
              start: timestamp,
            }));
            // 클라이언트 타임스탬프를 서버에 전달
            onStart(timestamp);
          }}
          onPause={() => {
            const timestamp = new Date().toISOString();
            setOptimisticIsPaused(true);
            // Optimistic 타임스탬프 설정 (즉시 표시)
            setOptimisticTimestamps((prev) => ({
              ...prev,
              pause: timestamp,
            }));
            // 클라이언트 타임스탬프를 서버에 전달
            onPause(timestamp);
          }}
          onResume={() => {
            const timestamp = new Date().toISOString();
            setOptimisticIsPaused(false);
            // Optimistic 타임스탬프 설정 (즉시 표시)
            // 재시작 시 일시정지 타임스탬프는 유지 (이전 일시정지 기록은 보존)
            setOptimisticTimestamps((prev) => ({
              ...prev,
              resume: timestamp,
            }));
            // 클라이언트 타임스탬프를 서버에 전달
            onResume(timestamp);
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
                await onReset();
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

