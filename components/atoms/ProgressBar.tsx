"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

export type ProgressBarVariant = "default" | "success" | "warning" | "error";
export type ProgressBarSize = "xs" | "sm" | "md" | "lg";

export type ProgressBarProps = {
  value: number;
  max?: number;
  variant?: ProgressBarVariant;
  size?: ProgressBarSize;
  showLabel?: boolean;
  className?: string;
};

const variantClasses: Record<ProgressBarVariant, string> = {
  default: "bg-gray-900",
  success: "bg-green-600",
  warning: "bg-amber-500",
  error: "bg-red-600",
};

const sizeClasses: Record<ProgressBarSize, string> = {
  xs: "h-1",
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

function ProgressBarComponent({
  value,
  max = 100,
  variant = "default",
  size = "md",
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-gray-200",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right text-xs font-medium text-gray-600">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
}

export const ProgressBar = memo(ProgressBarComponent);
export default ProgressBar;

