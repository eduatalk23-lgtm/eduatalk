"use client";

/**
 * P3 개선: 플랜 생성 진행률 표시 컴포넌트
 *
 * 플랜 생성 중 각 단계별 진행 상황을 시각적으로 표시합니다.
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { Spinner } from "@/components/atoms/Spinner";
import {
  PlanGenerationStep,
  PlanGenerationProgress as ProgressType,
  STEP_MESSAGES,
} from "@/lib/plan/progress";

export type PlanGenerationProgressProps = {
  /** 현재 진행 상태 */
  progress: ProgressType;
  /** 전체 화면 오버레이 모드 */
  fullScreen?: boolean;
  /** 단계 표시 여부 */
  showSteps?: boolean;
  /** 추가 클래스 */
  className?: string;
};

/**
 * 단계 순서 (표시용)
 */
const DISPLAY_STEPS: { step: PlanGenerationStep; label: string }[] = [
  { step: PlanGenerationStep.VALIDATING, label: "검증" },
  { step: PlanGenerationStep.LOADING_CONTENT, label: "콘텐츠 로드" },
  { step: PlanGenerationStep.CALCULATING_SCHEDULE, label: "스케줄 계산" },
  { step: PlanGenerationStep.GENERATING, label: "플랜 생성" },
  { step: PlanGenerationStep.SAVING, label: "저장" },
];

/**
 * 단계 순서 인덱스
 */
const STEP_ORDER: PlanGenerationStep[] = [
  PlanGenerationStep.INITIALIZING,
  PlanGenerationStep.VALIDATING,
  PlanGenerationStep.LOADING_CONTENT,
  PlanGenerationStep.CALCULATING_SCHEDULE,
  PlanGenerationStep.GENERATING,
  PlanGenerationStep.SAVING,
  PlanGenerationStep.COMPLETED,
];

/**
 * 단계 상태 결정
 */
function getStepStatus(
  step: PlanGenerationStep,
  currentStep: PlanGenerationStep
): "completed" | "current" | "pending" {
  const stepIndex = STEP_ORDER.indexOf(step);
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  if (currentStep === PlanGenerationStep.COMPLETED) {
    return "completed";
  }
  if (currentStep === PlanGenerationStep.ERROR) {
    return stepIndex <= currentIndex ? "current" : "pending";
  }
  if (stepIndex < currentIndex) {
    return "completed";
  }
  if (stepIndex === currentIndex) {
    return "current";
  }
  return "pending";
}

/**
 * 단계 인디케이터 컴포넌트
 */
function StepIndicator({
  step,
  label,
  status,
  isLast,
}: {
  step: PlanGenerationStep;
  label: string;
  status: "completed" | "current" | "pending";
  isLast: boolean;
}) {
  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
            status === "completed" &&
              "bg-success-600 text-white",
            status === "current" &&
              "bg-primary-600 text-white",
            status === "pending" &&
              "bg-[rgb(var(--color-secondary-200))] text-[var(--text-tertiary)]"
          )}
        >
          {status === "completed" ? (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : status === "current" ? (
            <Spinner size="xs" className="text-white" />
          ) : (
            <span>{DISPLAY_STEPS.findIndex((s) => s.step === step) + 1}</span>
          )}
        </div>
        <span
          className={cn(
            "mt-2 text-xs font-medium",
            status === "completed" && "text-success-600",
            status === "current" && "text-primary-600",
            status === "pending" && "text-[var(--text-tertiary)]"
          )}
        >
          {label}
        </span>
      </div>
      {!isLast && (
        <div
          className={cn(
            "mx-2 h-0.5 w-8 sm:w-12",
            status === "completed"
              ? "bg-success-600"
              : "bg-[rgb(var(--color-secondary-200))]"
          )}
        />
      )}
    </div>
  );
}

function PlanGenerationProgressComponent({
  progress,
  fullScreen = false,
  showSteps = true,
  className,
}: PlanGenerationProgressProps) {
  const { currentStep, overallProgress, message, details, error } = progress;
  const isError = currentStep === PlanGenerationStep.ERROR;
  const isCompleted = currentStep === PlanGenerationStep.COMPLETED;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 bg-white dark:bg-[rgb(var(--color-secondary-900))]",
        fullScreen
          ? "fixed inset-0 z-50 p-8"
          : "rounded-lg border border-[rgb(var(--color-secondary-200))] p-6",
        className
      )}
    >
      {/* 단계 표시 */}
      {showSteps && (
        <div className="flex items-start justify-center">
          {DISPLAY_STEPS.map((s, i) => (
            <StepIndicator
              key={s.step}
              step={s.step}
              label={s.label}
              status={getStepStatus(s.step, currentStep)}
              isLast={i === DISPLAY_STEPS.length - 1}
            />
          ))}
        </div>
      )}

      {/* 진행률 바 */}
      <div className="w-full max-w-md">
        <ProgressBar
          value={overallProgress}
          variant={isError ? "error" : isCompleted ? "success" : undefined}
          color={!isError && !isCompleted ? "indigo" : undefined}
          size="md"
          showLabel
        />
      </div>

      {/* 메시지 */}
      <div className="text-center">
        <p
          className={cn(
            "text-body-2 font-medium",
            isError && "text-error-600",
            isCompleted && "text-success-600",
            !isError && !isCompleted && "text-[var(--text-primary)]"
          )}
        >
          {message}
        </p>
        {details && (
          <p className="mt-1 text-caption-1 text-[var(--text-tertiary)]">
            {details}
          </p>
        )}
        {error && (
          <p className="mt-2 text-caption-1 text-error-500">
            {error.message}
          </p>
        )}
      </div>

      {/* 스피너 (진행 중일 때만) */}
      {!isError && !isCompleted && (
        <Spinner size="md" className="mt-2" />
      )}

      {/* 완료 아이콘 */}
      {isCompleted && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
          <svg
            className="h-6 w-6 text-success-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      {/* 오류 아이콘 */}
      {isError && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-100">
          <svg
            className="h-6 w-6 text-error-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export const PlanGenerationProgress = memo(PlanGenerationProgressComponent);
export default PlanGenerationProgress;
