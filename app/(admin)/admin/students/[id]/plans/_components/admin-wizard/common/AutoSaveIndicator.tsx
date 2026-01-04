"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import type { AutoSaveStatus } from "../hooks/useAdminAutoSave";

/**
 * AutoSaveIndicator Props
 */
type AutoSaveIndicatorProps = {
  status: AutoSaveStatus;
  lastSavedAt?: Date | null;
  className?: string;
};

/**
 * 마지막 저장 시간을 상대적 시간으로 포맷팅
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 10) return "방금 전";
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffMin < 60) return `${diffMin}분 전`;

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * AutoSaveIndicator
 *
 * 오토세이브 상태를 시각적으로 표시하는 컴포넌트
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/common/AutoSaveIndicator
 */
export const AutoSaveIndicator = memo(function AutoSaveIndicator({
  status,
  lastSavedAt,
  className,
}: AutoSaveIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs transition-opacity",
        status === "idle" && !lastSavedAt && "opacity-0",
        className
      )}
    >
      {/* 상태 아이콘 */}
      {status === "saving" && (
        <>
          <svg
            className="h-3.5 w-3.5 animate-spin text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-blue-600">저장 중...</span>
        </>
      )}

      {status === "saved" && (
        <>
          <svg
            className="h-3.5 w-3.5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-green-600">저장됨</span>
        </>
      )}

      {status === "error" && (
        <>
          <svg
            className="h-3.5 w-3.5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-red-600">저장 실패</span>
        </>
      )}

      {status === "idle" && lastSavedAt && (
        <>
          <svg
            className="h-3.5 w-3.5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-gray-500">
            {formatRelativeTime(lastSavedAt)} 저장됨
          </span>
        </>
      )}
    </div>
  );
});
