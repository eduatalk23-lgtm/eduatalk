"use client";

import { cn } from "@/lib/cn";

type CircularProgressProps = {
  percentage: number;
  size?: "sm" | "md" | "lg";
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
  children?: React.ReactNode;
};

const sizeMap = {
  sm: { dimension: 48, fontSize: "text-xs" },
  md: { dimension: 80, fontSize: "text-sm" },
  lg: { dimension: 120, fontSize: "text-lg" },
};

export function CircularProgress({
  percentage,
  size = "md",
  strokeWidth = 4,
  className,
  showPercentage = false,
  children,
}: CircularProgressProps) {
  const { dimension, fontSize } = sizeMap[size];
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: dimension, height: dimension }}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`진행률 ${percentage}%`}
    >
      <svg
        width={dimension}
        height={dimension}
        className="rotate-[-90deg]"
      >
        {/* 배경 원 */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        {/* 진행률 원 */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-indigo-600 transition-all duration-300 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <span className={cn("font-semibold text-gray-900", fontSize)}>
            {Math.round(percentage)}%
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

