'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768; // matches Tailwind `md:` breakpoint
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false; // SSR: 데스크톱 기본
}

/**
 * 뷰포트가 모바일 크기(< 768px)인지 감지하는 훅
 *
 * useSyncExternalStore로 구현하여 tearing 없이 정확한 값을 반환합니다.
 * SSR에서는 false(데스크톱)로 시작합니다.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
