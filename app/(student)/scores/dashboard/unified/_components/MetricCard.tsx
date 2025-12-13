"use client";

import { cn } from "@/lib/cn";

type MetricCardProps = {
  label: string;
  value: string | number;
  color?: "indigo" | "purple" | "blue" | "green" | "red" | "orange" | "yellow";
  className?: string;
};

const colorClasses = {
  indigo: "bg-indigo-50 text-indigo-700",
  purple: "bg-purple-50 text-purple-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
  orange: "bg-orange-50 text-orange-700",
  yellow: "bg-yellow-50 text-yellow-700",
};

const valueColorClasses = {
  indigo: "text-indigo-900",
  purple: "text-purple-900",
  blue: "text-blue-900",
  green: "text-green-900",
  red: "text-red-900",
  orange: "text-orange-900",
  yellow: "text-yellow-900",
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
        colorClasses[color],
        className
      )}
    >
      <div className="text-xs font-medium">{label}</div>
      <div className={cn("text-2xl font-bold", valueColorClasses[color])}>
        {value}
      </div>
    </div>
  );
}

