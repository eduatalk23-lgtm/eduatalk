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
        "rounded-xl border border-red-200 bg-red-50 p-8 md:p-12 text-center",
        className
      )}
    >
      <div className="mx-auto flex flex-col gap-4 max-w-md">
        <div className="text-5xl md:text-6xl">{icon}</div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-red-900">{title}</h3>
          <p className="text-sm text-red-700">{displayMessage}</p>
        </div>
        {/* actionHref가 있으면 Link 사용, onRetry가 있으면 Button 사용 */}
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            {actionLabel}
          </Link>
        )}
        {onRetry && !actionHref && (
          <Button variant="destructive" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export const ErrorState = memo(ErrorStateComponent);
export default ErrorState;

