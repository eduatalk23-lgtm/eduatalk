"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AdHocPlan } from "@/lib/data/studentPlans";
import {
  startAdHocPlan,
  completeAdHocPlan,
  cancelAdHocPlan,
  pauseAdHocPlan,
  resumeAdHocPlan,
} from "@/lib/domains/today/actions/adHocTimer";
import { usePlanTimerStore, type TimerStatus } from "@/lib/store/planTimerStore";
import { TimerDisplay } from "@/app/(student)/today/_components/timer/TimerDisplay";
import { TimerControls } from "@/app/(student)/today/_components/timer/TimerControls";
import { StatusBadge } from "@/app/(student)/today/_components/timer/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { PendingAction } from "@/lib/domains/today/types";

type AdHocPlanExecutionFormProps = {
  plan: AdHocPlan;
};

/**
 * ad_hoc_plans 상태를 TimerStatus로 변환
 */
function mapPlanStatusToTimerStatus(
  status: string,
  pausedAt: string | null
): TimerStatus {
  if (status === "completed") return "COMPLETED";
  if (status === "paused" || pausedAt) return "PAUSED";
  if (status === "in_progress") return "RUNNING";
  return "NOT_STARTED";
}

export function AdHocPlanExecutionForm({ plan }: AdHocPlanExecutionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timerStore = usePlanTimerStore();
  const { showError, showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | undefined>();
  const [isCompleting, setIsCompleting] = useState(false);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // 타이머 경과 시간 (초)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 상태 결정
  const isAlreadyCompleted = plan.status === "completed";
  const isInProgress = plan.status === "in_progress";
  const isPaused = plan.status === "paused" || !!plan.paused_at;

  // TimerStatus 변환
  const timerStatus = mapPlanStatusToTimerStatus(
    plan.status,
    plan.paused_at ?? null
  );

  // 타이머 경과 시간 계산
  useEffect(() => {
    if (!plan.started_at || isAlreadyCompleted) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const startTime = new Date(plan.started_at!).getTime();
      const pausedDuration = (plan.paused_duration_seconds ?? 0) * 1000;

      if (isPaused && plan.paused_at) {
        // 일시정지 상태: 일시정지 시점까지의 시간
        const pausedAt = new Date(plan.paused_at).getTime();
        const elapsed = pausedAt - startTime - pausedDuration;
        return Math.max(0, Math.floor(elapsed / 1000));
      } else {
        // 진행 중: 현재까지 경과 시간
        const now = Date.now();
        const elapsed = now - startTime - pausedDuration;
        return Math.max(0, Math.floor(elapsed / 1000));
      }
    };

    setElapsedSeconds(calculateElapsed());

    // 진행 중일 때만 interval 설정
    if (isInProgress && !isPaused) {
      const interval = setInterval(() => {
        setElapsedSeconds(calculateElapsed());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [plan.started_at, plan.paused_at, plan.paused_duration_seconds, isInProgress, isPaused, isAlreadyCompleted]);

  // 타이머 시작
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setPendingAction("start");
    setError(null);
    try {
      const result = await startAdHocPlan(plan.id);
      if (result.success) {
        timerStore.startTimer(plan.id, Date.now(), result.startedAt!, "ad_hoc_plan");
        showToast("학습을 시작합니다", "success");
        router.refresh();
      } else {
        setError(result.error || "플랜 시작에 실패했습니다.");
        showError(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (err) {
      setError("오류가 발생했습니다.");
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setPendingAction(undefined);
    }
  }, [plan.id, timerStore, showToast, showError, router]);

  // 타이머 일시정지
  const handlePause = useCallback(async () => {
    setIsLoading(true);
    setPendingAction("pause");
    setError(null);
    try {
      const result = await pauseAdHocPlan(plan.id);
      if (result.success) {
        timerStore.pauseTimer(plan.id, result.accumulatedSeconds ?? elapsedSeconds);
        showToast("학습을 일시정지했습니다", "info");
        router.refresh();
      } else {
        setError(result.error || "일시정지에 실패했습니다.");
        showError(result.error || "일시정지에 실패했습니다.");
      }
    } catch (err) {
      setError("오류가 발생했습니다.");
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setPendingAction(undefined);
    }
  }, [plan.id, timerStore, elapsedSeconds, showToast, showError, router]);

  // 타이머 재시작
  const handleResume = useCallback(async () => {
    setIsLoading(true);
    setPendingAction("resume");
    setError(null);
    try {
      const result = await resumeAdHocPlan(plan.id);
      if (result.success) {
        // 재시작은 startTimer를 다시 호출
        timerStore.startTimer(plan.id, Date.now(), result.startedAt!, "ad_hoc_plan");
        showToast("학습을 재시작합니다", "success");
        router.refresh();
      } else {
        setError(result.error || "재시작에 실패했습니다.");
        showError(result.error || "재시작에 실패했습니다.");
      }
    } catch (err) {
      setError("오류가 발생했습니다.");
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setPendingAction(undefined);
    }
  }, [plan.id, timerStore, showToast, showError, router]);

  // 타이머 완료
  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    setIsLoading(true);
    setPendingAction("complete");
    setError(null);

    try {
      const result = await completeAdHocPlan(plan.id);

      if (result.success) {
        timerStore.removeTimer(plan.id);

        // React Query 캐시 무효화
        queryClient.invalidateQueries({ queryKey: ["todayContainerPlans"] });
        queryClient.invalidateQueries({ queryKey: ["todayPlans"] });

        showToast("학습을 완료했습니다!", "success");
        router.push("/today");
      } else {
        setError(result.error || "플랜 완료에 실패했습니다.");
        showError(result.error || "플랜 완료에 실패했습니다.");
        setIsCompleting(false);
      }
    } catch (err) {
      console.error("[AdHocPlanExecutionForm] 완료 처리 오류:", err);
      setError("오류가 발생했습니다.");
      showError("오류가 발생했습니다.");
      setIsCompleting(false);
    } finally {
      setIsLoading(false);
      setPendingAction(undefined);
    }
  }, [plan.id, timerStore, queryClient, showToast, showError, router]);

  // 타이머 취소
  const handleCancel = useCallback(async () => {
    setShowCancelConfirm(false);
    setIsLoading(true);
    setError(null);

    try {
      const result = await cancelAdHocPlan(plan.id);

      if (result.success) {
        timerStore.removeTimer(plan.id);
        showToast("학습이 취소되었습니다", "info");
        router.push("/today");
      } else {
        setError(result.error || "취소에 실패했습니다.");
        showError(result.error || "취소에 실패했습니다.");
      }
    } catch (err) {
      setError("오류가 발생했습니다.");
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [plan.id, timerStore, showToast, showError, router]);

  // 상태: 이미 완료됨
  if (isAlreadyCompleted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-md">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <StatusBadge status="COMPLETED" size="lg" />
            <span className="text-base font-bold text-emerald-900">이 플랜은 이미 완료되었습니다.</span>
            {plan.actual_minutes && (
              <p className="text-sm text-emerald-700">
                총 학습 시간: {plan.actual_minutes}분
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 상태: 완료 처리 중
  if (isCompleting) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-white p-8 text-center shadow-md">
          <div className="flex justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
          <p className="text-base font-bold text-indigo-900">학습 기록을 정리하고 있어요… 잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  // 상태: 진행 중 또는 일시정지
  if (isInProgress || isPaused) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 타이머 디스플레이 */}
        <TimerDisplay
          seconds={elapsedSeconds}
          status={timerStatus}
          subtitle="학습 시간"
          showStatusBadge={true}
        />

        {/* 타이머 컨트롤 */}
        <TimerControls
          status={timerStatus}
          isLoading={isLoading}
          pendingAction={pendingAction}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onComplete={handleComplete}
        />

        {/* 메모 입력 */}
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              메모 (선택)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-base font-medium transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              rows={3}
              placeholder="학습 중 느낀 점이나 중요한 내용을 적어 두세요."
            />
          </div>
        </div>

        {/* 취소 버튼 */}
        <button
          onClick={() => setShowCancelConfirm(true)}
          disabled={isLoading}
          className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-base font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
        >
          학습 취소
        </button>

        <ConfirmDialog
          open={showCancelConfirm}
          onOpenChange={setShowCancelConfirm}
          title="학습 취소"
          description="이 학습을 취소하시겠습니까? 진행 기록은 저장되지 않습니다."
          confirmLabel="취소하기"
          cancelLabel="계속 학습"
          onConfirm={handleCancel}
          variant="destructive"
        />
      </div>
    );
  }

  // 상태: 시작 전 (pending)
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-md">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status="NOT_STARTED" size="md" />
            <h3 className="text-base font-bold text-indigo-900">학습 시작 대기</h3>
          </div>
          <p className="text-sm text-indigo-800">
            아래 버튼을 눌러 학습을 시작하세요.
          </p>
        </div>
      </div>

      <TimerControls
        status={timerStatus}
        isLoading={isLoading}
        pendingAction={pendingAction}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onComplete={handleComplete}
      />
    </div>
  );
}
