"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { logError } from "@/lib/errors/handler";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  role?: "student" | "admin" | "parent";
  dashboardHref?: string;
  dashboardLabel?: string;
}

/**
 * 공통 Error Page 컴포넌트
 * 
 * Next.js error.tsx에서 사용하는 공통 에러 페이지 컴포넌트입니다.
 * 역할별로 다른 대시보드 링크를 제공할 수 있습니다.
 */
export default function ErrorPage({
  error,
  reset,
  role = "student",
  dashboardHref,
  dashboardLabel,
}: ErrorPageProps) {
  useEffect(() => {
    logError(error, {
      role,
      errorBoundary: "Next.js error.tsx",
      digest: error.digest,
    });
  }, [error, role]);

  // 역할별 기본 대시보드 링크
  const defaultDashboardHref =
    dashboardHref ||
    (role === "admin"
      ? "/admin/dashboard"
      : role === "parent"
        ? "/parent/dashboard"
        : "/dashboard");

  const defaultDashboardLabel =
    dashboardLabel ||
    (role === "admin"
      ? "대시보드로 돌아가기"
      : role === "parent"
        ? "대시보드로 돌아가기"
        : "대시보드로 이동");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ErrorState
        title="오류가 발생했습니다"
        message={error.message || "예상치 못한 오류가 발생했습니다."}
        onRetry={reset}
        retryLabel="다시 시도"
        actionHref={defaultDashboardHref}
        actionLabel={defaultDashboardLabel}
      />
    </div>
  );
}

