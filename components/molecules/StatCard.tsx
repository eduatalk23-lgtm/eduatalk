"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

export type StatCardColor =
  | "blue"
  | "purple"
  | "emerald"
  | "green"
  | "red"
  | "amber"
  | "indigo"
  | "teal"
  | "cyan"
  | "pink"
  | "violet";

export type StatCardProps = {
  label: string;
  value: string | number;
  color?: StatCardColor;
  className?: string;
};

const colorClasses: Record<
  StatCardColor,
  { bg: string; label: string; value: string }
> = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    label: "text-blue-600 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/30",
    label: "text-purple-600 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    label: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/30",
    label: "text-green-600 dark:text-green-400",
    value: "text-green-700 dark:text-green-300",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/30",
    label: "text-red-600 dark:text-red-400",
    value: "text-red-700 dark:text-red-300",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    label: "text-amber-600 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
    label: "text-indigo-600 dark:text-indigo-400",
    value: "text-indigo-700 dark:text-indigo-300",
  },
  teal: {
    bg: "bg-teal-50 dark:bg-teal-900/30",
    label: "text-teal-600 dark:text-teal-400",
    value: "text-teal-700 dark:text-teal-300",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-900/30",
    label: "text-cyan-600 dark:text-cyan-400",
    value: "text-cyan-700 dark:text-cyan-300",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-900/30",
    label: "text-pink-600 dark:text-pink-400",
    value: "text-pink-700 dark:text-pink-300",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-900/30",
    label: "text-violet-600 dark:text-violet-400",
    value: "text-violet-700 dark:text-violet-300",
  },
};

function StatCardComponent({
  label,
  value,
  color = "blue",
  className,
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={cn("rounded-lg p-4", colors.bg, className)}>
      <div className="flex flex-col gap-1">
        <div className={cn("text-sm", colors.label)}>{label}</div>
        <div className={cn("text-2xl font-bold", colors.value)}>{value}</div>
      </div>
    </div>
  );
}

export const StatCard = memo(StatCardComponent);
export default StatCard;

