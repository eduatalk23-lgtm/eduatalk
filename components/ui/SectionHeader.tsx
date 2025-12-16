import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
  className?: string;
  level?: "h1" | "h2";
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

export function SectionHeader({
  title,
  description,
  actionLabel,
  actionHref,
  action,
  className = "",
  level = "h2",
  size,
}: SectionHeaderProps) {
  const HeadingTag = level === "h1" ? "h1" : "h2";
  
  // size prop이 없으면 level 기반으로 결정
  const effectiveSize = size ?? (level === "h1" ? "lg" : "md");
  
  const headingClassName = cn(
    sizeClasses[effectiveSize].title,
    "text-text-primary"
  );
  
  const descriptionClassName = cn(
    sizeClasses[effectiveSize].description,
    "text-text-secondary"
  );

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <HeadingTag className={headingClassName}>{title}</HeadingTag>
        {description && (
          <p className={descriptionClassName}>{description}</p>
        )}
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-body-2 font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          {actionLabel} →
        </Link>
      )}
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

