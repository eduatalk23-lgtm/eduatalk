"use client";

/**
 * UX-3: 저장 상태 표시기 컴포넌트
 *
 * Draft 저장 상태를 시각적으로 표시합니다.
 * - 저장됨 (체크 아이콘 + 시간)
 * - 저장 중 (스피너)
 * - 저장 안 됨 (변경 사항 있음)
 * - 에러 (저장 실패)
 */

import { memo, useMemo } from "react";
import { cn } from "@/lib/cn";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved";

export type SaveStatusIndicatorProps = {
  /** 현재 저장 상태 */
  status: SaveStatus;
  /** 마지막 저장 시간 */
  lastSavedAt?: Date | null;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 추가 클래스 */
  className?: string;
  /** 컴팩트 모드 (아이콘만 표시) */
  compact?: boolean;
};

/**
 * 시간을 상대적 형식으로 포맷
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffSeconds < 10) {
    return "방금 전";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}초 전`;
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  // 시:분 형식
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SaveStatusIndicatorComponent({
  status,
  lastSavedAt,
  errorMessage,
  className,
  compact = false,
}: SaveStatusIndicatorProps) {
  const timeDisplay = useMemo(() => {
    if (!lastSavedAt) return null;
    return formatRelativeTime(lastSavedAt);
  }, [lastSavedAt]);

  const content = useMemo(() => {
    switch (status) {
      case "saving":
        return (
          <>
            {/* 스피너 */}
            <svg
              className="h-4 w-4 animate-spin text-primary-500"
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
            {!compact && (
              <span className="text-caption-1 text-[var(--text-tertiary)]">
                저장 중...
              </span>
            )}
          </>
        );

      case "saved":
        return (
          <>
            {/* 체크 아이콘 */}
            <svg
              className="h-4 w-4 text-success-500"
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
            {!compact && (
              <span className="text-caption-1 text-success-600">
                저장됨 {timeDisplay && `· ${timeDisplay}`}
              </span>
            )}
          </>
        );

      case "unsaved":
        return (
          <>
            {/* 수정됨 아이콘 */}
            <svg
              className="h-4 w-4 text-warning-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            {!compact && (
              <span className="text-caption-1 text-warning-600">
                변경 사항 있음
              </span>
            )}
          </>
        );

      case "error":
        return (
          <>
            {/* 에러 아이콘 */}
            <svg
              className="h-4 w-4 text-error-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            {!compact && (
              <span className="text-caption-1 text-error-600">
                {errorMessage || "저장 실패"}
              </span>
            )}
          </>
        );

      case "idle":
      default:
        return null;
    }
  }, [status, timeDisplay, compact, errorMessage]);

  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1",
        status === "saved" && "bg-success-50",
        status === "saving" && "bg-primary-50",
        status === "unsaved" && "bg-warning-50",
        status === "error" && "bg-error-50",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {content}
    </div>
  );
}

export const SaveStatusIndicator = memo(SaveStatusIndicatorComponent);
export default SaveStatusIndicator;
