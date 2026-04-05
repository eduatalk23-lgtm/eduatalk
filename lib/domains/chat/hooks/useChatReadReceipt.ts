"use client";

/**
 * useChatReadReceipt - 읽음 처리 훅
 *
 * markAsReadMutation, throttle, READ_RECEIPT 버퍼 플러시,
 * 입장/roomData/visibility/isAtBottom effects를 담당합니다.
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useThrottledCallback } from "@/lib/hooks/useThrottle";
import { chatKeys } from "../queryKeys";
import {
  type InfiniteMessagesCache,
  decrementReadCountsForReceipt,
} from "@/lib/domains/chat/cacheTypes";
import type { ChatRoomListItem } from "@/lib/domains/chat/types";

export interface UseChatReadReceiptOptions {
  roomId: string;
  userId: string;
  isAtBottom: boolean;
  chatPrefsRef: RefObject<{ chat_read_receipt_enabled?: boolean } | null | undefined>;
  roomDataMembers:
    | Array<{ user_id: string; left_at: string | null; last_read_at: string }>
    | undefined;
  readReceiptTrackRef: RefObject<Map<string, string>>;
  readReceiptBufferRef: RefObject<Array<{ readAt: string; prevReadAt: string }>>;
  readReceiptFlushTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
}

export interface UseChatReadReceiptReturn {
  markAsRead: () => void;
  throttledMarkAsRead: () => void;
  broadcastReadReceiptRef: RefObject<(readAt?: string) => void>;
}

export function useChatReadReceipt({
  roomId,
  userId,
  isAtBottom,
  chatPrefsRef,
  roomDataMembers,
  readReceiptTrackRef,
  readReceiptBufferRef,
  readReceiptFlushTimerRef,
}: UseChatReadReceiptOptions): UseChatReadReceiptReturn {
  const queryClient = useQueryClient();

  // broadcastReadReceipt ref (useChatRealtime보다 먼저 정의되는 markAsReadMutation에서 안전하게 참조)
  const broadcastReadReceiptRef = useRef<(readAt?: string) => void>(() => {});

  // 읽음 처리 (Browser RPC)
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("mark_chat_room_as_read", {
        p_room_id: roomId,
      });
      if (error) throw error;
      return { data: { readAt: (data as string) } };
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: chatKeys.rooms() });
      const previousRooms = queryClient.getQueryData<ChatRoomListItem[]>(chatKeys.rooms());

      if (previousRooms) {
        queryClient.setQueryData<ChatRoomListItem[]>(
          chatKeys.rooms(),
          previousRooms.map((room) =>
            room.id === roomId ? { ...room, unreadCount: 0 } : room
          )
        );
      }

      // SW에 해당 채팅방 알림 닫기 요청
      navigator.serviceWorker?.controller?.postMessage({
        type: "CLEAR_NOTIFICATIONS",
        tags: [`chat-${roomId}`, `chat-mention-${roomId}`],
      });

      return { previousRooms };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(chatKeys.rooms(), context.previousRooms);
      }
    },
    onSuccess: (result) => {
      broadcastReadReceiptRef.current(result?.data?.readAt);
    },
  });

  // 읽음 처리 Throttle (3초)
  const throttledMarkAsRead = useThrottledCallback(
    () => {
      markAsReadMutation.mutate();
    },
    3000,
    { leading: true, trailing: false }
  );

  const throttledMarkAsReadRef = useRef(throttledMarkAsRead);
  throttledMarkAsReadRef.current = throttledMarkAsRead;

  // 입장 시 읽음 처리 + READ_RECEIPT 추적 리셋
  useEffect(() => {
    readReceiptTrackRef.current.clear();
    readReceiptBufferRef.current = [];
    if (readReceiptFlushTimerRef.current) {
      clearTimeout(readReceiptFlushTimerRef.current);
      readReceiptFlushTimerRef.current = null;
    }
    if (chatPrefsRef.current?.chat_read_receipt_enabled !== false) {
      throttledMarkAsRead();
    }
    return () => {
      readReceiptTrackRef.current.clear();
      if (readReceiptFlushTimerRef.current) {
        clearTimeout(readReceiptFlushTimerRef.current);
        readReceiptFlushTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // roomData 로드/변경 시: readReceiptTrackRef 초기화 + 캐시 readCounts 재계산
  useEffect(() => {
    if (!roomDataMembers || !userId) return;

    for (const member of roomDataMembers) {
      if (member.user_id === userId || member.left_at) continue;
      const current = readReceiptTrackRef.current.get(member.user_id);
      if (!current || member.last_read_at > current) {
        readReceiptTrackRef.current.set(member.user_id, member.last_read_at);
      }
    }

    const activeOtherMembers = roomDataMembers.filter(
      (m) => m.user_id !== userId && !m.left_at
    );
    if (activeOtherMembers.length === 0) return;

    queryClient.setQueryData<InfiniteMessagesCache>(
      chatKeys.messages(roomId),
      (old) => {
        if (!old?.pages?.length) return old;

        let hasChanges = false;
        const updatedPages = old.pages.map((page) => {
          if (!page.messages.some((m) => m.sender_id === userId)) return page;

          let pageChanged = false;
          const updatedMessages = page.messages.map((m) => {
            if (m.sender_id !== userId || m.readCount === undefined) return m;

            const unreadCount = activeOtherMembers.filter(
              (member) => member.last_read_at < m.created_at
            ).length;

            if (unreadCount !== m.readCount) {
              pageChanged = true;
              return { ...m, readCount: unreadCount };
            }
            return m;
          });

          if (!pageChanged) return page;
          hasChanges = true;

          const updatedReadCounts = { ...page.readCounts };
          for (const msg of updatedMessages) {
            if (msg.sender_id === userId && msg.readCount !== undefined) {
              updatedReadCounts[msg.id] = msg.readCount;
            }
          }
          return { ...page, messages: updatedMessages, readCounts: updatedReadCounts };
        });

        return hasChanges ? { ...old, pages: updatedPages } : old;
      }
    );
  }, [roomDataMembers, userId, queryClient, roomId]);

  // 탭 포커스 복귀 시 읽음 처리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (chatPrefsRef.current?.chat_read_receipt_enabled !== false) {
          throttledMarkAsRead();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [throttledMarkAsRead]);

  // 스크롤이 맨 아래에 도달하면 읽음 처리
  const isAtBottomMountedRef = useRef(false);
  useEffect(() => {
    if (!isAtBottomMountedRef.current) {
      isAtBottomMountedRef.current = true;
      return;
    }
    if (isAtBottom && chatPrefsRef.current?.chat_read_receipt_enabled !== false) {
      throttledMarkAsRead();
    }
  }, [isAtBottom, throttledMarkAsRead]);

  // 외부에서 호출되는 markAsRead (throttle 적용, 읽음확인 OFF 시 스킵)
  const markAsRead = useCallback(() => {
    if (chatPrefsRef.current?.chat_read_receipt_enabled !== false) {
      throttledMarkAsRead();
    }
  }, [throttledMarkAsRead]);

  return {
    markAsRead,
    throttledMarkAsRead,
    broadcastReadReceiptRef,
  };
}
