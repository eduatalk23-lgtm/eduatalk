"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[admin] 에러 발생", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ErrorState
        title="오류가 발생했습니다"
        message={error.message || "예상치 못한 오류가 발생했습니다."}
        actionLabel="대시보드로 돌아가기"
        actionHref="/admin/dashboard"
      />
    </div>
  );
}

