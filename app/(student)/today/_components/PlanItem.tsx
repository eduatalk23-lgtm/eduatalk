"use client";

import { useState, useMemo, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlanWithContent, calculateStudyTimeFromTimestamps } from "../_utils/planGroupUtils";
import { TimestampDisplay } from "./TimestampDisplay";
import { TimerControlButtons } from "./TimerControlButtons";
import { formatTime, formatTimestamp } from "../_utils/planGroupUtils";
import { startPlan, pausePlan, resumePlan, preparePlanCompletion } from "../actions/todayActions";
import { useRouter } from "next/navigation";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { useToast } from "@/components/ui/ToastProvider";
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import {
  bgSurface,
  bgPage,
  textPrimary,
  textSecondary,
  textMuted,
  borderDefault,
  completedPlanStyles,
  getCompletedPlanClasses,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

type PlanItemProps = {
  plan: PlanWithContent;
  isGrouped: boolean; // 같은 plan_number를 가진 그룹의 일부인지
  showTimer?: boolean; // 타이머 표시 여부
  viewMode?: "daily" | "single"; // 뷰 모드에 따라 레이아웃 다름
  campMode?: boolean; // 캠프 모드 여부
};

function PlanItemComponent({
  plan,
  isGrouped,
  showTimer = false,
  viewMode = "daily",
  campMode = false,
}: PlanItemProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timerStore = usePlanTimerStore();
  const { showToast, showError } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  
  // 서버 상태만 사용 (더 예측 가능한 UX)
  const isPaused = plan.session?.isPaused ?? false;
  const isActive = !!plan.actual_start_time && !plan.actual_end_time;
  const isRunning = isActive && !isPaused;
  const isCompleted = !!plan.actual_end_time;

  // 타임스탬프 기반 시간 계산 (메모이제이션으로 최적화)
  // 현재 일시정지 중인 경우 일시정지 시작 시간도 고려
  const elapsedSeconds = useMemo(() => {
    const sessionPausedAt = plan.session?.pausedAt ?? null;
    return calculateStudyTimeFromTimestamps(
      plan.actual_start_time,
      plan.actual_end_time,
      plan.paused_duration_seconds,
      isPaused,
      sessionPausedAt
    );
  }, [
    plan.actual_start_time,
    plan.actual_end_time,
    plan.paused_duration_seconds,
    isPaused,
    plan.session
  ]);

  const handleStart = async () => {
    // 이미 로딩 중이면 중복 호출 방지
    if (isLoading) {
      return;
    }

    // 1. Optimistic Update: 즉시 Zustand 상태 업데이트
    const timestamp = new Date().toISOString();
    timerStore.startTimer(plan.id, Date.now(), timestamp);

    setIsLoading(true);

    try {
      const result = await startPlan(plan.id, timestamp);

      if (!result.success) {
        // 2. 실패 시 롤백: 타이머 제거
        timerStore.removeTimer(plan.id);
        showError(result.error || "플랜 시작에 실패했습니다.");
      } else {
        // 3. 성공: 서버 시간으로 동기화
        if (result.serverNow) {
          timerStore.syncNow(plan.id, result.serverNow);
        }
        // React Query 캐시 무효화 (백그라운드)
        queryClient.invalidateQueries({ queryKey: ["activePlanDetails", plan.id] });
        showToast("학습을 시작합니다", "success");
      }
    } catch (error) {
      // 롤백
      timerStore.removeTimer(plan.id);
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    // 이미 로딩 중이거나 일시정지된 상태면 중복 호출 방지
    if (isLoading || isPaused) {
      return;
    }

    // 1. Optimistic Update: 즉시 Zustand 상태 업데이트
    const currentSeconds = timerStore.timers.get(plan.id)?.seconds ?? elapsedSeconds;
    timerStore.pauseTimer(plan.id, currentSeconds);

    setIsLoading(true);
    const timestamp = new Date().toISOString();

    try {
      const result = await pausePlan(plan.id, timestamp);

      if (!result.success) {
        // 2. 실패 시 롤백: 이전 RUNNING 상태로 복구
        if (plan.actual_start_time) {
          timerStore.startTimer(plan.id, Date.now(), plan.actual_start_time);
        }

        // "이미 일시정지된 상태입니다" 에러는 무시 (중복 호출 방지)
        if (result.error && !result.error.includes("이미 일시정지된 상태입니다")) {
          showError(result.error || "플랜 일시정지에 실패했습니다.");
        }
      } else {
        // 3. 성공: 서버 값으로 정확히 동기화
        if (result.accumulatedSeconds !== undefined) {
          timerStore.pauseTimer(plan.id, result.accumulatedSeconds);
        }
        // React Query 캐시 무효화 (백그라운드)
        queryClient.invalidateQueries({ queryKey: ["activePlanDetails", plan.id] });
      }
    } catch (error) {
      // 롤백
      if (plan.actual_start_time) {
        timerStore.startTimer(plan.id, Date.now(), plan.actual_start_time);
      }
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    // 이미 로딩 중이면 중복 호출 방지
    if (isLoading) {
      return;
    }

    // 1. Optimistic Update: 즉시 Zustand 상태 업데이트
    const currentSeconds = timerStore.timers.get(plan.id)?.seconds ?? elapsedSeconds;
    const timestamp = new Date().toISOString();
    timerStore.startTimer(plan.id, Date.now(), plan.actual_start_time || timestamp);

    setIsLoading(true);

    try {
      const result = await resumePlan(plan.id, timestamp);

      if (!result.success) {
        // 2. 실패 시 롤백: 이전 PAUSED 상태로 복구
        timerStore.pauseTimer(plan.id, currentSeconds);
        showError(result.error || "플랜 재개에 실패했습니다.");
      } else {
        // 3. 성공: 서버 시간으로 동기화
        if (result.serverNow) {
          timerStore.syncNow(plan.id, result.serverNow);
        }
        // React Query 캐시 무효화 (백그라운드)
        queryClient.invalidateQueries({ queryKey: ["activePlanDetails", plan.id] });
      }
    } catch (error) {
      // 롤백
      timerStore.pauseTimer(plan.id, currentSeconds);
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    // 확인 다이얼로그 개선 - 버튼 동작을 명확히 설명
    const confirmed = confirm(
      "학습을 마무리하고 결과를 입력하시겠습니까?\n\n• 지금까지 학습한 시간이 기록됩니다\n• 실제 학습한 범위를 입력할 수 있습니다"
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await preparePlanCompletion(plan.id);

      if (!result.success) {
        showError(result.error || "플랜 완료 준비에 실패했습니다.");
        return;
      }

      // 타이머 정지 (스토어에서 제거)
      timerStore.removeTimer(plan.id);

      // React Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["activePlanDetails"] });

      // 완료 입력 페이지로 이동
      router.push(buildPlanExecutionUrl(plan.id, campMode));
    } catch (error) {
      console.error("[PlanItem] 완료 처리 오류:", error);
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
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
      <div
        className={cn(
          "rounded-lg border p-6 shadow-[var(--elevation-1)]",
          isCompleted
            ? getCompletedPlanClasses("success")
            : cn(bgSurface, borderDefault)
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {isCompleted && (
                <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </span>
              )}
              <span className="text-lg">{contentTypeIcon}</span>
              <h3
                className={cn(
                  "text-lg font-semibold",
                  isCompleted ? completedPlanStyles.title : textPrimary
                )}
              >
                블록 {plan.block_index ?? "-"}: {timeRange || "시간 미정"}
              </h3>
            </div>
            <div className="flex flex-col gap-1">
              {plan.sequence && (
                <p className={cn("text-sm", textSecondary)}>
                  회차: {plan.sequence}회차
                </p>
              )}
              {pageRange && (
                <p className={cn("text-sm", textSecondary)}>범위: {pageRange}</p>
              )}
            </div>
            {progress != null && (
              <div className="flex flex-col gap-1">
                <div
                  className={cn(
                    "flex items-center justify-between text-xs",
                    textSecondary
                  )}
                >
                  <span>진행률</span>
                  <span>{progress}%</span>
                </div>
                <ProgressBar
                  value={progress}
                  color={isCompleted ? "green" : progress > 0 ? "blue" : undefined}
                  size="sm"
                />
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
              currentPausedAt={plan.session?.pausedAt ?? null}
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
            campMode={campMode}
          />
        </div>
      </div>
    );
  }

  // 일일 뷰: 컴팩트하게 표시
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-[var(--elevation-1)] transition-base",
        isCompleted
          ? getCompletedPlanClasses("subtle")
          : cn("hover:shadow-[var(--elevation-4)]", bgSurface, borderDefault)
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {isCompleted && (
              <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
              </span>
            )}
            <span>{contentTypeIcon}</span>
            <span
              className={cn(
                "text-sm font-medium",
                isCompleted ? completedPlanStyles.title : textPrimary
              )}
            >
              블록 {plan.block_index ?? "-"}: {timeRange || "시간 미정"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {plan.sequence && (
              <span className={cn("text-xs", textSecondary)}>
                회차: {plan.sequence}회차
              </span>
            )}
            {pageRange && (
              <span className={cn("text-xs", textSecondary)}> | {pageRange}</span>
            )}
          </div>
          {progress != null && (
            <div className="flex flex-col gap-1">
              <div
                className={cn(
                  "flex items-center justify-between text-xs",
                  textSecondary
                )}
              >
                <span>진행률</span>
                <span>{progress}%</span>
              </div>
              <ProgressBar
                value={progress}
                color={isCompleted ? "green" : progress > 0 ? "blue" : undefined}
                size="xs"
              />
            </div>
          )}
        </div>

        {(showTimer || isRunning || isPaused || isCompleted) && (
          <div className="flex flex-col gap-1">
            <div className={cn("flex items-center justify-between rounded-lg p-2", bgPage)}>
              <span className={cn("text-xs", textSecondary)}>학습 시간</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {plan.actual_start_time && (
                <div className={cn("text-xs", textMuted)}>
                  시작: {formatTimestamp(plan.actual_start_time)}
                </div>
              )}
              {plan.pause_count != null && plan.pause_count > 0 && (
                <div className={cn("text-xs", textMuted)}>
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
          campMode={campMode}
        />
      </div>
    </div>
  );
}

export const PlanItem = memo(PlanItemComponent, (prevProps, nextProps) => {
  // plan의 주요 속성만 비교하여 불필요한 리렌더링 방지
  return (
    prevProps.plan.id === nextProps.plan.id &&
    prevProps.plan.progress === nextProps.plan.progress &&
    prevProps.plan.actual_start_time === nextProps.plan.actual_start_time &&
    prevProps.plan.actual_end_time === nextProps.plan.actual_end_time &&
    prevProps.plan.paused_duration_seconds === nextProps.plan.paused_duration_seconds &&
    prevProps.plan.session?.isPaused === nextProps.plan.session?.isPaused &&
    prevProps.isGrouped === nextProps.isGrouped &&
    prevProps.showTimer === nextProps.showTimer &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.campMode === nextProps.campMode
  );
});

