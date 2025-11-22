"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
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
  hasOtherActivePlan?: boolean; // 다른 플랜의 타이머가 실행 중인지 여부
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
  hasOtherActivePlan = false,
  onStart,
  onPause,
  onResume,
  onComplete,
  onReset,
}: TimeCheckSectionProps) {
  const [isPending, startTransition] = useTransition();
  
  // Optimistic 상태 제거 - 서버 상태만 사용 (더 예측 가능한 UX)
  // Optimistic 타임스탬프 관리 (버튼 클릭 시 즉시 표시, 여러 번 누적)
  const [optimisticTimestamps, setOptimisticTimestamps] = useState<{
    start?: string;
    pauses?: string[]; // 일시정지 타임스탬프 배열
    resumes?: string[]; // 재시작 타임스탬프 배열
  }>({});

  // activePlanStartTime을 정규화 (null 또는 문자열로 통일)
  const normalizedStartTime = activePlanStartTime ?? null;
  
  // 서버 상태만 사용하므로 별도 초기화 로직 불필요

  // 시간 이벤트 조회는 제거
  // 클라이언트에서 타임스탬프를 생성해서 서버에 전달하므로, 서버에서 다시 조회할 필요 없음
  // Optimistic 타임스탬프를 사용하고, props가 업데이트되면 제거
  // 개별 플랜의 타이머는 독립적으로 동작하므로 다른 플랜 상태 동기화 불필요

  // 서버 상태만 사용
  const isCompleted = Boolean(timeStats.isCompleted);
  const isActiveState = Boolean(isActive);
  const hasStartTime = normalizedStartTime !== null && normalizedStartTime !== undefined;
  const isPausedState = Boolean(isPaused);




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
        
        {/* 모든 일시정지/재시작 타임스탬프를 시간순으로 표시 */}
        {useMemo(() => {
          // 타임스탬프를 표준화하여 중복 제거 (Date 객체를 이용한 비교)
          const normalizeTimestamp = (ts: string): number => {
            return new Date(ts).getTime();
          };

          // Map을 사용하여 타임스탬프의 중복을 제거 (키: 타임스탬프의 밀리초 값, 값: 원본 타임스탬프)
          const pauseMap = new Map<number, string>();
          const resumeMap = new Map<number, string>();

          // Optimistic 일시정지 타임스탬프 추가
          if (optimisticTimestamps.pauses) {
            optimisticTimestamps.pauses.forEach(ts => {
              const normalized = normalizeTimestamp(ts);
              if (!pauseMap.has(normalized)) {
                pauseMap.set(normalized, ts);
              }
            });
          }

          // 서버 일시정지 타임스탬프 추가
          // 현재 일시정지 중이면 currentPausedAt만 사용, 재시작 후면 lastPausedAt만 사용
          if (timeStats.currentPausedAt) {
            const normalized = normalizeTimestamp(timeStats.currentPausedAt);
            if (!pauseMap.has(normalized)) {
              pauseMap.set(normalized, timeStats.currentPausedAt);
            }
          } else if (timeStats.lastPausedAt) {
            const normalized = normalizeTimestamp(timeStats.lastPausedAt);
            if (!pauseMap.has(normalized)) {
              pauseMap.set(normalized, timeStats.lastPausedAt);
            }
          }

          // Optimistic 재시작 타임스탬프 추가
          if (optimisticTimestamps.resumes) {
            optimisticTimestamps.resumes.forEach(ts => {
              const normalized = normalizeTimestamp(ts);
              if (!resumeMap.has(normalized)) {
                resumeMap.set(normalized, ts);
              }
            });
          }

          // 서버 재시작 타임스탬프 추가
          if (timeStats.lastResumedAt) {
            const normalized = normalizeTimestamp(timeStats.lastResumedAt);
            if (!resumeMap.has(normalized)) {
              resumeMap.set(normalized, timeStats.lastResumedAt);
            }
          }

          // Map을 배열로 변환하고 모든 이벤트를 시간순으로 정렬
          const allEvents: Array<{ type: "pause" | "resume"; timestamp: string }> = [
            ...Array.from(pauseMap.entries()).map(([_, ts]) => ({ type: "pause" as const, timestamp: ts })),
            ...Array.from(resumeMap.entries()).map(([_, ts]) => ({ type: "resume" as const, timestamp: ts })),
          ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          return allEvents.map((event, index) => (
            <div key={`${event.type}-${event.timestamp}-${index}`} className="flex items-center justify-between">
              <span className={`text-sm ${event.type === "pause" ? "text-amber-600" : "text-blue-600"}`}>
                {event.type === "pause" ? "일시정지 시간" : "재시작 시간"}
              </span>
              <span className={`text-sm font-medium ${event.type === "pause" ? "text-amber-900" : "text-blue-900"}`}>
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          ));
        }, [optimisticTimestamps.pauses, optimisticTimestamps.resumes, timeStats.currentPausedAt, timeStats.lastPausedAt, timeStats.lastResumedAt])}
        
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

      {/* 타이머 컨트롤 버튼 - 서버 상태만 사용 */}
      <div className="mt-6">
        <TimerControlButtons
          planId={planId}
          isActive={isActive}
          isPaused={isPaused}
          isCompleted={!!timeStats.lastEndTime}
          isLoading={isLoading || isPending}
          hasOtherActivePlan={hasOtherActivePlan}
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

