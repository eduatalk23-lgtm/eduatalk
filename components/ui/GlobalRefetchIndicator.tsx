"use client";

import { useIsFetching } from "@tanstack/react-query";
import { useDelayedLoading } from "@/lib/hooks/useDelayedLoading";

/**
 * 백그라운드 리페치 시 상단에 2px pulse bar를 표시합니다.
 * 5초 이상 로딩 시 안내 메시지를 추가로 표시합니다.
 * QueryProvider 내부에 마운트해야 합니다.
 */
export function GlobalRefetchIndicator() {
  const isFetching = useIsFetching();
  const isLongLoading = useDelayedLoading(isFetching > 0, 5000);

  if (isFetching === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9998]" role="status" aria-label="데이터 로딩 중">
      <div className="h-0.5 animate-pulse bg-primary-500 opacity-60" />
      {isLongLoading && (
        <div className="flex justify-center px-4 py-2 bg-white/90 dark:bg-[rgb(var(--color-secondary-900)/0.9)] backdrop-blur-sm border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
          <p className="text-caption-1 text-[var(--text-secondary)]">
            요청이 평소보다 오래 걸리고 있습니다. 잠시만 기다려주세요.
          </p>
        </div>
      )}
    </div>
  );
}
