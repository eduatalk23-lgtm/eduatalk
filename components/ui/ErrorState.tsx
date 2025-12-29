"use client";

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

export type ErrorStateProps = {
  title?: string;
  message?: string;
  description?: string; // message와 description 통합 (message 우선)
  actionHref?: string; // Link용
  actionLabel?: string;
  onRetry?: () => void; // Button onClick용
  retryLabel?: string;
  icon?: string;
  className?: string;
};

function ErrorStateComponent({
  title = "오류가 발생했습니다",
  message,
  description = "요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
  actionHref,
  actionLabel,
  onRetry,
  retryLabel = "다시 시도",
  icon = "⚠️",
  className,
}: ErrorStateProps) {
  // message가 있으면 message를 우선 사용, 없으면 description 사용
  const displayMessage = message || description;

  return (
    <div
      className={cn(
        "rounded-xl border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/30 p-8 md:p-12 text-center",
        className
      )}
    >
      <div className="mx-auto flex flex-col gap-4 max-w-md">
        <div className="text-5xl md:text-6xl">{icon}</div>
        <div className="flex flex-col gap-2">
          <h3 className="text-body-1 text-error-900 dark:text-error-100">{title}</h3>
          <p className="text-body-2 text-error-700 dark:text-error-300">{displayMessage}</p>
        </div>
        {/* 액션 버튼들: onRetry와 actionHref가 모두 있을 수 있음 */}
        {(onRetry || (actionLabel && actionHref)) && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* 재시도 버튼 (있으면 항상 표시) */}
            {onRetry && (
              <Button variant="destructive" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {/* 이동 링크 (있으면 항상 표시) */}
            {actionLabel && actionHref && (
              <Link
                href={actionHref}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-base",
                  onRetry
                    ? "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    : "bg-error-600 text-white hover:bg-error-700"
                )}
              >
                {actionLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ErrorState = memo(ErrorStateComponent);
export default ErrorState;

