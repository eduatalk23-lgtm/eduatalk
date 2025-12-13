import { ReactNode } from "react";
import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
  className?: string;
  level?: "h1" | "h2";
};

export function SectionHeader({
  title,
  description,
  actionLabel,
  actionHref,
  action,
  className = "",
  level = "h2",
}: SectionHeaderProps) {
  const HeadingTag = level === "h1" ? "h1" : "h2";
  const headingClassName =
    level === "h1"
      ? "text-h1 text-gray-900"
      : "text-2xl font-semibold text-gray-900";

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex flex-col gap-1">
        <HeadingTag className={headingClassName}>{title}</HeadingTag>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          {actionLabel} →
        </Link>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

