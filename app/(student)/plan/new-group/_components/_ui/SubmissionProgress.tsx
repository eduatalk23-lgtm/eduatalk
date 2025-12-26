"use client";

/**
 * 제출 진행 상태 표시 컴포넌트
 *
 * 플랜 생성 시 다단계 진행 상태를 시각적으로 표시합니다.
 * - validating: 데이터 검증 중
 * - creating_group: 플랜 그룹 생성 중
 * - generating_plans: 플랜 배치 중
 * - finalizing: 완료 처리 중
 *
 * @module app/(student)/plan/new-group/_components/_ui/SubmissionProgress
 */

import { memo, useMemo } from "react";
import { cn } from "@/lib/cn";

/**
 * 제출 단계 타입
 */
export type SubmissionPhase =
  | "idle"
  | "validating"
  | "creating_group"
  | "generating_plans"
  | "finalizing"
  | "completed"
  | "error";

/**
 * 단계별 메타데이터
 */
const PHASE_METADATA: Record<
  Exclude<SubmissionPhase, "idle">,
  { label: string; description: string; icon: "spinner" | "check" | "error" }
> = {
  validating: {
    label: "검증 중",
    description: "입력 데이터를 검증하고 있습니다",
    icon: "spinner",
  },
  creating_group: {
    label: "그룹 생성",
    description: "플랜 그룹을 생성하고 있습니다",
    icon: "spinner",
  },
  generating_plans: {
    label: "플랜 생성",
    description: "학습 플랜을 생성하고 있습니다",
    icon: "spinner",
  },
  finalizing: {
    label: "마무리 중",
    description: "저장을 완료하고 있습니다",
    icon: "spinner",
  },
  completed: {
    label: "완료",
    description: "플랜 생성이 완료되었습니다",
    icon: "check",
  },
  error: {
    label: "오류 발생",
    description: "플랜 생성 중 오류가 발생했습니다",
    icon: "error",
  },
};

/**
 * 단계 순서 (진행률 계산용)
 */
const PHASE_ORDER: SubmissionPhase[] = [
  "validating",
  "creating_group",
  "generating_plans",
  "finalizing",
  "completed",
];

export type SubmissionProgressProps = {
  /** 현재 제출 단계 */
  phase: SubmissionPhase;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 추가 클래스 */
  className?: string;
  /** 컴팩트 모드 (작은 크기) */
  compact?: boolean;
};

/**
 * 스피너 아이콘
 */
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * 체크 아이콘
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

/**
 * 에러 아이콘
 */
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

/**
 * 진행률 계산
 */
function calculateProgress(phase: SubmissionPhase): number {
  const index = PHASE_ORDER.indexOf(phase);
  if (index === -1) return 0;
  return Math.round(((index + 1) / PHASE_ORDER.length) * 100);
}

/**
 * 컴팩트 모드 컴포넌트
 */
function CompactProgress({
  phase,
  metadata,
}: {
  phase: SubmissionPhase;
  metadata: (typeof PHASE_METADATA)[keyof typeof PHASE_METADATA];
}) {
  return (
    <div className="flex items-center gap-2">
      {metadata.icon === "spinner" && (
        <SpinnerIcon className="h-4 w-4 text-primary-500" />
      )}
      {metadata.icon === "check" && (
        <CheckIcon className="h-4 w-4 text-success-500" />
      )}
      {metadata.icon === "error" && (
        <ErrorIcon className="h-4 w-4 text-error-500" />
      )}
      <span
        className={cn(
          "text-sm font-medium",
          phase === "error" && "text-error-600",
          phase === "completed" && "text-success-600",
          phase !== "error" && phase !== "completed" && "text-gray-700"
        )}
      >
        {metadata.label}
      </span>
    </div>
  );
}

/**
 * 전체 단계 표시 컴포넌트
 */
function FullProgress({
  phase,
  metadata,
  progress,
  errorMessage,
}: {
  phase: SubmissionPhase;
  metadata: (typeof PHASE_METADATA)[keyof typeof PHASE_METADATA];
  progress: number;
  errorMessage?: string;
}) {
  const steps = PHASE_ORDER.slice(0, -1); // completed 제외

  return (
    <div className="w-full space-y-4">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {metadata.icon === "spinner" && (
            <SpinnerIcon className="h-6 w-6 text-primary-500" />
          )}
          {metadata.icon === "check" && (
            <CheckIcon className="h-6 w-6 text-success-500" />
          )}
          {metadata.icon === "error" && (
            <ErrorIcon className="h-6 w-6 text-error-500" />
          )}
          <div>
            <p
              className={cn(
                "text-base font-semibold",
                phase === "error" && "text-error-600",
                phase === "completed" && "text-success-600",
                phase !== "error" && phase !== "completed" && "text-gray-900"
              )}
            >
              {metadata.label}
            </p>
            <p className="text-sm text-gray-500">
              {phase === "error" && errorMessage
                ? errorMessage
                : metadata.description}
            </p>
          </div>
        </div>
        {phase !== "error" && (
          <span className="text-sm font-medium text-gray-500">{progress}%</span>
        )}
      </div>

      {/* 진행 바 */}
      {phase !== "error" && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out",
              phase === "completed" ? "bg-success-500" : "bg-primary-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* 단계 표시 */}
      <div className="flex justify-between">
        {steps.map((stepPhase, index) => {
          const currentIndex = PHASE_ORDER.indexOf(phase);
          const stepIndex = PHASE_ORDER.indexOf(stepPhase);
          const isCompleted = stepIndex < currentIndex || phase === "completed";
          const isCurrent = stepPhase === phase;
          // stepPhase는 PHASE_ORDER에서 온 것이므로 idle이 아님이 보장됨
          const stepMeta = PHASE_METADATA[stepPhase as keyof typeof PHASE_METADATA];

          return (
            <div
              key={stepPhase}
              className={cn(
                "flex flex-col items-center gap-1",
                index === 0 && "items-start",
                index === steps.length - 1 && "items-end"
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isCompleted && "bg-success-500 text-white",
                  isCurrent && !isCompleted && "bg-primary-500 text-white",
                  !isCompleted && !isCurrent && "bg-gray-200 text-gray-500"
                )}
              >
                {isCompleted ? (
                  <CheckIcon className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isCompleted && "text-success-600",
                  isCurrent && !isCompleted && "font-medium text-primary-600",
                  !isCompleted && !isCurrent && "text-gray-400"
                )}
              >
                {stepMeta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionProgressComponent({
  phase,
  errorMessage,
  className,
  compact = false,
}: SubmissionProgressProps) {
  const metadata = useMemo(() => {
    if (phase === "idle") return null;
    return PHASE_METADATA[phase];
  }, [phase]);

  const progress = useMemo(() => calculateProgress(phase), [phase]);

  if (phase === "idle" || !metadata) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg p-4",
        phase === "error" && "bg-error-50",
        phase === "completed" && "bg-success-50",
        phase !== "error" && phase !== "completed" && "bg-gray-50",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy={phase !== "completed" && phase !== "error"}
    >
      {compact ? (
        <CompactProgress phase={phase} metadata={metadata} />
      ) : (
        <FullProgress
          phase={phase}
          metadata={metadata}
          progress={progress}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}

export const SubmissionProgress = memo(SubmissionProgressComponent);
export default SubmissionProgress;
