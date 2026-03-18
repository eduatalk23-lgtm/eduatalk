"use client";

import { cn } from "@/lib/cn";
import type { StorylineStrength } from "@/lib/domains/student-record";

const config: Record<StorylineStrength, { label: string; className: string }> = {
  strong: { label: "강함", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  moderate: { label: "보통", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  weak: { label: "약함", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

type StorylineStrengthBadgeProps = {
  strength: string | null;
};

export function StorylineStrengthBadge({ strength }: StorylineStrengthBadgeProps) {
  if (!strength) return null;
  const c = config[strength as StorylineStrength] ?? config.weak;
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}
