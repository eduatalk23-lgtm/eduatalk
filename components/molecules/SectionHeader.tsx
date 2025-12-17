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
    title: "text-body-2-bold",
    description: "text-body-2",
  },
  md: {
    title: "text-h2",
    description: "text-body-2",
  },
  lg: {
    title: "text-h1",
    description: "text-body-1",
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
            sizeClasses[size].title,
            "text-text-primary"
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn(sizeClasses[size].description, "text-text-secondary")}>
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

