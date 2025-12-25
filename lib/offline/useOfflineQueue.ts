"use client";

/**
 * Offline Queue React Hook
 *
 * 오프라인 큐 상태를 모니터링하는 React 훅입니다.
 */

import { useState, useEffect } from "react";
import { addQueueStatusListener, initQueueProcessor } from "./queue";
import {
  isOnline as checkOnline,
  addNetworkStatusListener,
  initNetworkStatusListeners,
} from "./networkStatus";

export type UseOfflineQueueReturn = {
  /** 대기 중인 액션 개수 */
  pendingCount: number;
  /** 큐 처리 중 여부 */
  isProcessing: boolean;
  /** 온라인 여부 */
  isOnline: boolean;
  /** 동기화 필요 여부 (오프라인이거나 대기 중인 액션이 있음) */
  needsSync: boolean;
};

/**
 * 오프라인 큐 상태 모니터링 훅
 *
 * @example
 * function SyncIndicator() {
 *   const { pendingCount, isProcessing, isOnline, needsSync } = useOfflineQueue();
 *
 *   if (!isOnline) {
 *     return <span className="text-yellow-500">오프라인 모드</span>;
 *   }
 *
 *   if (needsSync) {
 *     return (
 *       <span className="text-blue-500">
 *         동기화 {isProcessing ? "중..." : `대기 (${pendingCount})`}
 *       </span>
 *     );
 *   }
 *
 *   return null;
 * }
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const [pendingCount, setPendingCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // 초기 상태
    setIsOnline(checkOnline());

    // 네트워크 상태 리스너 초기화
    initNetworkStatusListeners();

    // 큐 프로세서 초기화
    const unsubscribeQueue = initQueueProcessor();

    // 네트워크 상태 구독
    const unsubscribeNetwork = addNetworkStatusListener((online) => {
      setIsOnline(online);
    });

    // 큐 상태 구독
    const unsubscribeQueueStatus = addQueueStatusListener((count, processing) => {
      setPendingCount(count);
      setIsProcessing(processing);
    });

    return () => {
      unsubscribeQueue();
      unsubscribeNetwork();
      unsubscribeQueueStatus();
    };
  }, []);

  return {
    pendingCount,
    isProcessing,
    isOnline,
    needsSync: !isOnline || pendingCount > 0,
  };
}
