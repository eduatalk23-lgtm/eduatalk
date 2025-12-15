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
 */
const cardVariants = cva(
  // Base styles
  "rounded-xl border shadow-sm",
  {
    variants: {
      variant: {
        default: "border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900",
        interactive: "border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 transition-shadow hover:shadow-md cursor-pointer",
        error: "border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/30",
      },
      padding: {
        none: "",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "interactive" | "error";
} & VariantProps<typeof cardVariants>;

function CardComponent({
  children,
  className,
  hover = false,
  padding = "md",
  variant = hover ? "interactive" : "default",
}: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, padding }), className)}
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
        <h3 className="text-h2 text-text-primary dark:text-text-primary">{title}</h3>
        {description && (
          <p className="text-body-2 text-text-secondary dark:text-text-secondary">{description}</p>
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
  return (
    <div className={cn("flex flex-col gap-4", className)}>{children}</div>
  );
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
