"use client";

/**
 * 채팅방 목록 실시간 구독 훅
 *
 * 새 채팅방 생성, 멤버 변경, 새 메시지(chat_rooms.updated_at 변경) 등을 실시간으로 반영합니다.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { ChatRoomListItem } from "@/lib/domains/chat/types";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { connectionManager } from "./connectionManager";
import { useDebouncedCallback } from "@/lib/hooks/useDebounce";

// 프로덕션에서 로그 비활성화
const __DEV__ = process.env.NODE_ENV === "development";
function debugLog(...args: unknown[]) { if (__DEV__) console.log(...args); }
function debugWarn(...args: unknown[]) { if (__DEV__) console.warn(...args); }

type UseChatRoomListRealtimeOptions = {
  /** 현재 사용자 ID */
  userId: string;
  /** 사용자 유형 */
  userType: "student" | "admin" | "parent";
  /** 구독 활성화 여부 */
  enabled?: boolean;
};

/**
 * 채팅방 목록 실시간 구독 훅
 *
 * 새 채팅방 생성, 멤버 변경, 새 메시지(chat_rooms.updated_at 변경) 등을 실시간으로 반영합니다.
 */
export function useChatRoomListRealtime({
  userId,
  userType,
  enabled = true,
}: UseChatRoomListRealtimeOptions) {
  const queryClient = useQueryClient();
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // 사용자가 속한 채팅방 ID 추적 (chat_rooms UPDATE 필터링용)
  const userRoomIdsRef = useRef<Set<string>>(new Set());

  const invalidateRoomList = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) && query.queryKey[0] === chatKeys.rooms()[0],
    });
  }, [queryClient]);

  // Debounce로 짧은 시간 내 중복 무효화 방지 (300ms)
  const debouncedInvalidate = useDebouncedCallback(invalidateRoomList, 200);

  // 캐시에서 room ID 목록 동기화
  useEffect(() => {
    const updateRoomIds = () => {
      const cache = queryClient.getQueryData<ChatRoomListItem[]>(chatKeys.rooms());
      if (cache) {
        userRoomIdsRef.current = new Set(cache.map((room) => room.id));
      }
    };

    updateRoomIds();

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        Array.isArray(event.query.queryKey) &&
        event.query.queryKey[0] === chatKeys.rooms()[0]
      ) {
        updateRoomIds();
      }
    });

    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    // 싱글톤 클라이언트 사용 (모듈 레벨에서 import)
    const channelName = `chat-rooms-${userId}`;

    // ConnectionManager에 재연결 콜백 등록
    connectionManager.registerReconnectCallback(channelName, async () => {
      debugLog("[ChatRealtime] Room list reconnect callback triggered");
      setReconnectTrigger((prev) => prev + 1);
    });

    // broadcast_changes payload 노멀라이저 (DB trigger → record 래핑)
    type BroadcastPayload = Record<string, unknown>;
    const extractRecord = <T>(raw: BroadcastPayload): T | undefined =>
      raw.record as T | undefined;

    const channel = supabase
      .channel(channelName)
      // 멤버 추가 (broadcast from DB trigger)
      .on(
        "broadcast",
        { event: "INSERT" },
        (event: { payload: BroadcastPayload }) => {
          debugLog("[ChatRealtime] Added to room:", event.payload);
          invalidateRoomList();
        }
      )
      // 멤버십 변경 (나가기/재참여) - markAsRead의 last_read_at 업데이트는 무시
      // DB trigger는 left_at 컬럼 변경 시에만 발화 (broadcast_chat_members)
      .on(
        "broadcast",
        { event: "UPDATE" },
        (event: { payload: BroadcastPayload }) => {
          const record = extractRecord<{ left_at?: string | null }>(event.payload);
          // left_at 변경(나가기 또는 재참여)만 처리
          // DB trigger가 left_at 컬럼 변경 시에만 발화하므로 추가 필터 불필요
          if (record?.left_at !== undefined) {
            const action = record.left_at !== null ? "left" : "rejoined";
            debugLog(`[ChatRealtime] Member ${action} room, refreshing list`);
            invalidateRoomList();
          }
        }
      )
      // 채팅방 업데이트 (새 메시지 시 트리거로 updated_at 갱신됨)
      .on(
        "broadcast",
        { event: "ROOM_UPDATE" },
        (event: { payload: BroadcastPayload }) => {
          const record = extractRecord<{ id: string }>(event.payload);
          const roomId = record?.id;
          if (roomId && userRoomIdsRef.current.has(roomId)) {
            // 기존 방: debounced 갱신
            debugLog("[ChatRealtime] Room updated (new message):", roomId);
            debouncedInvalidate();
          } else if (roomId) {
            // 새로 추가된 방 가능성: 즉시 갱신 (userRoomIdsRef에 아직 없는 방)
            debugLog("[ChatRealtime] Room updated (possibly new room):", roomId);
            invalidateRoomList();
          }
        }
      )
      .subscribe((status) => {
        debugLog(`[ChatRealtime] Room list subscription:`, status);

        if (status === "SUBSCRIBED") {
          // ConnectionManager에 연결 상태 알림
          connectionManager.setChannelState(channelName, "connected");

          // 캐시가 이미 있으면 스킵 — React Query가 이미 페칭 중이거나 fresh 상태
          const existing = queryClient.getQueryData(chatKeys.rooms());
          if (!existing) {
            debugLog("[ChatRealtime] Room list connected, no cache. Fetching...");
            invalidateRoomList();
          } else {
            debugLog("[ChatRealtime] Room list connected, cache exists. Skipping refetch.");
          }
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          debugWarn(`[ChatRealtime] Room list connection error: ${status}`);
          // ConnectionManager에 연결 끊김 알림 → 자동 재연결 스케줄
          connectionManager.handleDisconnect(channelName);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      connectionManager.unregisterReconnectCallback(channelName);
    };
  }, [userId, userType, enabled, invalidateRoomList, debouncedInvalidate, queryClient, reconnectTrigger]);
}
