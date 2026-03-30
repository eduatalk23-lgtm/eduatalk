"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-xl font-semibold text-gray-900">
            예기치 않은 오류가 발생했습니다
          </h2>
          <p className="text-sm text-gray-600">
            문제가 자동으로 보고되었습니다. 잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
