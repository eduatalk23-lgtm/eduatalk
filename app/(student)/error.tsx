"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { getContainerClass } from "@/lib/constants/layout";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[student] 에러 발생", error);
  }, [error]);

  return (
    <div className={getContainerClass("DASHBOARD", "lg")}>
      <ErrorState
        title="오류가 발생했습니다"
        message={error.message || "예상치 못한 오류가 발생했습니다."}
        onRetry={reset}
        retryLabel="다시 시도"
        actionHref="/dashboard"
        actionLabel="대시보드로 이동"
      />
    </div>
  );
}