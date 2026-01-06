"use client";

/**
 * 개별 학생 진행 상황 아이템 컴포넌트
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  SkipForward,
  RotateCcw,
} from "lucide-react";
import type { BatchItemResult, BatchItemStatus } from "../../_types";

interface StudentProgressItemProps {
  result: BatchItemResult;
  onRetry?: (studentId: string) => void;
  canRetry?: boolean;
}

const STATUS_CONFIG: Record<
  BatchItemStatus,
  {
    icon: typeof CheckCircle;
    iconClass: string;
    bgClass: string;
    label: string;
  }
> = {
  pending: {
    icon: Clock,
    iconClass: "text-gray-400",
    bgClass: "bg-gray-50 dark:bg-gray-800/50",
    label: "대기 중",
  },
  processing: {
    icon: Loader2,
    iconClass: "text-blue-500 animate-spin",
    bgClass: "bg-blue-50 dark:bg-blue-900/20",
    label: "처리 중",
  },
  success: {
    icon: CheckCircle,
    iconClass: "text-green-500",
    bgClass: "bg-green-50 dark:bg-green-900/20",
    label: "성공",
  },
  error: {
    icon: XCircle,
    iconClass: "text-red-500",
    bgClass: "bg-red-50 dark:bg-red-900/20",
    label: "실패",
  },
  skipped: {
    icon: SkipForward,
    iconClass: "text-gray-400",
    bgClass: "bg-gray-50 dark:bg-gray-800/50",
    label: "건너뜀",
  },
};

export function StudentProgressItem({
  result,
  onRetry,
  canRetry = true,
}: StudentProgressItemProps) {
  const config = STATUS_CONFIG[result.status];
  const Icon = config.icon;

  // 처리 시간 계산
  const duration =
    result.startedAt && result.completedAt
      ? Math.round(
          (result.completedAt.getTime() - result.startedAt.getTime()) / 1000
        )
      : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3 transition-colors",
        borderInput,
        config.bgClass
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-5 w-5", config.iconClass)} />

        <div>
          <div className={cn("font-medium", textPrimary)}>
            {result.studentName}
          </div>
          {result.message && (
            <div className={cn("text-sm", textSecondary)}>{result.message}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {duration !== null && (
          <span className={cn("text-xs", textSecondary)}>{duration}초</span>
        )}

        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            result.status === "success" &&
              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            result.status === "error" &&
              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            result.status === "processing" &&
              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            result.status === "pending" &&
              "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
            result.status === "skipped" &&
              "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          )}
        >
          {config.label}
        </span>

        {result.status === "error" && canRetry && onRetry && (
          <button
            onClick={() => onRetry(result.studentId)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            <RotateCcw className="h-3 w-3" />
            재시도
          </button>
        )}
      </div>
    </div>
  );
}
