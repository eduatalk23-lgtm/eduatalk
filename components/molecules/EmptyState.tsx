"use client";

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";
import { textPrimaryVar, textTertiaryVar, borderDefaultVar } from "@/lib/utils/darkMode";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  variant?: "default" | "compact";
  /** 헤딩 레벨을 지정합니다. 접근성을 위해 페이지 구조에 맞는 레벨을 사용하세요. */
  headingLevel?: "h2" | "h3" | "h4" | "p";
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
  headingLevel = "h2",
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  const HeadingTag = headingLevel;

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed text-center",
        borderDefaultVar,
        "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]",
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
          <HeadingTag
            className={cn(
              textPrimaryVar,
              isCompact ? "text-body-2-bold" : "text-body-1"
            )}
          >
            {title}
          </HeadingTag>
          {description && (
            <p
              className={cn(
                textTertiaryVar,
                isCompact ? "text-body-2" : "text-body-2"
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

