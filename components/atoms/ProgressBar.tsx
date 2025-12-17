"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

export type ProgressBarVariant = "default" | "success" | "warning" | "error";
export type ProgressBarSize = "xs" | "sm" | "md" | "lg";
export type ProgressBarColor = "blue" | "green" | "indigo" | "orange" | "red" | "purple" | "violet";
export type ProgressBarHeight = "sm" | "md" | "lg"; // ui/ProgressBar 호환성

export type ProgressBarProps = {
  value: number;
  max?: number;
  variant?: ProgressBarVariant;
  color?: ProgressBarColor;
  size?: ProgressBarSize;
  height?: ProgressBarHeight; // ui/ProgressBar 호환성 (size보다 우선)
  showLabel?: boolean;
  showValue?: boolean; // ui/ProgressBar 호환성 (showLabel과 동일)
  className?: string;
  barClassName?: string;
  autoColor?: boolean; // value에 따라 자동으로 색상 결정
};

const variantClasses: Record<ProgressBarVariant, string> = {
  default: "bg-[var(--text-primary)]",
  success: "bg-success-600",
  warning: "bg-warning-500",
  error: "bg-error-600",
};

const colorClasses: Record<ProgressBarColor, string> = {
  blue: "bg-info-500",
  green: "bg-success-600",
  indigo: "bg-primary-600",
  orange: "bg-warning-600",
  red: "bg-error-600",
  purple: "bg-purple-600", // 의도적인 다채로운 색상 (디자인 시스템에 없음)
  violet: "bg-violet-600", // 의도적인 다채로운 색상 (디자인 시스템에 없음)
};

const sizeClasses: Record<ProgressBarSize, string> = {
  xs: "h-1",
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

const heightToSizeMap: Record<ProgressBarHeight, ProgressBarSize> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

function ProgressBarComponent({
  value,
  max = 100,
  variant,
  color,
  size,
  height,
  showLabel = false,
  showValue,
  className,
  barClassName,
  autoColor = false,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // height가 있으면 size로 변환 (height가 우선)
  const finalSize = height ? heightToSizeMap[height] : size || "md";
  const finalShowLabel = showValue !== undefined ? showValue : showLabel;

  // 자동 색상 결정 로직: variant나 color가 없고 autoColor가 true일 때
  let finalColorClass: string;
  if (variant) {
    finalColorClass = variantClasses[variant];
  } else if (color) {
    finalColorClass = colorClasses[color];
  } else if (autoColor) {
    // value에 따라 자동 결정
    const autoColorValue: ProgressBarColor =
      percentage >= 100 ? "green" : percentage >= 50 ? "indigo" : "orange";
    finalColorClass = colorClasses[autoColorValue];
  } else {
    // 기본값
    finalColorClass = variantClasses.default;
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-[rgb(var(--color-secondary-200))]",
          sizeClasses[finalSize]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-base",
            finalColorClass,
            barClassName
          )}
          // 동적 width는 인라인 스타일이 필요 (Tailwind arbitrary values는 빌드 시점에 생성되어야 함)
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`진행률 ${Math.round(percentage)}%`}
        />
      </div>
      {finalShowLabel && (
        <div className="text-right text-xs font-medium text-[var(--text-secondary)]">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
}

export const ProgressBar = memo(ProgressBarComponent);
export default ProgressBar;
