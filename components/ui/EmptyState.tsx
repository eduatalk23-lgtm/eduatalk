import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon = "📭",
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
      <div className="mx-auto flex flex-col gap-4 max-w-md">
        <div className="text-6xl">{icon}</div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

