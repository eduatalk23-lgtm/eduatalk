"use client";

import { ReactNode, memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { StatusBadge, getStatusVariant, statusLabels } from "./StatusBadge";
import { ProgressIndicator } from "./ProgressIndicator";

export type CardVariant = "default" | "template" | "camp" | "plan";

interface PlanCardProps {
  variant?: CardVariant;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href?: string;
  status?: string;
  createdAt?: string | Date;
  badges?: Array<{ label: string; variant?: "info" | "warning" | "success" | "error" | "default" }>;
  progress?: {
    completed: number;
    total: number;
  };
  metadata?: Array<{ label: string; value: string }>;
  actions?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  children?: ReactNode;
  isSelected?: boolean;
}

export const PlanCard = memo(function PlanCard({
  variant = "default",
  title,
  subtitle,
  description,
  href,
  status,
  createdAt,
  badges = [],
  progress,
  metadata = [],
  actions,
  onClick,
  className,
  children,
  isSelected = false,
}: PlanCardProps) {
  const cardContent = (
    <div className="flex flex-col gap-3">
      {/* Header: badges + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {status && (
            <StatusBadge variant={getStatusVariant(status)} size="sm">
              {statusLabels[status] || status}
            </StatusBadge>
          )}
          {badges.map((badge, index) => (
            <StatusBadge
              key={index}
              variant={badge.variant || "default"}
              size="sm"
            >
              {badge.label}
            </StatusBadge>
          ))}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>

      {/* Title & Subtitle */}
      <div className="flex flex-col gap-1">
        <h3 className="break-words text-base font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        )}
        {description && (
          <p className="text-sm text-gray-500 line-clamp-2 dark:text-gray-400">{description}</p>
        )}
      </div>

      {/* Progress */}
      {progress && progress.total > 0 && (
        <ProgressIndicator
          completedCount={progress.completed}
          totalCount={progress.total}
        />
      )}

      {/* Metadata */}
      {metadata.length > 0 && (
        <div className="flex flex-col gap-2">
          {metadata.map((item, index) => (
            <div key={index} className="break-words text-sm text-gray-600 dark:text-gray-400">
              <span className="text-gray-500 dark:text-gray-500">{item.label}: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Custom children */}
      {children}

      {/* Footer: created date */}
      {createdAt && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {typeof createdAt === "string"
              ? new Date(createdAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : createdAt.toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
          </p>
        </div>
      )}
    </div>
  );

  const baseClasses = cn(
    "rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 dark:bg-gray-800",
    isSelected
      ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200 dark:bg-blue-900/30 dark:border-blue-400 dark:ring-blue-800"
      : "border-gray-200 hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5 dark:border-gray-700 dark:hover:border-gray-600",
    onClick && "cursor-pointer",
    className
  );

  if (href && !onClick) {
    return (
      <Link href={href} className={baseClasses}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      onClick={onClick}
      className={baseClasses}
    >
      {cardContent}
    </div>
  );
});

// Specialized card variants
export const TemplateCard = memo(function TemplateCard(props: Omit<PlanCardProps, "variant">) {
  return <PlanCard {...props} variant="template" />;
});

export const CampCard = memo(function CampCard(props: Omit<PlanCardProps, "variant">) {
  return <PlanCard {...props} variant="camp" />;
});

export const PlanGroupCard = memo(function PlanGroupCard(props: Omit<PlanCardProps, "variant">) {
  return <PlanCard {...props} variant="plan" />;
});

