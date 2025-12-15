import Link from "next/link";
import { bgPage, borderInput, textPrimary, textMuted, inlineButtonPrimary } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

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
    <div className={cn("rounded-xl border border-dashed p-12 text-center", borderInput, bgPage)}>
      <div className="mx-auto flex flex-col gap-4 max-w-md">
        <div className="text-6xl">{icon}</div>
        <div className="flex flex-col gap-2">
          <h3 className={cn("text-lg font-semibold", textPrimary)}>{title}</h3>
          <p className={cn("text-sm", textMuted)}>{description}</p>
        </div>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className={inlineButtonPrimary("px-6 py-3 text-sm font-semibold")}
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

