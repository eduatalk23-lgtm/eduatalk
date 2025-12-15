"use client";

import { getStatCardColorClasses } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type StatCardProps = {
  label: string;
  value: string | number;
  color?: "gray" | "green" | "blue" | "indigo" | "red" | "amber" | "purple";
  icon?: React.ReactNode;
};

export function StatCard({ label, value, color = "gray", icon }: StatCardProps) {
  return (
    <div className={cn("rounded-lg p-4", getStatCardColorClasses(color))}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <div className="text-xs font-medium opacity-75">{label}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}

