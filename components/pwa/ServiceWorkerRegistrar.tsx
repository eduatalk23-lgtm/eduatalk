"use client";

import { useServiceWorker } from "@/lib/hooks/useServiceWorker";

/**
 * Service Worker 등록을 담당하는 컴포넌트.
 * UI를 렌더링하지 않습니다. 레이아웃에서 한 번만 마운트.
 */
export function ServiceWorkerRegistrar() {
  useServiceWorker();
  return null;
}
