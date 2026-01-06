"use client";

/**
 * 진행률 바 컴포넌트
 * 배치 처리 진행 상황을 시각적으로 표시
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";

interface ProgressBarProps {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  skipped: number;
  showDetails?: boolean;
}

export function ProgressBar({
  total,
  completed,
  successful,
  failed,
  skipped,
  showDetails = true,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const successPercentage = total > 0 ? (successful / total) * 100 : 0;
  const failedPercentage = total > 0 ? (failed / total) * 100 : 0;
  const skippedPercentage = total > 0 ? (skipped / total) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* 메인 진행률 바 */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        {/* 성공 */}
        <div
          className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
          style={{ width: `${successPercentage}%` }}
        />
        {/* 실패 */}
        <div
          className="absolute top-0 h-full bg-red-500 transition-all duration-300"
          style={{
            left: `${successPercentage}%`,
            width: `${failedPercentage}%`,
          }}
        />
        {/* 건너뜀 */}
        <div
          className="absolute top-0 h-full bg-gray-400 transition-all duration-300"
          style={{
            left: `${successPercentage + failedPercentage}%`,
            width: `${skippedPercentage}%`,
          }}
        />
      </div>

      {/* 진행률 텍스트 */}
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-medium", textPrimary)}>
          {percentage}% 완료 ({completed}/{total})
        </span>

        {showDetails && completed > 0 && (
          <div className="flex items-center gap-4 text-xs">
            {successful > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                성공 {successful}
              </span>
            )}
            {failed > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                실패 {failed}
              </span>
            )}
            {skipped > 0 && (
              <span className={cn("flex items-center gap-1", textSecondary)}>
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                건너뜀 {skipped}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
