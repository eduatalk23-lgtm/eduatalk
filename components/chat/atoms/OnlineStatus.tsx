"use client";

/**
 * OnlineStatus - 온라인 상태 표시
 *
 * 사용자의 접속 상태를 녹색 점으로 표시합니다.
 */

import { memo } from "react";
import { cn } from "@/lib/cn";

interface OnlineStatusProps {
  /** 온라인 여부 */
  isOnline: boolean;
  /** 크기 */
  size?: "sm" | "md";
  /** 추가 클래스 */
  className?: string;
}

function OnlineStatusComponent({
  isOnline,
  size = "sm",
  className,
}: OnlineStatusProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full flex-shrink-0",
        size === "sm" ? "w-2 h-2" : "w-3 h-3",
        isOnline ? "bg-success" : "bg-text-tertiary",
        className
      )}
      aria-label={isOnline ? "온라인" : "오프라인"}
    />
  );
}

export const OnlineStatus = memo(OnlineStatusComponent);
