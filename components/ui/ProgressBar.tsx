import { memo } from "react";
import { cn } from "@/lib/cn";

type ProgressBarProps = {
  value: number; // 0-100
  height?: "sm" | "md" | "lg";
  color?: "blue" | "green" | "indigo" | "orange" | "red";
  showValue?: boolean;
  className?: string;
  barClassName?: string;
};

const heightClasses = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

const colorClasses = {
  blue: "bg-blue-500",
  green: "bg-green-600",
  indigo: "bg-indigo-600",
  orange: "bg-orange-600",
  red: "bg-red-600",
};

function ProgressBarComponent({
  value,
  height = "md",
  color,
  showValue = false,
  className,
  barClassName,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  // color가 지정되지 않으면 value에 따라 자동 결정
  const finalColor =
    color ||
    (clampedValue >= 100
      ? "green"
      : clampedValue >= 50
      ? "indigo"
      : "orange");

  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-gray-200", className)}>
      <div
        className={cn(
          "h-full transition-all duration-300",
          heightClasses[height],
          colorClasses[finalColor],
          barClassName
        )}
        style={{ width: `${clampedValue}%` }}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`진행률 ${clampedValue}%`}
      />
    </div>
  );
}

export const ProgressBar = memo(ProgressBarComponent);

