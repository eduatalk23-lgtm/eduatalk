"use client";

import { useState, useEffect } from "react";

/**
 * useMediaQuery - CSS 미디어 쿼리 매칭 훅
 *
 * SSR에서는 false를 반환하고, 클라이언트에서 실제 매칭 여부를 반환합니다.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
