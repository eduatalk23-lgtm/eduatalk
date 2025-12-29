"use client";

/**
 * 플랜 진행률 배지 컴포넌트
 *
 * 실시간 진행률과 상태를 시각적으로 표시합니다.
 */

import { cn } from "@/lib/cn";

type PlanStatus = "pending" | "in_progress" | "completed" | "skipped" | "postponed";

type PlanProgressBadgeProps = {
  /** 진행률 (0-100) */
  progress: number;
  /** 플랜 상태 */
  status?: PlanStatus | string | null;
  /** 콤팩트 모드 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
};

const statusConfig: Record<
  PlanStatus,
  { label: string; bgClass: string; textClass: string }
> = {
  pending: {
    label: "대기",
    bgClass: "bg-gray-100 dark:bg-gray-800",
    textClass: "text-gray-600 dark:text-gray-400",
  },
  in_progress: {
    label: "진행중",
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  completed: {
    label: "완료",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-600 dark:text-green-400",
  },
  skipped: {
    label: "건너뜀",
    bgClass: "bg-orange-100 dark:bg-orange-900/30",
    textClass: "text-orange-600 dark:text-orange-400",
  },
  postponed: {
    label: "미루기",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-600 dark:text-yellow-400",
  },
};

function getProgressColor(progress: number): string {
  if (progress >= 100) return "bg-green-500";
  if (progress >= 75) return "bg-blue-500";
  if (progress >= 50) return "bg-indigo-500";
  if (progress >= 25) return "bg-yellow-500";
  return "bg-gray-400";
}

export function PlanProgressBadge({
  progress,
  status,
  compact = false,
  className,
}: PlanProgressBadgeProps) {
  const normalizedStatus = (status as PlanStatus) || "pending";
  const config = statusConfig[normalizedStatus] || statusConfig.pending;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  if (compact) {
    // 콤팩트 모드: 진행률 바 + 퍼센트
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={cn(
              "absolute left-0 top-0 h-full rounded-full transition-all duration-300",
              getProgressColor(clampedProgress)
            )}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {Math.round(clampedProgress)}%
        </span>
      </div>
    );
  }

  // 기본 모드: 상태 배지 + 진행률 바
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* 상태 배지 */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            config.bgClass,
            config.textClass
          )}
        >
          {config.label}
        </span>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {Math.round(clampedProgress)}%
        </span>
      </div>
      {/* 진행률 바 */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all duration-300",
            getProgressColor(clampedProgress)
          )}
          style={{ width: `${clampedProgress}%` }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

/**
 * 플랜 우선순위 표시
 *
 * 시간 기반 또는 명시적 우선순위를 표시합니다.
 */
type PlanPriorityIndicatorProps = {
  /** 시작 시간 (HH:mm) */
  startTime?: string | null;
  /** 블록 인덱스 (순서) */
  blockIndex?: number;
  /** 명시적 우선순위 레벨 (높을수록 우선) */
  priorityLevel?: "high" | "medium" | "low";
  /** 콤팩트 모드 */
  compact?: boolean;
  className?: string;
};

const priorityConfig = {
  high: {
    label: "높음",
    icon: "🔴",
    bgClass: "bg-red-100 dark:bg-red-900/30",
    textClass: "text-red-600 dark:text-red-400",
    borderClass: "border-red-300 dark:border-red-700",
  },
  medium: {
    label: "보통",
    icon: "🟡",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-600 dark:text-yellow-400",
    borderClass: "border-yellow-300 dark:border-yellow-700",
  },
  low: {
    label: "낮음",
    icon: "🟢",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-600 dark:text-green-400",
    borderClass: "border-green-300 dark:border-green-700",
  },
};

/**
 * 시간 기반 우선순위 계산
 *
 * 오전 시간대는 높은 우선순위, 저녁은 낮은 우선순위
 */
function calculatePriorityFromTime(
  startTime: string | null | undefined
): "high" | "medium" | "low" {
  if (!startTime) return "medium";

  const [hours] = startTime.split(":").map(Number);

  if (hours < 12) return "high"; // 오전
  if (hours < 17) return "medium"; // 오후
  return "low"; // 저녁
}

export function PlanPriorityIndicator({
  startTime,
  blockIndex,
  priorityLevel,
  compact = false,
  className,
}: PlanPriorityIndicatorProps) {
  // 명시적 우선순위가 없으면 시간 기반으로 계산
  const priority = priorityLevel || calculatePriorityFromTime(startTime);
  const config = priorityConfig[priority];

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center",
          className
        )}
        title={`우선순위: ${config.label}`}
      >
        {config.icon}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        config.bgClass,
        config.textClass,
        config.borderClass,
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {blockIndex !== undefined && (
        <span className="opacity-60">#{blockIndex + 1}</span>
      )}
    </div>
  );
}
