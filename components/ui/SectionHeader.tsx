import { ReactNode } from "react";
import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  actionLabel,
  actionHref,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
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

