"use client";

import { cn } from "@/lib/cn";
import {
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_ORDER,
} from "@/lib/domains/crm/constants";
import type { PipelineStatus } from "@/lib/domains/crm/types";

const statusColors: Record<PipelineStatus, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  contacted: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  consulting_done: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  follow_up: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  registration_in_progress: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  converted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  spam: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function PipelineStatusBadge({
  status,
  className,
}: {
  status: PipelineStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        statusColors[status],
        className
      )}
    >
      {PIPELINE_STATUS_LABELS[status]}
    </span>
  );
}

export { PIPELINE_STATUS_ORDER };
