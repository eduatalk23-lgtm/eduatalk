"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

export type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

function ErrorStateComponent({
  title = "오류가 발생했습니다",
  description = "잠시 후 다시 시도해주세요.",
  onRetry,
  retryLabel = "다시 시도",
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-red-200 bg-red-50 p-8 text-center",
        className
      )}
    >
      <div className="mx-auto max-w-md">
        <div className="mb-4 text-5xl">⚠️</div>
        <h3 className="mb-2 text-lg font-semibold text-red-900">{title}</h3>
        <p className="mb-6 text-sm text-red-700">{description}</p>
        {onRetry && (
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

