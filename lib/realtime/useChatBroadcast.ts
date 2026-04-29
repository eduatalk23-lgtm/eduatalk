"use client";

/**
 * 채팅 Broadcast 전송 훅
 *
 * - broadcastInsert: DB INSERT 전 클라이언트에서 직접 broadcast (Broadcast-first 패턴)
 * - broadcastReadReceipt: 읽음 확인 broadcast (markAsRead 성공 후 호출)
 * - 채널 미연결 시 pendingBroadcastsRef에 큐잉 → SUBSCRIBED 후 flushPendingBroadcasts로 flush
 */

import { useRef, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessagePayload } from "./chatRealtimeTypes";

// 프로덕션에서 로그 비활성화
const __DEV__ = process.env.NODE_ENV === "development";
function debugLog(...args: unknown[]) { if (__DEV__) console.log(...args); }
function debugWarn(...args: unknown[]) { if (__DEV__) console.warn(...args); }

export type UseChatBroadcastOptions = {
  userId: string;
  channelRef: React.MutableRefObject<RealtimeChannel | null>;
  isSubscribedRef: React.MutableRefObject<boolean>;
};

export function useChatBroadcast({
  userId,
  channelRef,
  isSubscribedRef,
}: UseChatBroadcastOptions) {
  // 채널 미연결 시 broadcast 대기열 (SUBSCRIBED 후 flush)
  const pendingBroadcastsRef = useRef<Array<{ event: string; payload: Record<string, unknown> }>>(
    []
  );

  // 채널 연결 후 대기 중인 broadcast를 flush
  const flushPendingBroadcasts = useCallback(async () => {
    const pending = pendingBroadcastsRef.current;
    if (pending.length === 0 || !channelRef.current || !isSubscribedRef.current) return;
    pendingBroadcastsRef.current = [];

    for (const { event, payload } of pending) {
      try {
        await channelRef.current.send({ type: "broadcast", event, payload });
        debugLog(`[ChatBroadcast] Flushed pending ${event}`);
      } catch (error) {
        debugWarn(`[ChatBroadcast] Failed to flush pending ${event}:`, error);
      }
    }
  }, [channelRef, isSubscribedRef]);

  // Broadcast-first: 클라이언트에서 직접 broadcast 전송 (DB INSERT 전)
  const broadcastInsert = useCallback(
    async (message: ChatMessagePayload) => {
      if (!channelRef.current || !isSubscribedRef.current) {
        debugWarn("[ChatBroadcast] Channel not subscribed, queuing INSERT broadcast");
        pendingBroadcastsRef.current.push({
          event: "INSERT",
          payload: message as unknown as Record<string, unknown>,
        });
        return;
      }
      try {
        const status = await channelRef.current.send({
          type: "broadcast",
          event: "INSERT",
          payload: message,
        });
        if (status !== "ok") {
          debugWarn("[ChatBroadcast] Broadcast ack failed:", status);
        }
      } catch (error) {
        debugWarn("[ChatBroadcast] Broadcast send error:", error);
      }
    },
    [channelRef, isSubscribedRef]
  );

  // 읽음 확인 broadcast (markAsRead 성공 후 호출, 서버 시각 사용)
  const broadcastReadReceipt = useCallback(
    async (readAt?: string) => {
      const payload = { reader_id: userId, read_at: readAt ?? new Date().toISOString() };

      if (!channelRef.current || !isSubscribedRef.current) {
        debugLog("[ChatBroadcast] Channel not subscribed, queuing READ_RECEIPT");
        pendingBroadcastsRef.current.push({ event: "READ_RECEIPT", payload });
        return;
      }
      try {
        await channelRef.current.send({
          type: "broadcast",
          event: "READ_RECEIPT",
          payload,
        });
      } catch (error) {
        debugWarn("[ChatBroadcast] ReadReceipt broadcast error:", error);
      }
    },
    [userId, channelRef, isSubscribedRef]
  );

  // 대기 중 broadcast 큐 비우기 (방 전환 시 cleanup에서 호출)
  const clearPendingBroadcasts = useCallback(() => {
    pendingBroadcastsRef.current = [];
  }, []);

  return {
    pendingBroadcastsRef,
    flushPendingBroadcasts,
    clearPendingBroadcasts,
    broadcastInsert,
    broadcastReadReceipt,
  };
}
