"use client";

import type { ProgressSummary } from "./progressTypes";

interface ProgressSummaryBarProps {
  summary: ProgressSummary;
}

export function ProgressSummaryBar({ summary }: ProgressSummaryBarProps) {
  const { totalCount, completedCount, completionRate } = summary;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-secondary-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-secondary-700">
        완료 {completedCount}/{totalCount} ({completionRate}%)
      </span>
      <div className="flex-1">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary-200">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
