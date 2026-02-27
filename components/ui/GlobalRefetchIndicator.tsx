"use client";

import { useIsFetching } from "@tanstack/react-query";

/**
 * 백그라운드 리페치 시 상단에 2px pulse bar를 표시합니다.
 * QueryProvider 내부에 마운트해야 합니다.
 */
export function GlobalRefetchIndicator() {
  const isFetching = useIsFetching();

  if (isFetching === 0) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[9998] h-0.5 animate-pulse bg-primary-500 opacity-60"
      role="status"
      aria-label="데이터 로딩 중"
    />
  );
}
