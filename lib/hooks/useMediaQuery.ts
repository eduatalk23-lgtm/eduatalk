"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * useMediaQuery - CSS 미디어 쿼리 매칭 훅
 *
 * useSyncExternalStore 기반 — SSR에서는 false, hydration 시 동기 전환.
 * useState+useEffect 대비 리렌더 1회 감소, paint 전 확정으로 깜빡임 방지.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
