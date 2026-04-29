"use client";

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type StatCardColor =
  | "neutral"
  | "blue"
  | "purple"
  | "emerald"
  | "green"
  | "red"
  | "amber"
  | "indigo"
  | "teal"
  | "cyan"
  | "pink"
  | "violet";

export type StatCardProps = {
  label: string;
  value: string | number;
  color?: StatCardColor;
  className?: string;
  icon?: React.ReactNode;
  /** 보조 메트릭 — 활성률 / % 변화 등 */
  subValue?: React.ReactNode;
  /** 클릭 시 이동할 경로 — 제공 시 카드 전체가 Link 로 감싸짐 */
  href?: string;
};

const colorClasses: Record<
  StatCardColor,
  { bg: string; iconBg: string; label: string; value: string }
> = {
  neutral: {
    bg: "bg-bg-primary border border-border",
    iconBg: "bg-bg-secondary",
    label: "text-text-tertiary",
    value: "text-text-primary",
  },
  blue: {
    bg: "bg-info-50 dark:bg-info-900/30",
    iconBg: "bg-info-100 dark:bg-info-900/50",
    label: "text-info-600 dark:text-info-400",
    value: "text-info-700 dark:text-info-300",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/30",
    iconBg: "bg-purple-100 dark:bg-purple-900/50",
    label: "text-purple-600 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    label: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  green: {
    bg: "bg-success-50 dark:bg-success-900/30",
    iconBg: "bg-success-100 dark:bg-success-900/50",
    label: "text-success-600 dark:text-success-400",
    value: "text-success-700 dark:text-success-300",
  },
  red: {
    bg: "bg-error-50 dark:bg-error-900/30",
    iconBg: "bg-error-100 dark:bg-error-900/50",
    label: "text-error-600 dark:text-error-400",
    value: "text-error-700 dark:text-error-300",
  },
  amber: {
    bg: "bg-warning-50 dark:bg-warning-900/30",
    iconBg: "bg-warning-100 dark:bg-warning-900/50",
    label: "text-warning-600 dark:text-warning-400",
    value: "text-warning-700 dark:text-warning-300",
  },
  indigo: {
    bg: "bg-primary-50 dark:bg-primary-900/30",
    iconBg: "bg-primary-100 dark:bg-primary-900/50",
    label: "text-primary-600 dark:text-primary-400",
    value: "text-primary-700 dark:text-primary-300",
  },
  teal: {
    bg: "bg-teal-50 dark:bg-teal-900/30",
    iconBg: "bg-teal-100 dark:bg-teal-900/50",
    label: "text-teal-600 dark:text-teal-400",
    value: "text-teal-700 dark:text-teal-300",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-900/30",
    iconBg: "bg-cyan-100 dark:bg-cyan-900/50",
    label: "text-cyan-600 dark:text-cyan-400",
    value: "text-cyan-700 dark:text-cyan-300",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-900/30",
    iconBg: "bg-pink-100 dark:bg-pink-900/50",
    label: "text-pink-600 dark:text-pink-400",
    value: "text-pink-700 dark:text-pink-300",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-900/30",
    iconBg: "bg-violet-100 dark:bg-violet-900/50",
    label: "text-violet-600 dark:text-violet-400",
    value: "text-violet-700 dark:text-violet-300",
  },
};

function StatCardComponent({
  label,
  value,
  color = "blue",
  className,
  icon,
  subValue,
  href,
}: StatCardProps) {
  const colors = colorClasses[color];

  const content = icon ? (
    <div className="flex items-center gap-3">
      <div className={cn("rounded-lg p-2", colors.iconBg)}>{icon}</div>
      <div className="flex flex-col gap-1">
        <div className={cn("text-body-2", colors.label)}>{label}</div>
        <div className={cn("text-h1", colors.value)}>{value}</div>
        {subValue && (
          <div className={cn("text-xs font-medium", colors.label)}>
            {subValue}
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      <div className={cn("text-body-2", colors.label)}>{label}</div>
      <div className={cn("text-h1", colors.value)}>{value}</div>
      {subValue && (
        <div className={cn("text-xs font-medium", colors.label)}>
          {subValue}
        </div>
      )}
    </div>
  );

  const baseClass = cn(
    "rounded-lg p-4 transition-shadow",
    colors.bg,
    href &&
      "block hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

export const StatCard = memo(StatCardComponent);
export default StatCard;

