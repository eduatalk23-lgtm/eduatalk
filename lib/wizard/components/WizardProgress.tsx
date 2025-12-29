"use client";

/**
 * WizardProgress - 통합 위저드 진행 표시기
 *
 * 모든 위저드 모드에서 공통으로 사용하는 진행 상태 표시 컴포넌트
 *
 * @module lib/wizard/components/WizardProgress
 */

import { memo, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { WizardStepDefinition, StepStatus } from "../types";

// ============================================
// 타입
// ============================================

export interface WizardProgressProps {
  /** 현재 단계 ID */
  currentStepId: string;
  /** 모든 단계 정의 */
  steps: WizardStepDefinition[];
  /** 단계 클릭 핸들러 */
  onStepClick?: (stepId: string) => void;
  /** 단계 상태 조회 함수 */
  getStepStatus?: (stepId: string) => StepStatus;
  /** 클릭 비활성화 */
  disabled?: boolean;
  /** 컴팩트 모드 (모바일용) */
  compact?: boolean;
  /** 추가 클래스명 */
  className?: string;
}

// ============================================
// 아이콘 컴포넌트
// ============================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function ExclamationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * WizardProgress
 *
 * 단계 진행 상태를 표시하는 컴포넌트
 */
export const WizardProgress = memo(function WizardProgress({
  currentStepId,
  steps,
  onStepClick,
  getStepStatus,
  disabled = false,
  compact = false,
  className,
}: WizardProgressProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const totalSteps = steps.length;

  const handleStepClick = useCallback(
    (stepId: string) => {
      if (disabled || !onStepClick) return;
      onStepClick(stepId);
    },
    [disabled, onStepClick]
  );

  const defaultGetStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const stepIndex = steps.findIndex((s) => s.id === stepId);
      if (stepId === currentStepId) return "current";
      if (stepIndex < currentIndex) return "completed";
      return "pending";
    },
    [steps, currentStepId, currentIndex]
  );

  const resolvedGetStepStatus = getStepStatus || defaultGetStepStatus;
  const progressPercentage = (currentIndex / (totalSteps - 1)) * 100;

  const currentStep = steps.find((s) => s.id === currentStepId);

  return (
    <nav
      className={cn("w-full", className)}
      aria-label="위저드 진행 상태"
      role="navigation"
    >
      {/* 진행률 바 */}
      <div className="relative mb-4">
        <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-1 rounded-full bg-blue-600 motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out dark:bg-blue-500"
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`진행률 ${Math.round(progressPercentage)}%`}
          />
        </div>
        <span className="sr-only">
          {totalSteps}단계 중 {currentIndex + 1}단계 진행 중
        </span>
      </div>

      {/* 단계 표시기 */}
      <ol className={cn("flex justify-between", compact ? "gap-1" : "gap-2")}>
        {steps.map((step) => {
          const status = resolvedGetStepStatus(step.id);
          const isClickable = onStepClick && status !== "pending" && !disabled;

          return (
            <li key={step.id} className="flex-1">
              <button
                type="button"
                onClick={() => handleStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-lg p-2 motion-safe:transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  isClickable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
                  !isClickable && "cursor-default"
                )}
                aria-label={`${step.number}단계: ${step.label}${status === "current" ? " (현재)" : ""}${status === "completed" ? " (완료)" : ""}${status === "error" ? " (오류 있음)" : ""}`}
                aria-current={status === "current" ? "step" : undefined}
              >
                {/* 단계 번호 원 */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium motion-safe:transition-colors",
                    status === "current" && "bg-blue-600 text-white dark:bg-blue-500",
                    status === "completed" && "bg-green-600 text-white dark:bg-green-500",
                    status === "error" && "bg-red-600 text-white dark:bg-red-500",
                    status === "skipped" && "bg-gray-400 text-white dark:bg-gray-500",
                    status === "pending" && "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                  )}
                >
                  {status === "completed" ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : status === "error" ? (
                    <ExclamationIcon className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </div>

                {/* 단계 레이블 */}
                {!compact && (
                  <span
                    className={cn(
                      "text-xs text-center motion-safe:transition-colors",
                      status === "current" && "font-medium text-blue-600 dark:text-blue-400",
                      status === "completed" && "text-green-600 dark:text-green-400",
                      status === "error" && "text-red-600 dark:text-red-400",
                      status === "skipped" && "text-gray-500 dark:text-gray-400",
                      status === "pending" && "text-gray-400 dark:text-gray-500"
                    )}
                  >
                    {step.label}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* 현재 단계 설명 (스크린 리더용) */}
      <div className="sr-only" role="status" aria-live="polite">
        현재 {currentIndex + 1}단계: {currentStep?.label}
      </div>
    </nav>
  );
});

// ============================================
// 단순 진행률 바
// ============================================

export interface SimpleProgressBarProps {
  /** 현재 단계 (1부터 시작) */
  current: number;
  /** 전체 단계 수 */
  total: number;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * SimpleProgressBar
 *
 * 단순 진행률 표시 (헤더용)
 */
export function SimpleProgressBar({ current, total, className }: SimpleProgressBarProps) {
  const percentage = ((current - 1) / (total - 1)) * 100;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-1.5 rounded-full bg-blue-600 motion-safe:transition-all motion-safe:duration-300 dark:bg-blue-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {current}/{total}
      </span>
    </div>
  );
}
