"use client";

import { memo, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// ============================================
// Card 컴포넌트 (CVA 적용)
// ============================================

/**
 * Card 컴포넌트 스타일 variants
 *
 * CVA (class-variance-authority)를 사용하여 타입 안전한 variant 시스템 제공
 * Material Design Elevation 시스템 (0-24dp) 지원
 */
export type CardElevation = 0 | 1 | 2 | 4 | 8 | 16 | 24;

const elevationClasses: Record<CardElevation, string> = {
  0: "shadow-none",
  1: "shadow-[var(--elevation-1)]",
  2: "shadow-[var(--elevation-2)]",
  4: "shadow-[var(--elevation-4)]",
  8: "shadow-[var(--elevation-8)]",
  16: "shadow-[var(--elevation-16)]",
  24: "shadow-[var(--elevation-24)]",
};

const cardVariants = cva(
  // Base styles
  "rounded-xl border",
  {
    variants: {
      variant: {
        default:
          "border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900",
        interactive: cn(
          "border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900",
          "transition-base",
          "hover:-translate-y-0.5",
          "cursor-pointer"
        ),
        error:
          "border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/30",
      },
      padding: {
        none: "",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
      elevation: {
        0: elevationClasses[0],
        1: elevationClasses[1],
        2: elevationClasses[2],
        4: elevationClasses[4],
        8: elevationClasses[8],
        16: elevationClasses[16],
        24: elevationClasses[24],
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
      elevation: 2,
    },
  }
);

export type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "interactive" | "error";
  elevation?: CardElevation;
} & VariantProps<typeof cardVariants>;

function CardComponent({
  children,
  className,
  hover = false,
  padding = "md",
  variant = hover ? "interactive" : "default",
  elevation = 2,
}: CardProps) {
  // Interactive variant의 경우 hover 시 elevation 증가
  const hoverElevation =
    variant === "interactive" && elevation < 24
      ? ((elevation === 0
          ? 2
          : elevation === 1
          ? 4
          : elevation === 2
          ? 4
          : elevation === 4
          ? 8
          : elevation === 8
          ? 16
          : 24) as CardElevation)
      : elevation;

  return (
    <div
      className={cn(
        cardVariants({ variant, padding, elevation }),
        variant === "interactive" &&
          `hover:${elevationClasses[hoverElevation]}`,
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// CardHeader 컴포넌트
// ============================================

export type CardHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function CardHeader({
  title,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="text-h2 text-text-primary dark:text-text-primary">
          {title}
        </h3>
        {description && (
          <p className="text-body-2 text-text-secondary dark:text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ============================================
// CardContent 컴포넌트
// ============================================

export type CardContentProps = {
  children: ReactNode;
  className?: string;
};

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

// ============================================
// CardFooter 컴포넌트
// ============================================

export type CardFooterProps = {
  children: ReactNode;
  className?: string;
};

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-secondary-100 dark:border-secondary-700 pt-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export const Card = memo(CardComponent);
export default Card;
