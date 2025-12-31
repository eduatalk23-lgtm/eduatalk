"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { useToast } from "@/components/ui/ToastProvider";
import { calculateTimerState, type TimerState } from "@/lib/utils/timerStateCalculator";
import { buildPlanExecutionUrl } from "@/app/(student)/today/_utils/navigationUtils";
import {
  startPlan,
  pausePlan,
  resumePlan,
  preparePlanCompletion,
  postponePlan,
} from "@/app/(student)/today/actions/todayActions";
import type { PlanGroup } from "@/app/(student)/today/_utils/planGroupUtils";
import type { PendingAction } from "@/lib/domains/today/types";

export type PlanRunState = "idle" | "running" | "paused" | "completed";

type SessionState = {
  isPaused: boolean;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  pausedDurationSeconds?: number | null;
};

type UsePlanCardActionsOptions = {
  group: PlanGroup;
  sessions: Map<string, SessionState>;
  campMode?: boolean;
};

type UsePlanCardActionsReturn = {
  // 상태
  isLoading: boolean;
  pendingAction: PendingAction | undefined;

  // 파생 상태
  resolvedStatus: PlanRunState;
  isRunning: boolean;
  isPausedState: boolean;

  // 타이머 상태
  timerState: TimerState;

  // 핸들러
  handleStart: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleResume: () => Promise<void>;
  handleComplete: () => Promise<void>;
  handlePostponePlan: (planId: string) => Promise<void>;

  // 연기 가능 여부
  canPostpone: boolean;
};

/**
 * PlanCard 타이머 액션 관리 Hook
 *
 * - 타이머 시작/일시정지/재개/완료 핸들러
 * - 로딩 및 펜딩 액션 상태
 * - 낙관적 UI 상태 관리
 * - 타이머 상태 계산
 */
export function usePlanCardActions({
  group,
  sessions,
  campMode = false,
}: UsePlanCardActionsOptions): UsePlanCardActionsReturn {
  const router = useRouter();
  const { showError, showInfo } = useToast();
  const timerStore = usePlanTimerStore();

  // 로딩 및 펜딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | undefined>(undefined);

  // 세션 데이터
  const sessionForPlan = sessions.get(group.plan.id);

  // 서버 데이터 기반 상태 계산
  const derivedStatus = useMemo<PlanRunState>(() => {
    if (group.plan.actual_end_time) {
      return "completed";
    }
    if (group.plan.actual_start_time) {
      return sessionForPlan?.isPaused ? "paused" : "running";
    }
    return "idle";
  }, [group.plan.actual_end_time, group.plan.actual_start_time, sessionForPlan?.isPaused]);

  // 낙관적 UI 상태
  const [optimisticStatus, setOptimisticStatus] = useState<PlanRunState | null>(null);

  // 서버 상태 변경 시 낙관적 상태 리셋
  useEffect(() => {
    setOptimisticStatus(null);
  }, [derivedStatus]);

  // 최종 상태 (낙관적 또는 서버)
  const resolvedStatus = optimisticStatus ?? derivedStatus;
  const isRunning = resolvedStatus === "running";
  const isPausedState = resolvedStatus === "paused";

  // 타이머 상태 계산
  const timerState = useMemo(() => {
    const plan = group.plan;
    const session = sessions.get(plan.id);

    return calculateTimerState({
      actualStartTime: plan.actual_start_time ?? null,
      actualEndTime: plan.actual_end_time ?? null,
      totalDurationSeconds: plan.total_duration_seconds ?? null,
      pausedDurationSeconds: plan.paused_duration_seconds ?? null,
      isPaused: session?.isPaused ?? false,
      currentPausedAt: session?.pausedAt ?? null,
      sessionStartedAt: session?.startedAt ?? null,
      sessionPausedDurationSeconds: session?.pausedDurationSeconds ?? null,
    });
  }, [group.plan, sessions]);

  // 연기 가능 여부
  const canPostpone = Boolean(
    group.plan.is_reschedulable && !group.plan.actual_end_time
  );

  // 플랜 연기 핸들러
  const handlePostponePlan = useCallback(
    async (planId: string) => {
      if (isLoading) return;
      if (!group.plan.is_reschedulable) {
        showInfo("이 플랜은 일정 미루기가 허용되지 않습니다.");
        return;
      }
      if (!confirm("이 플랜을 내일 일정으로 미루시겠습니까?")) {
        return;
      }

      setIsLoading(true);
      try {
        const result = await postponePlan(planId);
        if (!result.success) {
          showError(result.error || "일정을 미루는 중 오류가 발생했습니다.");
        }
      } catch (error) {
        console.error("[usePlanCardActions] 일정 미루기 오류:", error);
        showError("오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, group.plan.is_reschedulable, showInfo, showError]
  );

  // 타이머 시작 핸들러
  const handleStart = useCallback(async () => {
    const plan = group.plan;
    if (plan.actual_start_time || plan.actual_end_time || isLoading) return;

    setIsLoading(true);
    setPendingAction("start");
    setOptimisticStatus("running");
    try {
      const timestamp = new Date().toISOString();
      const result = await startPlan(plan.id, timestamp);
      if (!result.success) {
        showError(result.error || "플랜 시작에 실패했습니다.");
        setOptimisticStatus(null);
      } else if (result.serverNow && result.status && result.startedAt) {
        timerStore.startTimer(plan.id, result.serverNow, result.startedAt);
      }
    } catch (error) {
      setOptimisticStatus(null);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(undefined);
      setIsLoading(false);
    }
  }, [group.plan, isLoading, showError, timerStore]);

  // 타이머 일시정지 핸들러
  const handlePause = useCallback(async () => {
    if (isLoading) return;
    if (resolvedStatus !== "running") {
      showInfo("일시정지할 활성 플랜이 없습니다.");
      return;
    }

    const plan = group.plan;
    setOptimisticStatus("paused");
    setIsLoading(true);
    setPendingAction("pause");
    try {
      const timestamp = new Date().toISOString();
      const result = await pausePlan(plan.id, timestamp);
      if (!result.success) {
        setOptimisticStatus(null);
        showError(result.error || "플랜 일시정지에 실패했습니다.");
      } else if (result.serverNow && result.accumulatedSeconds !== undefined) {
        timerStore.pauseTimer(plan.id, result.accumulatedSeconds);
      }
    } catch (error) {
      console.error("[usePlanCardActions] 일시정지 오류:", error);
      setOptimisticStatus(null);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(undefined);
      setIsLoading(false);
    }
  }, [isLoading, resolvedStatus, group.plan, showInfo, showError, timerStore]);

  // 타이머 재개 핸들러
  const handleResume = useCallback(async () => {
    if (resolvedStatus !== "paused") {
      showInfo("재개할 일시정지된 플랜이 없습니다.");
      return;
    }

    const plan = group.plan;
    setOptimisticStatus("running");
    setIsLoading(true);
    setPendingAction("resume");
    try {
      const timestamp = new Date().toISOString();
      const result = await resumePlan(plan.id, timestamp);
      if (!result.success) {
        setOptimisticStatus(null);
        showError(result.error || "플랜 재개에 실패했습니다.");
      } else if (result.serverNow && result.status && result.startedAt) {
        timerStore.startTimer(plan.id, result.serverNow, result.startedAt);
      }
    } catch (error) {
      console.error("[usePlanCardActions] 재개 오류:", error);
      setOptimisticStatus(null);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(undefined);
      setIsLoading(false);
    }
  }, [resolvedStatus, group.plan, showInfo, showError, timerStore]);

  // 플랜 완료 핸들러
  const handleComplete = useCallback(async () => {
    const targetPlanId = group.plan.id;

    const confirmed = confirm(
      "지금까지의 학습을 기준으로 이 플랜을 완료 입력 화면으로 이동할까요?"
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setPendingAction("complete");
    try {
      const result = await preparePlanCompletion(targetPlanId);

      if (!result.success) {
        showError(result.error || "플랜 완료 준비에 실패했습니다.");
        return;
      }

      timerStore.removeTimer(targetPlanId);
      router.push(buildPlanExecutionUrl(targetPlanId, campMode));
    } catch (error) {
      console.error("[usePlanCardActions] 완료 처리 오류:", error);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(undefined);
      setIsLoading(false);
    }
  }, [group.plan.id, campMode, showError, timerStore, router]);

  return {
    // 상태
    isLoading,
    pendingAction,

    // 파생 상태
    resolvedStatus,
    isRunning,
    isPausedState,

    // 타이머 상태
    timerState,

    // 핸들러
    handleStart,
    handlePause,
    handleResume,
    handleComplete,
    handlePostponePlan,

    // 연기 가능 여부
    canPostpone,
  };
}
