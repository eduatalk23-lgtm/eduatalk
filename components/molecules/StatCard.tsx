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
    bg: "bg-blue-50",
    label: "text-blue-600",
    value: "text-blue-700",
  },
  purple: {
    bg: "bg-purple-50",
    label: "text-purple-600",
    value: "text-purple-700",
  },
  emerald: {
    bg: "bg-emerald-50",
    label: "text-emerald-600",
    value: "text-emerald-700",
  },
  green: {
    bg: "bg-green-50",
    label: "text-green-600",
    value: "text-green-700",
  },
  red: {
    bg: "bg-red-50",
    label: "text-red-600",
    value: "text-red-700",
  },
  amber: {
    bg: "bg-amber-50",
    label: "text-amber-600",
    value: "text-amber-700",
  },
  indigo: {
    bg: "bg-indigo-50",
    label: "text-indigo-600",
    value: "text-indigo-700",
  },
  teal: {
    bg: "bg-teal-50",
    label: "text-teal-600",
    value: "text-teal-700",
  },
  cyan: {
    bg: "bg-cyan-50",
    label: "text-cyan-600",
    value: "text-cyan-700",
  },
  pink: {
    bg: "bg-pink-50",
    label: "text-pink-600",
    value: "text-pink-700",
  },
  violet: {
    bg: "bg-violet-50",
    label: "text-violet-600",
    value: "text-violet-700",
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

