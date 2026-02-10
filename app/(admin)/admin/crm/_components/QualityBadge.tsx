"use client";

import { cn } from "@/lib/cn";
import type { QualityLevel } from "@/lib/domains/crm/types";

const qualityColors: Record<QualityLevel, string> = {
  hot: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  warm: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  cold: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const qualityLabels: Record<QualityLevel, string> = {
  hot: "HOT",
  warm: "WARM",
  cold: "COLD",
};

export function QualityBadge({
  level,
  className,
}: {
  level: QualityLevel | null | undefined;
  className?: string;
}) {
  if (!level) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap",
        qualityColors[level],
        className
      )}
    >
      {qualityLabels[level]}
    </span>
  );
}
