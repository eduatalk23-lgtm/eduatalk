"use client";

import { cn } from "@/lib/cn";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SaveStatusIndicatorProps = {
  status: SaveStatus;
  error?: string;
};

export function SaveStatusIndicator({ status, error }: SaveStatusIndicatorProps) {
  if (status === "idle") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs transition-opacity",
        status === "saving" && "text-[var(--text-tertiary)]",
        status === "saved" && "text-emerald-600 dark:text-emerald-400",
        status === "error" && "text-red-600 dark:text-red-400",
      )}
    >
      {status === "saving" && (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          저장 중...
        </>
      )}
      {status === "saved" && "저장 완료"}
      {status === "error" && (error ?? "저장 실패")}
    </span>
  );
}
