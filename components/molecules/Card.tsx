"use client";

import { memo, ReactNode } from "react";
import { cn } from "@/lib/cn";

// ============================================
// Card 컴포넌트
// ============================================

export type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

function CardComponent({
  children,
  className,
  hover = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 shadow-sm",
        hover && "transition-shadow hover:shadow-md",
        paddingClasses[padding],
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

