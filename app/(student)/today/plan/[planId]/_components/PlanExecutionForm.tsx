"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plan } from "@/lib/data/studentPlans";
import { Book, Lecture, CustomContent } from "@/lib/data/studentContents";
import { StudySession } from "@/lib/data/studentSessions";
import { startPlan, completePlan, postponePlan, preparePlanCompletion } from "@/app/(student)/today/actions/todayActions";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { StatusBadge } from "@/app/(student)/today/_components/timer/StatusBadge";

type PlanExecutionFormProps = {
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
  plan,
  content,
  activeSession,
  unitLabel,
  relatedPlans,
}: PlanExecutionFormProps) {
  const router = useRouter();
  const timerStore = usePlanTimerStore();
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
        return;
      }

      setHasActiveSession(false);
      // 타이머 스토어에서 제거
      timerStore.removeTimer(plan.id);
      router.refresh();
    } catch (error) {
      console.error("[PlanExecutionForm] 타이머 정리 오류:", error);
      setErrors({ general: "오류가 발생했습니다." });
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
      }
    } catch (error) {
      setErrors({ general: "오류가 발생했습니다." });
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
        
        const params = new URLSearchParams();
        params.set("completedPlanId", plan.id);
        if (plan.plan_date) {
          params.set("date", plan.plan_date);
        }
        const query = params.toString();
        router.push(query ? `/today?${query}` : "/today");
        router.refresh();
      } else {
        setErrors({ general: result.error || "플랜 완료에 실패했습니다." });
        setIsCompleting(false);
      }
    } catch (error) {
      console.error("[PlanExecutionForm] 완료 처리 오류:", error);
      setErrors({ general: "오류가 발생했습니다." });
      setIsCompleting(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostpone = async () => {
    if (!confirm("이 플랜을 내일로 미루시겠습니까?")) {
      return;
    }

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
        router.push(query ? `/today?${query}` : "/today");
        router.refresh();
      } else {
        setErrors({ general: result.error || "플랜 미루기에 실패했습니다." });
      }
    } catch (error) {
      setErrors({ general: "오류가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  // 상태 1: 이미 완료됨
  if (isAlreadyCompleted) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center justify-center gap-2">
            <StatusBadge status="COMPLETED" size="md" />
            <span className="text-sm font-semibold text-emerald-900">이 플랜은 이미 완료되었습니다.</span>
          </div>
        </div>
      </div>
    );
  }

  // 상태 2: 완료 처리 중
  if (isCompleting) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50 p-4 text-center text-sm font-semibold text-indigo-700">
          완료 데이터를 정리하고 있어요...
        </div>
      </div>
    );
  }

  // 상태 3: 미완료 + 활성 세션 있음
  if (hasActiveSession) {
    return (
      <div className="space-y-4">
        {errors.general && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-yellow-900">타이머 실행 중</h3>
            <p className="mt-1 text-sm text-yellow-700">
              현재 이 플랜의 타이머가 실행 중입니다. 먼저 타이머를 정리한 후 학습 기록을 입력할 수 있어요.
            </p>
          </div>
          <button
            onClick={handleClearSession}
            disabled={isClearingSession || isLoading}
            className="w-full rounded-lg bg-yellow-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-yellow-700 disabled:opacity-50"
          >
            {isClearingSession ? "타이머 정리 중..." : "타이머 정리 후 기록하기"}
          </button>
        </div>

        {/* 학습 기록 폼 (비활성화) */}
        <div className="opacity-50">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">학습 기록</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                시작 {unitLabel}
              </label>
              <input
                type="number"
                value={startPageOrTime}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                종료 {unitLabel}
              </label>
              <input
                type="number"
                value={endPageOrTime}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                메모 (선택)
              </label>
              <textarea
                value={memo}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm"
                rows={3}
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              disabled
              className="w-full rounded-lg bg-gray-400 px-4 py-2.5 text-sm font-semibold text-white"
            >
              확인 완료
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

      {/* 타이머 · 일정 제어 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">타이머 · 일정 제어</h2>
            <p className="text-sm text-gray-500">타이머를 다시 실행하거나 일정 조정이 필요할 때 사용하세요.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              타이머 다시 실행
            </button>
            {plan.is_reschedulable && (
              <button
                onClick={handlePostpone}
                disabled={isLoading}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                오늘 일정 미루기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 연결된 학습 블록 */}
      {relatedPlans.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">연결된 학습 블록</h3>
              <p className="mt-1 text-sm text-gray-500">
                이 페이지에서 완료 처리되는 것은 <strong>현재 블록</strong>만입니다. 다른 블록의 상태는 변경되지 않습니다.
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
        </div>
      )}

      {/* 학습 기록 폼 */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">학습 기록</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.startPageOrTime
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
              placeholder="시작 값을 입력하세요"
            />
            {errors.startPageOrTime && (
              <p className="mt-1 text-xs text-red-600">{errors.startPageOrTime}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
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
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.endPageOrTime
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
              placeholder="종료 값을 입력하세요"
            />
            {errors.endPageOrTime && (
              <p className="mt-1 text-xs text-red-600">{errors.endPageOrTime}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              메모 (선택)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="학습 메모를 입력하세요"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={handleComplete}
          disabled={isLoading || isCompleting}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? "처리 중..." : "확인 완료"}
        </button>
      </div>
    </div>
  );
}
