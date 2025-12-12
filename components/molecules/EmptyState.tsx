"use client";

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  variant?: "default" | "compact";
};

function EmptyStateComponent({
  title,
  description,
  icon,
  actionLabel,
  actionHref,
  onAction,
  className,
  variant = "default",
}: EmptyStateProps) {
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center",
        isCompact ? "p-6" : "p-12",
        className
      )}
    >
      <div className="mx-auto flex flex-col gap-4 max-w-md">
        {icon && (
          <div className={cn("mx-auto", isCompact ? "text-4xl" : "text-6xl")}>
            {typeof icon === "string" ? icon : icon}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <h3
            className={cn(
              "font-semibold text-gray-900",
              isCompact ? "text-base" : "text-lg"
            )}
          >
            {title}
          </h3>
          {description && (
            <p
              className={cn(
                "text-gray-500",
                isCompact ? "text-xs" : "text-sm"
              )}
            >
              {description}
            </p>
          )}
        </div>
        {actionLabel && (actionHref || onAction) && (
          <div>
            {actionHref ? (
              <Link href={actionHref}>
                <Button size={isCompact ? "sm" : "md"}>
                  {actionLabel}
                </Button>
              </Link>
            ) : (
              <Button size={isCompact ? "sm" : "md"} onClick={onAction}>
                {actionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const EmptyState = memo(EmptyStateComponent);
export default EmptyState;

