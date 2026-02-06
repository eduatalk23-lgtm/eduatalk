"use client";

/**
 * UnreadBadge - 읽지 않은 메시지 수 배지
 */

import { memo } from "react";
import { cn } from "@/lib/cn";

interface UnreadBadgeProps {
  /** 읽지 않은 메시지 수 */
  count: number;
  /** 크기 */
  size?: "sm" | "md";
  /** 추가 클래스 */
  className?: string;
}

function UnreadBadgeComponent({
  count,
  size = "md",
  className,
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-error-500 text-white font-medium",
        size === "sm" ? "min-w-[18px] h-[18px] text-[10px] px-1" : "min-w-[22px] h-[22px] text-xs px-1.5",
        className
      )}
    >
      {displayCount}
    </span>
  );
}

export const UnreadBadge = memo(UnreadBadgeComponent);
