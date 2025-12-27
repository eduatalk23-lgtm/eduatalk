"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar,
  Clock,
  BookOpen,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { createStudentAdHocPlan } from "@/lib/domains/admin-plan/actions/adHocPlan";
import {
  type QuickPlanWizardState,
  type WizardStep,
  type ContentSourceType,
  type SelectedContent,
  type FreeLearningType,
  initialQuickPlanState,
  FREE_LEARNING_OPTIONS,
  DURATION_OPTIONS,
} from "./types";
import { Step1ContentSelection } from "./steps/Step1ContentSelection";
import { Step2Schedule } from "./steps/Step2Schedule";
import { Step3Confirmation } from "./steps/Step3Confirmation";

interface QuickPlanWizardProps {
  studentId: string;
  tenantId: string | null;
  defaultDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const STEPS = [
  { step: 1, label: "콘텐츠 선택", icon: BookOpen },
  { step: 2, label: "일정 설정", icon: Calendar },
  { step: 3, label: "확인", icon: Check },
] as const;

export function QuickPlanWizard({
  studentId,
  tenantId,
  defaultDate,
  onSuccess,
  onCancel,
}: QuickPlanWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<QuickPlanWizardState>(() => ({
    ...initialQuickPlanState,
    schedule: {
      ...initialQuickPlanState.schedule,
      planDate: defaultDate || new Date().toISOString().slice(0, 10),
    },
  }));

  // Step navigation
  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step, error: null }));
  }, []);

  const goNext = useCallback(() => {
    if (state.step < 3) {
      goToStep((state.step + 1) as WizardStep);
    }
  }, [state.step, goToStep]);

  const goPrev = useCallback(() => {
    if (state.step > 1) {
      goToStep((state.step - 1) as WizardStep);
    }
  }, [state.step, goToStep]);

  // Content selection
  const setContentSource = useCallback((source: ContentSourceType) => {
    setState((prev) => ({ ...prev, contentSource: source }));
  }, []);

  const setContent = useCallback((content: SelectedContent | null) => {
    setState((prev) => ({ ...prev, content }));
  }, []);

  // Schedule update
  const updateSchedule = useCallback(
    (updates: Partial<QuickPlanWizardState["schedule"]>) => {
      setState((prev) => ({
        ...prev,
        schedule: { ...prev.schedule, ...updates },
      }));
    },
    []
  );

  // Validation
  const isStep1Valid = state.content !== null && state.content.title.trim().length > 0;
  const isStep2Valid = !!state.schedule.planDate;

  // Submit
  const handleSubmit = useCallback(() => {
    const content = state.content;
    if (!content) {
      showToast("콘텐츠를 선택해주세요.", "error");
      return;
    }

    startTransition(async () => {
      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      try {
        // 콘텐츠 링크 구성 (기존 콘텐츠 연결 시)
        const contentLink = content.contentId && content.contentType
          ? {
              content_type: content.contentType,
              content_id: content.contentId,
              content_title: content.title,
              range_start: content.startRange || 0,
              range_end: content.endRange || 0,
            }
          : undefined;

        const result = await createStudentAdHocPlan({
          student_id: studentId,
          tenant_id: tenantId ?? "",
          title: content.title,
          description: undefined,
          plan_date: state.schedule.planDate,
          estimated_minutes: content.estimatedMinutes || 30,
          container_type: "daily",
          content_type: content.isFreeLearning
            ? content.freeLearningType || "free"
            : content.contentType || "custom",
          content_link: contentLink,
        });

        if (result.success) {
          showToast("플랜이 생성되었습니다!", "success");
          router.refresh();
          onSuccess?.();
        } else {
          setState((prev) => ({
            ...prev,
            error: result.error || "플랜 생성에 실패했습니다.",
          }));
          showToast(result.error || "플랜 생성에 실패했습니다.", "error");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        setState((prev) => ({ ...prev, error: message }));
        showToast(message, "error");
      } finally {
        setState((prev) => ({ ...prev, isSubmitting: false }));
      }
    });
  }, [state.content, state.schedule, studentId, tenantId, showToast, router, onSuccess]);

  return (
    <div className="flex h-full flex-col">
      {/* Progress Steps */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          {STEPS.map((s, index) => (
            <div key={s.step} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (s.step < state.step) goToStep(s.step);
                }}
                disabled={s.step > state.step}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  state.step === s.step
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : state.step > s.step
                    ? "cursor-pointer text-green-600 hover:bg-green-50 dark:text-green-400"
                    : "cursor-not-allowed text-gray-400 dark:text-gray-500"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    state.step === s.step
                      ? "bg-blue-500 text-white"
                      : state.step > s.step
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500 dark:bg-gray-700"
                  )}
                >
                  {state.step > s.step ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    s.step
                  )}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 w-8 sm:w-12",
                    state.step > s.step
                      ? "bg-green-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {state.step === 1 && (
          <Step1ContentSelection
            studentId={studentId}
            tenantId={tenantId}
            contentSource={state.contentSource}
            content={state.content}
            onContentSourceChange={setContentSource}
            onContentChange={setContent}
          />
        )}
        {state.step === 2 && (
          <Step2Schedule
            schedule={state.schedule}
            content={state.content}
            onScheduleChange={updateSchedule}
          />
        )}
        {state.step === 3 && (
          <Step3Confirmation
            content={state.content}
            schedule={state.schedule}
          />
        )}
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="mx-6 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {state.error}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={state.step === 1 ? onCancel : goPrev}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
            "border border-gray-300 text-gray-700 hover:bg-gray-50",
            "dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          {state.step === 1 ? "취소" : "이전"}
        </button>

        {state.step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={state.step === 1 ? !isStep1Valid : !isStep2Valid}
            className={cn(
              "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium",
              "bg-blue-500 text-white hover:bg-blue-600",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || state.isSubmitting}
            className={cn(
              "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium",
              "bg-green-500 text-white hover:bg-green-600",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isPending || state.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                플랜 생성
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
