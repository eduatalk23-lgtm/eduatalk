"use client";

import { cn } from "@/lib/cn";
import { BADGE, STATUS_BADGE, type BadgeColor } from "@/lib/design-tokens/report";

type BadgePriority = "critical" | "high" | "medium" | "low";

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  size?: "xs" | "sm";
  /** STATUS_BADGE 키 → 자동 색상 (planning/confirmed/in_progress/completed/recommended) */
  status?: string;
  /** critical→red, high→amber, medium→blue, low→gray */
  priority?: BadgePriority;
  className?: string;
}

const PRIORITY_COLOR: Record<BadgePriority, BadgeColor> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "gray",
};

const SIZE_CLASSES = {
  xs: "px-1.5 py-0.5 text-xs",
  sm: "px-2 py-0.5 text-xs",
} as const;

/**
 * 생기부 도메인 공용 배지 컴포넌트
 * lib/design-tokens/report.ts의 BADGE/STATUS_BADGE 토큰 재사용
 */
export function Badge({
  children,
  color,
  size = "sm",
  status,
  priority,
  className,
}: BadgeProps) {
  let colorClass: string;

  if (status !== undefined && STATUS_BADGE[status]) {
    colorClass = STATUS_BADGE[status];
  } else if (priority !== undefined) {
    colorClass = BADGE[PRIORITY_COLOR[priority]];
  } else {
    colorClass = BADGE[color ?? "gray"];
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        SIZE_CLASSES[size],
        colorClass,
        className,
      )}
    >
      {children}
    </span>
  );
}
