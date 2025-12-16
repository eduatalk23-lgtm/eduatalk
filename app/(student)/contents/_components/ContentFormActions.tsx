import Link from "next/link";
import { cn } from "@/lib/cn";

type ContentFormActionsProps = {
  submitLabel: string;
  cancelHref: string;
  isPending: boolean;
  onCancel?: () => void;
  className?: string;
};

export function ContentFormActions({
  submitLabel,
  cancelHref,
  isPending,
  onCancel,
  className,
}: ContentFormActionsProps) {
  return (
    <div className={cn("flex gap-3", className)}>
      <button
        type="submit"
        disabled={isPending}
        className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-700"
      >
        {isPending ? "처리 중..." : submitLabel}
      </button>
      <Link
        href={cancelHref}
        onClick={onCancel}
        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-600"
      >
        취소
      </Link>
    </div>
  );
}

