"use client";

/**
 * WizardProgressIndicator - 위저드 진행 표시기
 *
 * Phase 4 UX 개선: 네비게이션 플로우
 * 현재 진행 상태를 시각적으로 표시하고 단계 간 이동을 지원합니다.
 */

import { memo, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { WizardStep } from "../PlanGroupWizard";
import { WIZARD_STEPS, TOTAL_STEPS } from "../constants/wizardConstants";

/**
 * 단계 정보
 */
const STEP_INFO: Record<number, { label: string; shortLabel: string }> = {
  1: { label: "기본 정보", shortLabel: "정보" },
  2: { label: "시간 설정", shortLabel: "시간" },
  3: { label: "콘텐츠 선택", shortLabel: "콘텐츠" },
  4: { label: "스케줄 미리보기", shortLabel: "미리보기" },
  5: { label: "학습 범위", shortLabel: "범위" },
  6: { label: "최종 확인", shortLabel: "확인" },
  7: { label: "완료", shortLabel: "완료" },
};

type WizardProgressIndicatorProps = {
  /** 현재 단계 */
  currentStep: WizardStep;
  /** 최대 도달 단계 (클릭 가능 범위) */
  maxReachedStep?: WizardStep;
  /** 단계 클릭 핸들러 */
  onStepClick?: (step: WizardStep) => void;
  /** 클릭 비활성화 */
  disabled?: boolean;
  /** 컴팩트 모드 (모바일용) */
  compact?: boolean;
  /** 에러가 있는 단계들 */
  errorSteps?: WizardStep[];
  /** 완료된 단계들 */
  completedSteps?: WizardStep[];
};

/**
 * WizardProgressIndicator
 *
 * 단계 진행 상태를 표시하는 컴포넌트
 */
export const WizardProgressIndicator = memo(function WizardProgressIndicator({
  currentStep,
  maxReachedStep = currentStep,
  onStepClick,
  disabled = false,
  compact = false,
  errorSteps = [],
  completedSteps = [],
}: WizardProgressIndicatorProps) {
  const handleStepClick = useCallback(
    (step: WizardStep) => {
      if (disabled || !onStepClick) return;
      if (step > maxReachedStep) return;
      onStepClick(step);
    },
    [disabled, maxReachedStep, onStepClick]
  );

  const getStepStatus = (step: number): "current" | "completed" | "error" | "upcoming" | "accessible" => {
    if (step === currentStep) return "current";
    if (errorSteps.includes(step as WizardStep)) return "error";
    if (completedSteps.includes(step as WizardStep)) return "completed";
    if (step < currentStep || step <= maxReachedStep) return "accessible";
    return "upcoming";
  };

  const progressPercentage = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <nav
      className="w-full"
      aria-label="플랜 생성 진행 상태"
      role="navigation"
    >
      {/* 진행률 바 */}
      <div className="relative mb-4">
        <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-1 rounded-full bg-blue-600 transition-all duration-300 ease-out dark:bg-blue-500"
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`진행률 ${Math.round(progressPercentage)}%`}
          />
        </div>
        <span className="sr-only">
          {TOTAL_STEPS}단계 중 {currentStep}단계 진행 중
        </span>
      </div>

      {/* 단계 표시기 */}
      <ol className={cn(
        "flex justify-between",
        compact ? "gap-1" : "gap-2"
      )}>
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
          const step = (index + 1) as WizardStep;
          const status = getStepStatus(step);
          const info = STEP_INFO[step];
          const isClickable = onStepClick && step <= maxReachedStep && !disabled;

          return (
            <li key={step} className="flex-1">
              <button
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={!isClickable}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-lg p-2 transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isClickable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
                  !isClickable && "cursor-default"
                )}
                aria-label={`${step}단계: ${info.label}${status === "current" ? " (현재)" : ""}${status === "completed" ? " (완료)" : ""}${status === "error" ? " (오류 있음)" : ""}`}
                aria-current={status === "current" ? "step" : undefined}
              >
                {/* 단계 번호 원 */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    status === "current" && "bg-blue-600 text-white dark:bg-blue-500",
                    status === "completed" && "bg-green-600 text-white dark:bg-green-500",
                    status === "error" && "bg-red-600 text-white dark:bg-red-500",
                    status === "accessible" && "bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200",
                    status === "upcoming" && "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                  )}
                >
                  {status === "completed" ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : status === "error" ? (
                    <ExclamationIcon className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>

                {/* 단계 레이블 */}
                {!compact && (
                  <span
                    className={cn(
                      "text-xs transition-colors",
                      status === "current" && "font-medium text-blue-600 dark:text-blue-400",
                      status === "completed" && "text-green-600 dark:text-green-400",
                      status === "error" && "text-red-600 dark:text-red-400",
                      status === "accessible" && "text-gray-600 dark:text-gray-400",
                      status === "upcoming" && "text-gray-400 dark:text-gray-500"
                    )}
                  >
                    <span className="hidden sm:inline">{info.label}</span>
                    <span className="sm:hidden">{info.shortLabel}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* 현재 단계 설명 (스크린 리더용) */}
      <div className="sr-only" role="status" aria-live="polite">
        현재 {currentStep}단계: {STEP_INFO[currentStep].label}
      </div>
    </nav>
  );
});

/**
 * 체크 아이콘
 */
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

/**
 * 경고 아이콘
 */
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

/**
 * 단순 진행률 표시 (헤더용)
 */
export function SimpleProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const percentage = ((current - 1) / (total - 1)) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-1.5 rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {current}/{total}
      </span>
    </div>
  );
}
