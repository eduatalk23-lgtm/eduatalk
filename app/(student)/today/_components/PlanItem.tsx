"use client";

import { useState, useEffect, useMemo } from "react";
import { PlanWithContent, calculateStudyTimeFromTimestamps } from "../_utils/planGroupUtils";
import { TimestampDisplay } from "./TimestampDisplay";
import { TimerControlButtons } from "./TimerControlButtons";
import { formatTime, formatTimestamp } from "../_utils/planGroupUtils";
import { startPlan, pausePlan, resumePlan } from "../actions/todayActions";
import { useRouter } from "next/navigation";

type PlanItemProps = {
  plan: PlanWithContent;
  isGrouped: boolean; // 같은 plan_number를 가진 그룹의 일부인지
  isActive: boolean; // 현재 활성화된 플랜인지
  showTimer?: boolean; // 타이머 표시 여부
  viewMode?: "daily" | "single"; // 뷰 모드에 따라 레이아웃 다름
};

export function PlanItem({
  plan,
  isGrouped,
  isActive,
  showTimer = false,
  viewMode = "daily",
}: PlanItemProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // Optimistic 상태 관리 (서버 응답 전 즉시 UI 업데이트)
  const [optimisticIsPaused, setOptimisticIsPaused] = useState<boolean | null>(null);
  const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(null);

  // props가 변경되면 optimistic 상태 초기화 (서버 상태와 동기화)
  useEffect(() => {
    setOptimisticIsPaused(null);
    setOptimisticIsActive(null);
  }, [plan.session?.isPaused, plan.actual_start_time, plan.actual_end_time]);

  // Optimistic 상태가 있으면 우선 사용, 없으면 props 사용
  const isPausedState = optimisticIsPaused !== null ? optimisticIsPaused : (plan.session?.isPaused ?? false);
  const isActiveState = optimisticIsActive !== null ? optimisticIsActive : (!!plan.actual_start_time && !plan.actual_end_time);
  
  const isRunning = isActiveState && !isPausedState;
  const isPaused = isPausedState;
  const isCompleted = !!plan.actual_end_time;

  // 타임스탬프 기반 시간 계산 (메모이제이션으로 최적화)
  const elapsedSeconds = useMemo(() =>
    calculateStudyTimeFromTimestamps(
      plan.actual_start_time,
      plan.actual_end_time,
      plan.paused_duration_seconds
    ),
    [plan.actual_start_time, plan.actual_end_time, plan.paused_duration_seconds]
  );

  const handleStart = async () => {
    // Optimistic 상태 즉시 업데이트 (UI 반응성 향상)
    setOptimisticIsActive(true);
    setOptimisticIsPaused(false);
    
    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await startPlan(plan.id, timestamp);
      if (result.success) {
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
        // Optimistic 상태는 useEffect에서 서버 상태와 동기화됨
      } else {
        // 실패 시 optimistic 상태 롤백
        setOptimisticIsActive(null);
        setOptimisticIsPaused(null);
        alert(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      // 실패 시 optimistic 상태 롤백
      setOptimisticIsActive(null);
      setOptimisticIsPaused(null);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    // 이미 로딩 중이거나 일시정지된 상태면 중복 호출 방지
    if (isLoading || isPaused) {
      return;
    }

    // Optimistic 상태 즉시 업데이트 (UI 반응성 향상)
    setOptimisticIsPaused(true);
    setOptimisticIsActive(false);
    
    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await pausePlan(plan.id, timestamp);
      if (result.success) {
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
        // Optimistic 상태는 useEffect에서 서버 상태와 동기화됨
      } else {
        // 실패 시 optimistic 상태 롤백
        setOptimisticIsPaused(null);
        setOptimisticIsActive(null);
        // "이미 일시정지된 상태입니다" 에러는 무시 (중복 호출 방지)
        if (result.error && !result.error.includes("이미 일시정지된 상태입니다")) {
          alert(result.error || "플랜 일시정지에 실패했습니다.");
        }
      }
    } catch (error) {
      // 실패 시 optimistic 상태 롤백
      setOptimisticIsPaused(null);
      setOptimisticIsActive(null);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    // Optimistic 상태 즉시 업데이트 (UI 반응성 향상)
    setOptimisticIsPaused(false);
    setOptimisticIsActive(true);
    
    setIsLoading(true);
    try {
      // 클라이언트에서 타임스탬프 생성
      const timestamp = new Date().toISOString();
      const result = await resumePlan(plan.id, timestamp);
      if (result.success) {
        // 서버 액션에서 이미 revalidatePath를 호출하므로 router.refresh() 불필요
        // Optimistic 상태는 useEffect에서 서버 상태와 동기화됨
      } else {
        // 실패 시 optimistic 상태 롤백
        setOptimisticIsPaused(null);
        setOptimisticIsActive(null);
        alert(result.error || "플랜 재개에 실패했습니다.");
      }
    } catch (error) {
      // 실패 시 optimistic 상태 롤백
      setOptimisticIsPaused(null);
      setOptimisticIsActive(null);
      alert("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    router.push(`/today/plan/${plan.id}`);
  };

  const contentTypeIcon =
    plan.content_type === "book"
      ? "📚"
      : plan.content_type === "lecture"
      ? "🎧"
      : "📝";

  const contentTitle = plan.content?.title || "제목 없음";

  // 범위 표시
  const startPage = plan.planned_start_page_or_time;
  const endPage = plan.planned_end_page_or_time;
  const pageRange =
    startPage !== null &&
    endPage !== null &&
    `${startPage} ~ ${endPage}${plan.content_type === "book" ? "페이지" : "분"}`;

  // 진행률 계산
  const progress = plan.progress ?? 0;

  // 시간 범위 표시
  const timeRange =
    plan.start_time && plan.end_time
      ? `${plan.start_time} ~ ${plan.end_time}`
      : null;

  if (viewMode === "single") {
    // 단일 뷰: 큰 화면으로 표시
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{contentTypeIcon}</span>
              <h3 className="text-lg font-semibold text-gray-900">
                블록 {plan.block_index ?? "-"}: {timeRange || "시간 미정"}
              </h3>
            </div>
            <div className="flex flex-col gap-1">
              {plan.sequence && (
                <p className="text-sm text-gray-600">회차: {plan.sequence}회차</p>
              )}
              {pageRange && (
                <p className="text-sm text-gray-600">범위: {pageRange}</p>
              )}
            </div>
            {progress > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>진행률</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {(showTimer || isRunning || isPaused || isCompleted) && (
            <TimestampDisplay
              actualStartTime={plan.actual_start_time}
              actualEndTime={plan.actual_end_time}
              totalDurationSeconds={plan.total_duration_seconds}
              pausedDurationSeconds={plan.paused_duration_seconds}
              pauseCount={plan.pause_count}
              isRunning={isRunning}
              isPaused={isPaused}
              isCompleted={isCompleted}
            />
          )}

          <TimerControlButtons
            planId={plan.id}
            isActive={isRunning}
            isPaused={isPaused}
            isCompleted={isCompleted}
            isLoading={isLoading}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onComplete={handleComplete}
          />
        </div>
      </div>
    );
  }

  // 일일 뷰: 컴팩트하게 표시
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span>{contentTypeIcon}</span>
            <span className="text-sm font-medium text-gray-900">
              블록 {plan.block_index ?? "-"}: {timeRange || "시간 미정"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {plan.sequence && (
              <span className="text-xs text-gray-600">회차: {plan.sequence}회차</span>
            )}
            {pageRange && <span className="text-xs text-gray-600"> | {pageRange}</span>}
          </div>
          {progress > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>진행률</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {(showTimer || isRunning || isPaused || isCompleted) && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
              <span className="text-xs text-gray-600">학습 시간</span>
              <span className="text-sm font-bold text-indigo-600">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {plan.actual_start_time && (
                <div className="text-xs text-gray-500">
                  시작: {formatTimestamp(plan.actual_start_time)}
                </div>
              )}
              {plan.pause_count !== null && plan.pause_count > 0 && (
                <div className="text-xs text-gray-500">
                  일시정지: {plan.pause_count}회
                </div>
              )}
            </div>
          </div>
        )}

        <TimerControlButtons
          planId={plan.id}
          isActive={isRunning}
          isPaused={isPaused}
          isCompleted={isCompleted}
          isLoading={isLoading}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}

