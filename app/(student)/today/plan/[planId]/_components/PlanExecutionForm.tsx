"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plan } from "@/lib/data/studentPlans";
import { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { StudySession } from "@/lib/data/studentSessions";
import { startPlan, completePlan, postponePlan, preparePlanCompletion } from "@/lib/domains/today";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { StatusBadge } from "@/app/(student)/today/_components/timer/StatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";

type PlanCompletionMode = "today" | "camp";

type PlanExecutionFormProps = {
  mode?: PlanCompletionMode;
  plan: Plan;
  content: Book | Lecture | CustomContent;
  activeSession: StudySession | null;
  unitLabel: string;
  relatedPlans: Plan[];
};

type FormErrors = {
  startPageOrTime?: string;
  endPageOrTime?: string;
  general?: string;
};

export function PlanExecutionForm({
  mode = "today",
  plan,
  content,
  activeSession,
  unitLabel,
  relatedPlans,
}: PlanExecutionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timerStore = usePlanTimerStore();
  const { showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isClearingSession, setIsClearingSession] = useState(false);
  const [startPageOrTime, setStartPageOrTime] = useState<string>(
    plan.planned_start_page_or_time?.toString() || ""
  );
  const [endPageOrTime, setEndPageOrTime] = useState<string>(
    plan.planned_end_page_or_time?.toString() || ""
  );
  const [memo, setMemo] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasActiveSession, setHasActiveSession] = useState(!!activeSession);
  const [showPostponeConfirm, setShowPostponeConfirm] = useState(false);

  // 상태 결정
  const isAlreadyCompleted = !!plan.actual_end_time;
  const showForm = !isAlreadyCompleted && !isCompleting;

  // 타이머 정리 핸들러
  const handleClearSession = async () => {
    setIsClearingSession(true);
    try {
      const result = await preparePlanCompletion(plan.id);
      
      if (!result.success) {
        setErrors({ general: result.error || "타이머 정리에 실패했습니다." });
        showError(result.error || "타이머 정리에 실패했습니다.");
        return;
      }

      setHasActiveSession(false);
      // 타이머 스토어에서 제거
      timerStore.removeTimer(plan.id);
      router.refresh();
    } catch (error) {
      console.error("[PlanExecutionForm] 타이머 정리 오류:", error);
      setErrors({ general: "오류가 발생했습니다." });
      showError("오류가 발생했습니다.");
    } finally {
      setIsClearingSession(false);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    setErrors({});
    try {
      const result = await startPlan(plan.id);
      if (result.success) {
        setHasActiveSession(true);
        router.refresh();
      } else {
        setErrors({ general: result.error || "플랜 시작에 실패했습니다." });
        showError(result.error || "플랜 시작에 실패했습니다.");
      }
    } catch (error) {
      setErrors({ general: "오류가 발생했습니다." });
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 유효성 검사
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!startPageOrTime.trim()) {
      newErrors.startPageOrTime = "시작 값을 입력해주세요.";
    } else {
      const start = Number(startPageOrTime);
      if (!Number.isFinite(start) || start < 0) {
        newErrors.startPageOrTime = "올바른 숫자를 입력해주세요.";
      }
    }

    if (!endPageOrTime.trim()) {
      newErrors.endPageOrTime = "종료 값을 입력해주세요.";
    } else {
      const end = Number(endPageOrTime);
      if (!Number.isFinite(end) || end < 0) {
        newErrors.endPageOrTime = "올바른 숫자를 입력해주세요.";
      } else if (startPageOrTime.trim()) {
        const start = Number(startPageOrTime);
        if (end < start) {
          newErrors.endPageOrTime = "종료 값은 시작 값보다 크거나 같아야 합니다.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleComplete = async () => {
    setErrors({});
    
    if (!validateForm()) {
      return;
    }

    const start = Number(startPageOrTime);
    const end = Number(endPageOrTime);

    setIsCompleting(true);
    setIsLoading(true);
    try {
      const result = await completePlan(plan.id, {
        startPageOrTime: start,
        endPageOrTime: end,
        memo: memo || null,
      });

      if (result.success) {
        // 타이머 스토어에서 제거
        timerStore.removeTimer(plan.id);

        // React Query 캐시 무효화 (클라이언트 보조 - revalidatePath는 서버에서 처리)
        queryClient.invalidateQueries({ queryKey: ["activePlanDetails"] });
        queryClient.invalidateQueries({ queryKey: ["todayContainerPlans"] });
        queryClient.invalidateQueries({ queryKey: ["todayPlans"] });

        // 모드에 따른 리다이렉트
        if (mode === "camp") {
          // 캠프 모드: /camp/today로 리다이렉트
          const params = new URLSearchParams();
          params.set("completedPlanId", plan.id);
          if (plan.plan_date) {
            params.set("date", plan.plan_date);
          }
          const query = params.toString();
          router.push(query ? `/camp/today?${query}` : "/camp/today");
        } else {
          // Today 모드: /today로 리다이렉트
          const params = new URLSearchParams();
          params.set("completedPlanId", plan.id);
          if (plan.plan_date) {
            params.set("date", plan.plan_date);
          }
          const query = params.toString();
          router.push(query ? `/today?${query}` : "/today");
        }
      } else {
        setErrors({ general: result.error || "플랜 완료에 실패했습니다." });
        showError(result.error || "플랜 완료에 실패했습니다.");
        setIsCompleting(false);
      }
    } catch (error) {
      console.error("[PlanExecutionForm] 완료 처리 오류:", error);
      setErrors({ general: "오류가 발생했습니다." });
      showError("오류가 발생했습니다.");
      setIsCompleting(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostponeConfirm = async () => {
    setShowPostponeConfirm(false);
    setIsLoading(true);
    setErrors({});

    try {
      const result = await postponePlan(plan.id);

      if (result.success) {
        const params = new URLSearchParams();
        if (plan.plan_date) {
          params.set("date", plan.plan_date);
        }
        const query = params.toString();

        // 모드에 따른 리다이렉트 분기
        if (mode === "camp") {
          router.push(query ? `/camp/today?${query}` : "/camp/today");
        } else {
          router.push(query ? `/today?${query}` : "/today");
        }
      } else {
        setErrors({ general: result.error || "플랜 미루기에 실패했습니다." });
        showError(result.error || "플랜 미루기에 실패했습니다.");
      }
    } catch (error) {
      setErrors({ general: "오류가 발생했습니다." });
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostpone = () => {
    setShowPostponeConfirm(true);
  };

  // 상태 D: 이미 완료됨
  if (isAlreadyCompleted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-md">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <StatusBadge status="COMPLETED" size="lg" />
            <span className="text-base font-bold text-emerald-900">이 플랜은 이미 완료되었습니다.</span>
            <p className="text-sm text-emerald-700">아래에서 완료된 학습 기록을 확인할 수 있습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  // 상태 C: 완료 처리 중
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

  // 상태 B: 미완료 + 활성 세션 있음
  if (hasActiveSession) {
    return (
      <div className="space-y-4">
        {errors.general && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-white p-5 shadow-md">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge status="RUNNING" size="md" />
              <h3 className="text-base font-bold text-yellow-900">현재 이 플랜의 타이머가 실행 중이에요</h3>
            </div>
            <p className="text-sm text-yellow-800">
              학습 기록을 입력하려면 먼저 타이머를 종료해야 합니다.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleClearSession}
              disabled={isClearingSession || isLoading}
              className="flex-1 rounded-lg bg-yellow-600 px-4 py-3 text-base font-bold text-white shadow-md transition hover:bg-yellow-700 hover:shadow-lg disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
            >
              {isClearingSession ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  타이머 정리 중...
                </span>
              ) : (
                "타이머 정리 후 기록하기"
              )}
            </button>
            <button
              onClick={() => {
                const basePath = mode === "camp" ? "/camp/today" : "/today";
                const params = new URLSearchParams();
                if (plan.plan_date) {
                  params.set("date", plan.plan_date);
                }
                const query = params.toString();
                router.push(query ? `${basePath}?${query}` : basePath);
              }}
              disabled={isClearingSession || isLoading}
              className="flex-1 rounded-lg border-2 border-yellow-300 bg-white px-4 py-3 text-base font-bold text-yellow-700 transition hover:bg-yellow-50 disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
            >
              타이머 확인하러 가기
            </button>
          </div>
        </div>

        {/* 학습 기록 폼 (비활성화) - 타이머 정리 전까지 비활성화 */}
        <div className="flex flex-col gap-4 opacity-50">
          <h2 className="text-lg font-semibold text-gray-900">학습 기록</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                시작 {unitLabel}
              </label>
              <input
                type="number"
                value={startPageOrTime}
                disabled
                className="w-full rounded-lg border-2 border-gray-300 bg-gray-100 px-4 py-3 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                종료 {unitLabel}
              </label>
              <input
                type="number"
                value={endPageOrTime}
                disabled
                className="w-full rounded-lg border-2 border-gray-300 bg-gray-100 px-4 py-3 text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                메모 (선택)
              </label>
              <textarea
                value={memo}
                disabled
                className="w-full rounded-lg border-2 border-gray-300 bg-gray-100 px-4 py-3 text-base"
                rows={3}
              />
            </div>
          </div>
          <div>
            <button
              disabled
              className="w-full rounded-lg bg-gray-400 px-4 py-3 text-base font-semibold text-white"
            >
              완료 확정
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 상태 4: 미완료 + 활성 세션 없음
  return (
    <div className="space-y-4">
      {errors.general && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      {/* 학습 기록 폼 (Primary Action) - 시각적으로 가장 강조 */}
      <div className="flex flex-col gap-5 rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">학습 기록</h2>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            필수
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900">
            {mode === "camp" 
              ? "이 캠프 세션에서 실제로 학습한 범위를 입력해 주세요."
              : "이번 플랜에서 실제로 학습한 범위를 입력해 주세요."}
          </p>
          <p className="text-xs text-gray-600">
            {mode === "camp" 
              ? "입력한 내용은 현재 블록의 학습 결과로 기록됩니다."
              : "입력한 내용은 오늘의 학습 기록으로 저장되며 나중에 다시 확인할 수 있습니다."}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              시작 {unitLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={startPageOrTime}
              onChange={(e) => {
                setStartPageOrTime(e.target.value);
                if (errors.startPageOrTime) {
                  setErrors((prev) => ({ ...prev, startPageOrTime: undefined }));
                }
              }}
              className={`w-full rounded-lg border-2 px-4 py-3 text-base font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                errors.startPageOrTime
                  ? "border-red-400 bg-red-50 focus:ring-red-500"
                  : "border-gray-300 bg-white focus:border-indigo-500"
              }`}
              placeholder="시작 값을 입력하세요"
            />
            {errors.startPageOrTime && (
              <p className="text-sm font-medium text-red-600">{errors.startPageOrTime}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              종료 {unitLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={endPageOrTime}
              onChange={(e) => {
                setEndPageOrTime(e.target.value);
                if (errors.endPageOrTime) {
                  setErrors((prev) => ({ ...prev, endPageOrTime: undefined }));
                }
              }}
              className={`w-full rounded-lg border-2 px-4 py-3 text-base font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                errors.endPageOrTime
                  ? "border-red-400 bg-red-50 focus:ring-red-500"
                  : "border-gray-300 bg-white focus:border-indigo-500"
              }`}
              placeholder="종료 값을 입력하세요"
            />
            {errors.endPageOrTime && (
              <p className="text-sm font-medium text-red-600">{errors.endPageOrTime}</p>
            )}
            <p className="text-xs text-gray-500">
              {mode === "camp" 
                ? "해당 블록에서 실제로 완료한 학습 범위를 입력하세요. 시작 값은 0 이상이어야 하며, 종료 값은 시작 값 이상이어야 합니다. 다른 블록의 상태는 변경되지 않습니다."
                : "플랜에서 실제로 학습한 시작·종료 범위를 입력하세요. 시작 값은 0 이상이어야 하며, 종료 값은 시작 값 이상이어야 합니다."}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              메모 {mode === "camp" ? "(선택 입력)" : "(선택)"}
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-base font-medium transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              rows={3}
              placeholder={mode === "camp" 
                ? "캠프 진행 중 느낀 점이나 필요했던 보완 학습을 기록해 두면 다음 블록 학습에 도움이 됩니다."
                : "선택사항: 학습 중 느낀 점이나 중요한 내용을 적어 두면 복습에 도움이 됩니다."}
            />
          </div>
        </div>
      </div>

      {/* 상태 A 안내 메시지 */}
      <div className="flex flex-col gap-1 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
        <p className="text-sm font-medium text-indigo-900">
          이 플랜의 학습이 종료되었습니다.
        </p>
        <p className="text-xs text-indigo-700">
          이제 실제로 학습한 범위를 입력하고 완료를 확정해 주세요.
        </p>
      </div>

      {/* Primary CTA: 완료 확정 - 가장 눈에 띄는 버튼 (모바일 터치 친화적: 최소 44px 높이) */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={handleComplete}
          disabled={isLoading || isCompleting}
          className="flex-1 rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:from-green-700 hover:to-green-800 hover:shadow-xl disabled:opacity-50 disabled:hover:shadow-lg active:scale-[0.98] min-h-[44px]"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              처리 중...
            </span>
          ) : (
            mode === "camp" ? "블록 완료 확정" : "완료 확정"
          )}
        </button>
      </div>

      {/* 타이머 · 일정 제어 (Secondary) - 덜 눈에 띄게 표시 */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-gray-700">타이머 · 일정 제어</h2>
          <p className="text-xs text-gray-500">타이머를 다시 실행하거나 일정 조정이 필요할 때 사용하세요.</p>
        </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
            >
              타이머 다시 실행
            </button>
            {plan.is_reschedulable && (
              <button
                onClick={handlePostpone}
                disabled={isLoading}
                className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 active:scale-[0.98] min-h-[44px]"
              >
                오늘 일정 미루기
              </button>
            )}
          </div>
        </div>


      {/* 연결된 학습 블록 (Secondary) - 덜 눈에 띄게 표시 */}
      {relatedPlans.length > 1 && (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-gray-700">연결된 학습 블록</h3>
            <p className="text-xs text-gray-500">
                {mode === "camp" 
                  ? "이 캠프 내에서 이어지는 학습 블록들이에요. 현재 블록만 완료되며, 다른 블록의 상태는 변경되지 않습니다."
                  : "같은 플랜 번호로 묶인 블록들이에요. 이 페이지에서 완료 처리되는 것은 현재 블록만이며, 다른 블록의 상태는 변경되지 않습니다."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {relatedPlans.map((relatedPlan) => {
                const isCurrent = relatedPlan.id === plan.id;
                const relatedStatus = relatedPlan.actual_end_time
                  ? "COMPLETED"
                  : relatedPlan.actual_start_time
                  ? "RUNNING"
                  : "NOT_STARTED";
                
                return (
                  <div
                    key={relatedPlan.id}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                      isCurrent
                        ? "border-2 border-indigo-300 bg-indigo-50"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">
                        블록 #{relatedPlan.sequence ?? relatedPlan.block_index ?? 0}
                      </span>
                      <span className="text-xs text-gray-500">
                        {relatedPlan.planned_start_page_or_time ?? "-"} ~{" "}
                        {relatedPlan.planned_end_page_or_time ?? "-"} {unitLabel}
                      </span>
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                        현재 블록
                      </span>
                    ) : (
                      <StatusBadge status={relatedStatus} size="sm" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
      )}

      {/* 일정 미루기 확인 다이얼로그 */}
      <ConfirmDialog
        open={showPostponeConfirm}
        onOpenChange={setShowPostponeConfirm}
        title="일정 미루기"
        description="이 플랜을 내일 일정으로 미루시겠습니까? 오늘 학습한 내용은 저장되지 않습니다."
        confirmLabel="미루기"
        cancelLabel="취소"
        onConfirm={handlePostponeConfirm}
        variant="default"
      />
    </div>
  );
}
