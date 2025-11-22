"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, CheckCircle, RotateCcw } from "lucide-react";
import { formatTimestamp, type TimeStats } from "../_utils/planGroupUtils";
import { TimerControlButtons } from "./TimerControlButtons";
import { getTimeEventsByPlanNumber } from "../actions/sessionTimeActions";
import type { TimeEvent } from "../actions/sessionTimeActions";

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
  const [timeEvents, setTimeEvents] = useState<TimeEvent[]>([]);
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

  // 시간 이벤트 조회 (세션 데이터로 계산)
  useEffect(() => {
    const loadTimeEvents = async () => {
      const result = await getTimeEventsByPlanNumber(planNumber, planDate);
      if (result.success && result.events) {
        setTimeEvents(result.events);
      } else {
        // 이벤트가 없으면 빈 배열로 설정
        setTimeEvents([]);
      }
    };
    // planNumber, planDate, timeStats의 모든 필드가 변경될 때 조회
    loadTimeEvents();
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



  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Clock className="h-4 w-4" />
        시간 정보
      </h3>

      {/* 시작/종료 시간 및 시간 이벤트 */}
      <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
        {/* 세션 데이터로 계산한 시간 이벤트 표시 */}
        {timeEvents.length > 0 ? (
          <>
            {timeEvents
              .filter((event) => event.type === "start")
              .slice(0, 1)
              .map((event, idx) => (
                <div key={`start-${idx}`} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">시작 시간</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              ))}
            {timeEvents
              .filter((event) => event.type === "pause")
              .slice(-1)
              .map((event, idx) => (
                <div key={`pause-${idx}`} className="flex items-center justify-between">
                  <span className="text-sm text-amber-600">일시정지 시간</span>
                  <span className="text-sm font-medium text-amber-900">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              ))}
            {timeEvents
              .filter((event) => event.type === "resume")
              .slice(-1)
              .map((event, idx) => (
                <div key={`resume-${idx}`} className="flex items-center justify-between">
                  <span className="text-sm text-blue-600">재시작 시간</span>
                  <span className="text-sm font-medium text-blue-900">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              ))}
            {timeEvents
              .filter((event) => event.type === "complete")
              .slice(0, 1)
              .map((event, idx) => (
                <div key={`complete-${idx}`} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">종료 시간</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              ))}
          </>
        ) : (
          <>
            {/* 이벤트가 없을 때는 timeStats로 표시 (fallback) */}
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
                // 즉시 시간 이벤트를 빈 배열로 설정하여 UI 업데이트
                setTimeEvents([]);
                await onReset();
                // 초기화 후 서버 상태 반영을 위해 약간의 딜레이 후 시간 이벤트 다시 조회
                setTimeout(async () => {
                  const result = await getTimeEventsByPlanNumber(planNumber, planDate);
                  if (result.success && result.events) {
                    setTimeEvents(result.events);
                  } else {
                    setTimeEvents([]);
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

