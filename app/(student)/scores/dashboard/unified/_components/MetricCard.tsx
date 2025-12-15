"use client";

import { cn } from "@/lib/cn";
import { getMetricCardColorClasses, getMetricCardValueColorClasses } from "@/lib/utils/darkMode";

type MetricCardProps = {
  label: string;
  value: string | number;
  color?: "indigo" | "purple" | "blue" | "green" | "red" | "orange" | "yellow";
  className?: string;
};

export function MetricCard({
  label,
  value,
  color = "indigo",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg p-4",
        getMetricCardColorClasses(color),
        className
      )}
    >
      <div className="text-xs font-medium">{label}</div>
      <div className={cn("text-2xl font-bold", getMetricCardValueColorClasses(color))}>
        {value}
      </div>
    </div>
  );
}

