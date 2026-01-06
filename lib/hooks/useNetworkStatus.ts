"use client";

/**
 * 네트워크 상태 감지 훅
 *
 * 브라우저의 온라인/오프라인 상태를 실시간으로 감지합니다.
 *
 * @module lib/hooks/useNetworkStatus
 */

import { useState, useEffect, useCallback } from "react";

export type NetworkStatus = {
  /** 온라인 여부 */
  isOnline: boolean;
  /** 오프라인 여부 */
  isOffline: boolean;
  /** 마지막 상태 변경 시간 */
  lastChangedAt: Date | null;
  /** 이전에 오프라인이었다가 복구됨 */
  wasOffline: boolean;
};

/**
 * 네트워크 상태 감지 훅
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, isOffline, wasOffline } = useNetworkStatus();
 *
 *   if (isOffline) {
 *     return <div>인터넷 연결을 확인해주세요.</div>;
 *   }
 *
 *   if (wasOffline) {
 *     return <div>인터넷 연결이 복구되었습니다.</div>;
 *   }
 *
 *   return <div>정상 동작 중</div>;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof window !== "undefined" ? navigator.onLine : true,
    isOffline: typeof window !== "undefined" ? !navigator.onLine : false,
    lastChangedAt: null,
    wasOffline: false,
  }));

  const handleOnline = useCallback(() => {
    setStatus((prev) => ({
      isOnline: true,
      isOffline: false,
      lastChangedAt: new Date(),
      wasOffline: prev.isOffline, // 이전에 오프라인이었으면 true
    }));
  }, []);

  const handleOffline = useCallback(() => {
    setStatus({
      isOnline: false,
      isOffline: true,
      lastChangedAt: new Date(),
      wasOffline: false,
    });
  }, []);

  useEffect(() => {
    // 초기 상태 설정
    setStatus({
      isOnline: navigator.onLine,
      isOffline: !navigator.onLine,
      lastChangedAt: null,
      wasOffline: false,
    });

    // 이벤트 리스너 등록
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return status;
}

/**
 * 오프라인 상태에서 자동 재시도를 위한 훅
 *
 * @param retryFn 재시도할 함수
 * @param options 옵션
 */
export function useRetryOnReconnect(
  retryFn: () => void,
  options: {
    enabled?: boolean;
    delay?: number;
  } = {}
) {
  const { enabled = true, delay = 1000 } = options;
  const { isOnline, wasOffline } = useNetworkStatus();

  useEffect(() => {
    if (enabled && isOnline && wasOffline) {
      // 연결 복구 후 약간의 지연 후 재시도
      const timer = setTimeout(retryFn, delay);
      return () => clearTimeout(timer);
    }
  }, [enabled, isOnline, wasOffline, retryFn, delay]);
}
