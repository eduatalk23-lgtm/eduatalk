"use client";

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderDefault } from "@/lib/utils/darkMode";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_COLORS,
  type EnrollmentWithProgram,
} from "@/lib/domains/enrollment/types";
import { formatPrice } from "@/app/(admin)/admin/programs/_components/priceUtils";
import { EnrollmentStatusSelect } from "./EnrollmentStatusSelect";

type ProgramCardProps = {
  enrollment: EnrollmentWithProgram;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
};

export function ProgramCard({
  enrollment,
  isSelected,
  onClick,
  onDelete,
}: ProgramCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-2 text-left transition-colors",
        isSelected
          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/30"
          : cn(borderDefault, "hover:bg-gray-50 dark:hover:bg-gray-700/50")
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isSelected
                ? "text-indigo-700 dark:text-indigo-300"
                : textPrimary
            )}
          >
            {enrollment.program_name}
          </span>
          {enrollment.status !== "active" && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                ENROLLMENT_STATUS_COLORS[enrollment.status]
              )}
            >
              {ENROLLMENT_STATUS_LABELS[enrollment.status]}
            </span>
          )}
        </div>
        <span className={cn("text-[11px]", textSecondary)}>
          {enrollment.start_date}
          {enrollment.end_date && ` ~ ${enrollment.end_date}`}
          {enrollment.price != null &&
            enrollment.price > 0 &&
            ` · ${formatPrice(enrollment.price)}`}
        </span>
      </div>
      {enrollment.status === "active" && (
        <EnrollmentStatusSelect enrollment={enrollment} />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="hidden rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 group-hover:inline-block dark:text-red-400 dark:hover:bg-red-900/20"
      >
        삭제
      </button>
    </div>
  );
}
