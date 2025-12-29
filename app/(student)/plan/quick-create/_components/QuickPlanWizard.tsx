"use client";

/**
 * QuickPlanWizard - 빠른 플랜 생성 위저드
 *
 * lib/wizard의 통합 시스템을 사용하는 3단계 위저드
 */

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { createQuickPlan } from "@/lib/domains/plan/actions";

import {
  UnifiedWizardProvider,
  useWizard,
  createQuickWizardData,
  createQuickModeValidators,
  WizardProgress,
  WizardNavigation,
  WizardStepWrapper,
  WizardErrorList,
  type QuickWizardData,
} from "@/lib/wizard";

import { Step1ContentSelection } from "./steps/Step1ContentSelection";
import { Step2Schedule } from "./steps/Step2Schedule";
import { Step3Confirmation } from "./steps/Step3Confirmation";
import type { ContentSourceType, SelectedContent, ScheduleSettings } from "./types";

// ============================================
// Props
// ============================================

interface QuickPlanWizardProps {
  studentId: string;
  tenantId: string | null;
  defaultDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ============================================
// 내부 컴포넌트
// ============================================

interface WizardContentProps {
  studentId: string;
  tenantId: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function WizardContent({
  studentId,
  tenantId,
  onSuccess,
  onCancel,
}: WizardContentProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const {
    data,
    currentStep,
    steps,
    validation,
    isSubmitting,
    updateData,
    nextStep,
    prevStep,
    goToStep,
    setSubmitting,
    canGoNext,
    canGoPrev,
    stepStatus,
  } = useWizard<QuickWizardData>();

  // 콘텐츠 소스 변경
  const handleContentSourceChange = useCallback(
    (source: ContentSourceType) => {
      updateData({
        content: data.content
          ? { ...data.content, source }
          : {
              source,
              title: "",
              isFreeLearning: source === "free",
            },
      } as Partial<QuickWizardData>);
    },
    [data.content, updateData]
  );

  // 콘텐츠 변경
  const handleContentChange = useCallback(
    (content: SelectedContent | null) => {
      if (content) {
        updateData({
          content: {
            source: data.content?.source || "free",
            contentId: content.contentId,
            contentType: content.contentType,
            title: content.title,
            isFreeLearning: content.isFreeLearning,
            freeLearningType: content.freeLearningType,
            estimatedMinutes: content.estimatedMinutes,
            startRange: content.startRange,
            endRange: content.endRange,
          },
        } as Partial<QuickWizardData>);
      } else {
        updateData({ content: null } as Partial<QuickWizardData>);
      }
    },
    [data.content?.source, updateData]
  );

  // 스케줄 변경
  const handleScheduleChange = useCallback(
    (updates: Partial<ScheduleSettings>) => {
      updateData({
        schedule: {
          ...data.schedule,
          ...updates,
        },
      } as Partial<QuickWizardData>);
    },
    [data.schedule, updateData]
  );

  // 제출
  const handleSubmit = useCallback(() => {
    const content = data.content;
    if (!content) {
      showToast("콘텐츠를 선택해주세요.", "error");
      return;
    }

    startTransition(async () => {
      setSubmitting(true);

      try {
        // createQuickPlan 사용 (plan_groups 기반)
        const result = await createQuickPlan({
          title: content.title,
          planDate: data.schedule.planDate,
          estimatedMinutes: content.estimatedMinutes || 30,
          contentId: content.contentId,
          contentType: content.contentType as "book" | "lecture" | "custom" | "free" | undefined,
          contentTitle: content.title,
          rangeStart: content.startRange,
          rangeEnd: content.endRange,
          containerType: "daily",
          isFreeLearning: content.isFreeLearning,
          freeLearningType: content.freeLearningType,
        });

        if (result.success) {
          showToast("플랜이 생성되었습니다!", "success");
          router.refresh();
          onSuccess?.();
        } else {
          showToast(result.error || "플랜 생성에 실패했습니다.", "error");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
        showToast(message, "error");
      } finally {
        setSubmitting(false);
      }
    });
  }, [data.content, data.schedule, showToast, router, onSuccess, setSubmitting]);

  // 기존 타입을 새 타입으로 변환
  const selectedContent: SelectedContent | null = data.content
    ? {
        contentId: data.content.contentId,
        contentType: data.content.contentType,
        title: data.content.title,
        isFreeLearning: data.content.isFreeLearning,
        freeLearningType: data.content.freeLearningType,
        estimatedMinutes: data.content.estimatedMinutes,
        startRange: data.content.startRange,
        endRange: data.content.endRange,
      }
    : null;

  const scheduleSettings: ScheduleSettings = {
    planDate: data.schedule.planDate,
    startTime: data.schedule.startTime,
    endTime: data.schedule.endTime,
    repeatType: data.schedule.repeatType,
    repeatEndDate: data.schedule.repeatEndDate,
    repeatDays: data.schedule.repeatDays,
  };

  const isLastStep = currentStep.id === "confirmation";

  return (
    <div className="flex h-full flex-col">
      {/* Progress */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <WizardProgress
          currentStepId={data.currentStepId}
          steps={steps}
          onStepClick={goToStep}
          getStepStatus={stepStatus}
          compact={false}
        />
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <WizardStepWrapper step={currentStep}>
          {currentStep.id === "content-selection" && (
            <Step1ContentSelection
              studentId={studentId}
              tenantId={tenantId}
              contentSource={(data.content?.source as ContentSourceType) || "free"}
              content={selectedContent}
              onContentSourceChange={handleContentSourceChange}
              onContentChange={handleContentChange}
            />
          )}
          {currentStep.id === "schedule" && (
            <Step2Schedule
              schedule={scheduleSettings}
              content={selectedContent}
              onScheduleChange={handleScheduleChange}
            />
          )}
          {currentStep.id === "confirmation" && (
            <Step3Confirmation
              content={selectedContent}
              schedule={scheduleSettings}
            />
          )}
        </WizardStepWrapper>
      </div>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="mx-6 mb-4">
          <WizardErrorList errors={validation.errors} />
        </div>
      )}

      {/* Navigation */}
      <div className="border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={currentStep.number === 1 ? onCancel : prevStep}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
              "border border-gray-300 text-gray-700 hover:bg-gray-50",
              "dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {currentStep.number === 1 ? "취소" : "이전"}
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canGoNext}
              className={cn(
                "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium",
                "bg-blue-500 text-white hover:bg-blue-600",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || isSubmitting}
              className={cn(
                "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium",
                "bg-green-500 text-white hover:bg-green-600",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {isPending || isSubmitting ? (
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
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function QuickPlanWizard({
  studentId,
  tenantId,
  defaultDate,
  onSuccess,
  onCancel,
}: QuickPlanWizardProps) {
  const initialData = createQuickWizardData({
    defaultDate,
  });

  const validators = createQuickModeValidators();

  return (
    <UnifiedWizardProvider
      initialData={initialData}
      validators={validators as Record<string, (data: QuickWizardData) => { isValid: boolean; errors: { field: string; message: string; severity: "error" | "warning" }[]; warnings: { field: string; message: string; severity: "error" | "warning" }[] }>}
    >
      <WizardContent
        studentId={studentId}
        tenantId={tenantId}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </UnifiedWizardProvider>
  );
}
