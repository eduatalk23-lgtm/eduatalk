"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <div className="mb-4 text-6xl">⚠️</div>
        <h2 className="mb-2 text-2xl font-semibold text-red-900">오류가 발생했습니다</h2>
        <p className="mb-6 text-sm text-red-700">
          예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            다시 시도
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-red-300 bg-white px-6 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

