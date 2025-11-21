import Link from "next/link";

type ErrorStateProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: string;
};

export function ErrorState({
  title = "오류가 발생했습니다",
  message = "요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
  actionLabel,
  actionHref,
  icon = "⚠️",
}: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center">
      <div className="mx-auto max-w-md">
        <div className="mb-4 text-6xl">{icon}</div>
        <h3 className="mb-2 text-lg font-semibold text-red-900">{title}</h3>
        <p className="mb-6 text-sm text-red-700">{message}</p>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

