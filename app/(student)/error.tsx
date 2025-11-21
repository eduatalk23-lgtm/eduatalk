"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[student] 에러 발생", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ErrorState
        title="오류가 발생했습니다"
        message={error.message || "예상치 못한 오류가 발생했습니다."}
        actionLabel="다시 시도"
        actionHref="/dashboard"
      />
    </div>
  );
}

