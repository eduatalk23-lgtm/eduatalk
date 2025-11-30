"use client";

import { memo, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: {
    title: "text-base",
    description: "text-xs",
  },
  md: {
    title: "text-lg",
    description: "text-sm",
  },
  lg: {
    title: "text-xl",
    description: "text-base",
  },
};

function SectionHeaderComponent({
  title,
  description,
  action,
  className,
  size = "md",
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h2
          className={cn(
            "font-semibold text-[var(--text-primary)]",
            sizeClasses[size].title
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn("text-[var(--text-secondary)]", sizeClasses[size].description)}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export const SectionHeader = memo(SectionHeaderComponent);
export default SectionHeader;

