"use client";

import { cn } from "@/lib/cn";

export type ViewMode = "daily" | "single";

type ViewModeSelectorProps = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
};

export function ViewModeSelector({
  mode,
  onChange,
  className,
}: ViewModeSelectorProps) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border border-gray-200 bg-white p-1",
        className
      )}
    >
      <button
        onClick={() => onChange("single")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
          mode === "single"
            ? "bg-indigo-600 text-white"
            : "text-gray-600 hover:bg-gray-50"
        )}
      >
        <span>📌</span>
        <span>단일 뷰</span>
      </button>
      <button
        onClick={() => onChange("daily")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
          mode === "daily"
            ? "bg-indigo-600 text-white"
            : "text-gray-600 hover:bg-gray-50"
        )}
      >
        <span>📋</span>
        <span>일일 뷰</span>
      </button>
    </div>
  );
}

