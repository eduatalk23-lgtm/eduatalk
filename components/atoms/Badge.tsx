"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "gray";

export type BadgeSize = "xs" | "sm" | "md" | "lg";

export type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  primary: "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900",
  success: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  error: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  gray: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

const sizeClasses: Record<BadgeSize, string> = {
  xs: "px-1.5 py-0.5 text-xs",
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-sm",
};

function BadgeComponent({
  children,
  variant = "default",
  size = "sm",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export const Badge = memo(BadgeComponent);
export default Badge;

