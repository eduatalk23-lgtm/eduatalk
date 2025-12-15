"use client";

import { memo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
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

/**
 * Badge 컴포넌트 스타일 variants
 * 
 * CVA (class-variance-authority)를 사용하여 타입 안전한 variant 시스템 제공
 * Semantic Colors를 활용하여 다크모드 대응
 */
const badgeVariants = cva(
  // Base styles
  "inline-flex items-center rounded-full font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary-100 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-200",
        primary: "bg-secondary-900 dark:bg-secondary-100 text-white dark:text-secondary-900",
        success: "bg-success-100 dark:bg-success-900/30 text-success-800 dark:text-success-300",
        warning: "bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-300",
        error: "bg-error-100 dark:bg-error-900/30 text-error-800 dark:text-error-300",
        info: "bg-info-100 dark:bg-info-900/30 text-info-800 dark:text-info-300",
        gray: "bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400",
      },
      size: {
        xs: "px-1.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-sm",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
);

export type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
} & VariantProps<typeof badgeVariants>;

function BadgeComponent({
  children,
  variant = "default",
  size = "sm",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
    >
      {children}
    </span>
  );
}

export const Badge = memo(BadgeComponent);
export default Badge;
