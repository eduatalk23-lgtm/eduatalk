'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'calendar-dead-zone-collapsed';
const DEFAULT_COLLAPSED = true;

/**
 * 새벽 시간대(01:00~07:00) 접기 상태 관리.
 * localStorage로 영속, 공통 설정(학생별 아님).
 *
 * SSR/하이드레이션 안전:
 * - 초기값은 항상 DEFAULT_COLLAPSED (SSR/클라이언트 모두 동일)
 * - 마운트 후 localStorage에서 읽어 보정
 * - logicalConfig를 사용하는 모든 컴포넌트가 동일한 초기값으로 시작 → 불일치 없음
 */
export function useDeadZoneCollapse() {
  // SSR-safe 초기값: localStorage 직접 읽기 (typeof window 체크)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_COLLAPSED;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored !== 'false';
    } catch { /* ignore */ }
    return DEFAULT_COLLAPSED;
  });

  // 하이드레이션 후 localStorage 동기화 (lazy init이 SSR에서 실행 안 될 경우 대비)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const fromStorage = stored !== 'false';
        setIsCollapsed((prev) => prev === fromStorage ? prev : fromStorage);
      }
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { isCollapsed, toggle } as const;
}
