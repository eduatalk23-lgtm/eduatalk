import { memo } from "react";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { calculateProgressPercentage, getProgressColor } from "./utils";

interface ProgressIndicatorProps {
  completedCount: number;
  totalCount: number;
  className?: string;
  showPercentage?: boolean;
  compact?: boolean;
}

export const ProgressIndicator = memo(function ProgressIndicator({
  completedCount,
  totalCount,
  className,
  showPercentage = true,
  compact = false,
}: ProgressIndicatorProps) {
  const percentage = calculateProgressPercentage(completedCount, totalCount);
  
  const progressColor = getProgressColor(completedCount, totalCount);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex-1">
          <ProgressBar
            value={percentage}
            height="sm"
            color={progressColor}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
          {showPercentage ? `${percentage}%` : `${completedCount}/${totalCount}`}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-gray-100 bg-gray-50 p-2.5", className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">진행률</span>
          <span className="text-xs font-semibold text-gray-900">
            {completedCount}/{totalCount}개 완료
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar
              value={percentage}
              height="sm"
              color={progressColor}
            />
          </div>
          {showPercentage && (
            <span className="text-xs font-medium text-gray-600">
              {percentage}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// Helper component for step progress (e.g., "① 참여 정보 제출 → ② 플랜 생성 → ③ 학습 시작")
interface StepProgressProps {
  steps: Array<{
    label: string;
    isActive: boolean;
    isCompleted: boolean;
  }>;
  className?: string;
}

export const StepProgress = memo(function StepProgress({ steps, className }: StepProgressProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      {steps.map((step, index) => (
        <>
          <span
            key={`step-${index}`}
            className={cn(
              "transition-colors",
              step.isActive && "font-medium text-indigo-600",
              step.isCompleted && !step.isActive && "text-gray-700",
              !step.isCompleted && !step.isActive && "text-gray-500"
            )}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <span key={`arrow-${index}`} className="text-gray-400">
              →
            </span>
          )}
        </>
      ))}
    </div>
  );
});

