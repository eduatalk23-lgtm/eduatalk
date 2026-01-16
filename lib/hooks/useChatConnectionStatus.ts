"use client";

/**
 * Chat Connection Status Hook
 *
 * 채팅방의 실시간 연결 상태를 추적하고 UI에 제공합니다.
 * - 연결 상태 (connected/disconnected/reconnecting)
 * - 재시도 정보 (횟수, 최대, 다음 재시도까지 시간)
 * - 대기 중인 메시지 수
 * - 수동 재연결 기능
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  connectionManager,
  type ConnectionStatus,
} from "@/lib/realtime/connectionManager";
import {
  addChatQueueStatusListener,
  getChatQueueForRoom,
} from "@/lib/offline/chatQueue";
import { isOnline, addNetworkStatusListener } from "@/lib/offline/networkStatus";

export interface ChatConnectionStatusResult {
  /** 연결 상태 */
  status: ConnectionStatus;
  /** 네트워크 온라인 여부 */
  isNetworkOnline: boolean;
  /** 대기 중인 메시지 수 */
  pendingCount: number;
  /** 마지막 동기화 시점 */
  lastSyncAt: Date | null;
  /** 현재 재시도 횟수 */
  retryCount: number;
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 다음 재시도까지 남은 시간 (초) */
  nextRetryIn: number | null;
  /** 재연결 진행 중 여부 */
  isReconnecting: boolean;
  /** 수동 재연결 시도 */
  reconnect: () => Promise<boolean>;
}

/**
 * 채팅 연결 상태 훅
 *
 * @param roomId 채팅방 ID
 * @returns 연결 상태 정보
 *
 * @example
 * ```tsx
 * const { status, isNetworkOnline, pendingCount } = useChatConnectionStatus(roomId);
 *
 * if (status === 'disconnected') {
 *   return <ConnectionStatusIndicator status={status} pendingCount={pendingCount} />;
 * }
 * ```
 */
export function useChatConnectionStatus(
  roomId: string
): ChatConnectionStatusResult {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isNetworkOnline, setIsNetworkOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // 채널 이름
  const channelName = connectionManager.getChannelKey(roomId);

  // 재시도 타이머 인터벌 ref
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 재시도 타이머 정리
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // 재시도 카운트다운 시작
  const startRetryCountdown = useCallback(() => {
    clearRetryTimer();

    // 초기값 설정
    const initialRemaining = connectionManager.getNextRetryIn(channelName);
    if (initialRemaining !== null) {
      setNextRetryIn(Math.ceil(initialRemaining / 1000));
    }

    // 매초 업데이트
    retryTimerRef.current = setInterval(() => {
      const remaining = connectionManager.getNextRetryIn(channelName);
      if (remaining === null || remaining <= 0) {
        setNextRetryIn(null);
        clearRetryTimer();
      } else {
        setNextRetryIn(Math.ceil(remaining / 1000));
      }
    }, 1000);
  }, [channelName, clearRetryTimer]);

  // ConnectionManager 연결 상태 구독
  useEffect(() => {
    // 초기화: 채널 등록
    connectionManager.registerChannel(channelName);

    const unsubscribe = connectionManager.addStateListener(
      (channel, newStatus) => {
        if (channel === channelName) {
          setStatus(newStatus);
          setRetryCount(connectionManager.getRetryCount(channelName));

          // 상태별 처리
          if (newStatus === "connected") {
            setLastSyncAt(new Date());
            setIsReconnecting(false);
            setNextRetryIn(null);
            clearRetryTimer();
          } else if (newStatus === "reconnecting") {
            setIsReconnecting(true);
            startRetryCountdown();
          } else if (newStatus === "disconnected") {
            setIsReconnecting(false);
            // disconnected 상태에서도 재시도 대기 시간 표시
            const remaining = connectionManager.getNextRetryIn(channelName);
            if (remaining !== null && remaining > 0) {
              startRetryCountdown();
            } else {
              setNextRetryIn(null);
              clearRetryTimer();
            }
          }
        }
      }
    );

    return () => {
      unsubscribe();
      clearRetryTimer();
    };
  }, [channelName, clearRetryTimer, startRetryCountdown]);

  // 네트워크 상태 구독
  useEffect(() => {
    const unsubscribe = addNetworkStatusListener((online) => {
      setIsNetworkOnline(online);
    });

    return unsubscribe;
  }, []);

  // 대기 메시지 수 구독
  useEffect(() => {
    // 초기 로드
    getChatQueueForRoom(roomId).then((items) => {
      setPendingCount(items.length);
    });

    // 큐 상태 리스너
    const unsubscribe = addChatQueueStatusListener(async () => {
      const items = await getChatQueueForRoom(roomId);
      setPendingCount(items.length);
    });

    return unsubscribe;
  }, [roomId]);

  // 수동 재연결
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (status === "connected") {
      console.log("[useChatConnectionStatus] Already connected");
      return true;
    }

    if (!isNetworkOnline) {
      console.warn("[useChatConnectionStatus] Cannot reconnect: network offline");
      return false;
    }

    if (isReconnecting) {
      console.log("[useChatConnectionStatus] Reconnection already in progress");
      return false;
    }

    console.log("[useChatConnectionStatus] Manual reconnect requested");
    setIsReconnecting(true);

    try {
      const success = await connectionManager.attemptManualReconnect(channelName);
      if (!success) {
        setIsReconnecting(false);
      }
      return success;
    } catch (error) {
      console.error("[useChatConnectionStatus] Reconnect failed:", error);
      setIsReconnecting(false);
      return false;
    }
  }, [channelName, status, isNetworkOnline, isReconnecting]);

  return {
    status,
    isNetworkOnline,
    pendingCount,
    lastSyncAt,
    retryCount,
    maxRetries: connectionManager.MAX_RETRY_COUNT,
    nextRetryIn,
    isReconnecting,
    reconnect,
  };
}
