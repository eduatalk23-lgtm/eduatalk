"use client";

/**
 * AdminWizardProgress - 관리자 위저드 진행 표시
 *
 * 관리자 모드에서 사용하는 진행 표시 컴포넌트
 * 참가자 수, 완료 상태 등 추가 정보 표시
 *
 * @module lib/wizard/components/admin/AdminWizardProgress
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import type { WizardStepDefinition, StepStatus } from "../../types";

// ============================================
// 타입 정의
// ============================================

export interface AdminWizardProgressProps {
  /** 모든 단계 정의 */
  steps: WizardStepDefinition[];
  /** 현재 단계 ID */
  currentStepId: string;
  /** 단계별 상태 조회 함수 */
  stepStatus: (stepId: string) => StepStatus;
  /** 참가자 수 */
  participantCount?: number;
  /** 완료된 참가자 수 */
  completedCount?: number;
  /** 추가 클래스명 */
  className?: string;
}

// ============================================
// 아이콘 컴포넌트
// ============================================

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <svg
        className="h-4 w-4 text-white"
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

  if (status === "error") {
    return (
      <svg
        className="h-4 w-4 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01"
        />
      </svg>
    );
  }

  return null;
}

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * AdminWizardProgress
 *
 * 관리자 위저드 진행 상황을 표시하는 컴포넌트
 */
export const AdminWizardProgress = memo(function AdminWizardProgress({
  steps,
  currentStepId,
  stepStatus,
  participantCount,
  completedCount,
  className,
}: AdminWizardProgressProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className={cn("space-y-4", className)}>
      {/* 참가자 정보 */}
      {participantCount !== undefined && (
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              대상 참가자
            </span>
          </div>
          <div className="flex items-center gap-2">
            {completedCount !== undefined && (
              <>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {completedCount}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/</span>
              </>
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {participantCount}명
            </span>
          </div>
        </div>
      )}

      {/* 진행률 바 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600 dark:text-gray-400">
            {steps[currentIndex]?.label || "진행 중"}
          </span>
          <span className="text-gray-500 dark:text-gray-500">
            {currentIndex + 1} / {steps.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-600 motion-safe:transition-all motion-safe:duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 단계 표시 */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = stepStatus(step.id);
          const isCurrent = step.id === currentStepId;

          return (
            <div key={step.id} className="flex flex-col items-center">
              {/* 단계 인디케이터 */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium motion-safe:transition-colors",
                  status === "completed" && "bg-green-600 text-white",
                  status === "error" && "bg-red-600 text-white",
                  status === "current" &&
                    "bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2 dark:ring-blue-700 dark:ring-offset-gray-900",
                  status === "pending" &&
                    "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
                  status === "skipped" &&
                    "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                )}
              >
                {status === "completed" || status === "error" ? (
                  <StepIcon status={status} />
                ) : (
                  step.number
                )}
              </div>

              {/* 단계 레이블 */}
              <span
                className={cn(
                  "mt-1.5 text-[10px] font-medium",
                  isCurrent
                    ? "text-blue-600 dark:text-blue-400"
                    : status === "completed"
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500 dark:text-gray-500"
                )}
              >
                {step.label}
              </span>

              {/* 연결선 */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute top-4 h-0.5 w-full -translate-x-1/2",
                    status === "completed"
                      ? "bg-green-600"
                      : "bg-gray-200 dark:bg-gray-700"
                  )}
                  style={{
                    left: `calc(${((index + 1) / steps.length) * 100}% - 1rem)`,
                    width: `calc(${100 / steps.length}% - 2rem)`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
