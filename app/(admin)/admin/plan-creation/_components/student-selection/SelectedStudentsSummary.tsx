"use client";

/**
 * 선택된 학생 요약 컴포넌트
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import { CheckCircle2, X } from "lucide-react";

interface SelectedStudentsSummaryProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
}

export function SelectedStudentsSummary({
  selectedCount,
  totalCount,
  onClearSelection,
}: SelectedStudentsSummaryProps) {
  const percentage = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-4",
        borderInput,
        selectedCount > 0
          ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
          : "bg-gray-50 dark:bg-gray-800/50"
      )}
    >
      <div className="flex items-center gap-3">
        <CheckCircle2
          className={cn(
            "h-5 w-5",
            selectedCount > 0
              ? "text-indigo-600 dark:text-indigo-400"
              : "text-gray-400"
          )}
        />
        <div>
          <p className={cn("font-medium", textPrimary)}>
            {selectedCount > 0 ? (
              <>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {selectedCount}명
                </span>{" "}
                선택됨
              </>
            ) : (
              "학생을 선택해주세요"
            )}
          </p>
          {selectedCount > 0 && (
            <p className={cn("text-sm", textSecondary)}>
              전체 {totalCount}명 중 {percentage}%
            </p>
          )}
        </div>
      </div>

      {selectedCount > 0 && (
        <button
          onClick={onClearSelection}
          className={cn(
            "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            "text-gray-600 dark:text-gray-300",
            "hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
        >
          <X className="h-4 w-4" />
          선택 해제
        </button>
      )}
    </div>
  );
}
