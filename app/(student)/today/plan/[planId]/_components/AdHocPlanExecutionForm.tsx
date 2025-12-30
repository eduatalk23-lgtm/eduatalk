"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AdHocPlan } from "@/lib/data/studentPlans";
import {
  startAdHocPlan,
  completeAdHocPlan,
  cancelAdHocPlan,
} from "@/lib/domains/today/actions/adHocTimer";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { StatusBadge } from "@/app/(student)/today/_components/timer/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";

type AdHocPlanExecutionFormProps = {
  plan: AdHocPlan;
};

export function AdHocPlanExecutionForm({ plan }: AdHocPlanExecutionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timerStore = usePlanTimerStore();
  const { showError, showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // 상태 결정
  const isAlreadyCompleted = plan.status === "completed";
  const isInProgress = plan.status === "in_progress";

  // 타이머 시작
  const handleStart = async () => {
    setIsLoading(true);
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
    }
  };

  // 타이머 완료
  const handleComplete = async () => {
    setIsCompleting(true);
    setIsLoading(true);
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
    }
  };

  // 타이머 취소
  const handleCancel = async () => {
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
  };

  // 상태: 이미 완료됨
  if (isAlreadyCompleted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-md">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <StatusBadge status="COMPLETED" size="lg" />
            <span className="text-base font-bold text-emerald-900">이 플랜은 이미 완료되었습니다.</span>
            <p className="text-sm text-emerald-700">위에서 완료된 학습 기록을 확인할 수 있습니다.</p>
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

  // 상태: 진행 중
  if (isInProgress) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-white p-5 shadow-md">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge status="RUNNING" size="md" />
              <h3 className="text-base font-bold text-yellow-900">학습 진행 중</h3>
            </div>
            <p className="text-sm text-yellow-800">
              학습을 완료하면 아래 버튼을 눌러주세요.
            </p>
          </div>
        </div>

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

        {/* 완료 버튼 */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleComplete}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:from-green-700 hover:to-green-800 hover:shadow-xl disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                처리 중...
              </span>
            ) : (
              "학습 완료"
            )}
          </button>
          <button
            onClick={() => setShowCancelConfirm(true)}
            disabled={isLoading}
            className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-base font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
          >
            학습 취소
          </button>
        </div>

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

      <button
        onClick={handleStart}
        disabled={isLoading}
        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:from-indigo-700 hover:to-indigo-800 hover:shadow-xl disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            시작 중...
          </span>
        ) : (
          "학습 시작"
        )}
      </button>
    </div>
  );
}
