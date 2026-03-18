"use client";

import { cn } from "@/lib/cn";
import type { RecordStatus } from "@/lib/domains/student-record";

const statusConfig: Record<RecordStatus, { label: string; className: string }> = {
  draft: { label: "초안", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  review: { label: "검토 중", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  final: { label: "확정", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

type RecordStatusBadgeProps = {
  status: string;
};

export function RecordStatusBadge({ status }: RecordStatusBadgeProps) {
  const config = statusConfig[status as RecordStatus] ?? statusConfig.draft;
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}
