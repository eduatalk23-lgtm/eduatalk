"use client";

/**
 * 채팅 메시지 실시간 구독 훅
 *
 * 특정 채팅방의 새 메시지를 실시간으로 수신합니다.
 * Supabase Realtime postgres_changes 사용.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type {
  ChatUserType,
  ChatMessageType,
  ChatMessageWithSender,
  ChatUser,
  MessagesWithReadStatusResult,
} from "@/lib/domains/chat/types";

// Supabase Realtime Payload 타입 (DB 컬럼과 1:1 매핑)
interface ChatMessagePayload {
  id: string;
  room_id: string;
  sender_id: string;
  sender_type: ChatUserType;
  message_type: ChatMessageType;
  content: string;
  is_deleted: boolean;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 캐시 메시지 타입 (낙관적 업데이트 status 포함)
type CacheMessage = ChatMessageWithSender & {
  status?: "sending" | "sent" | "error";
};

// Infinite Query 캐시 구조 (MessagesWithReadStatusResult 기반)
type MessagesPage = Omit<MessagesWithReadStatusResult, "messages"> & {
  messages: CacheMessage[];
};

// InfiniteQuery 캐시 타입
type InfiniteMessagesCache = InfiniteData<MessagesPage, string | undefined>;

type UseChatRealtimeOptions = {
  /** 채팅방 ID */
  roomId: string;
  /** 현재 사용자 ID (본인 메시지 구분용) */
  userId: string;
  /** 구독 활성화 여부 */
  enabled?: boolean;
  /** 새 메시지 수신 콜백 */
  onNewMessage?: (message: ChatMessagePayload) => void;
  /** 메시지 삭제 콜백 */
  onMessageDeleted?: (messageId: string) => void;
};

/**
 * 채팅 메시지 실시간 구독 훅
 *
 * @example
 * ```tsx
 * useChatRealtime({
 *   roomId: "room-123",
 *   userId: "user-456",
 *   onNewMessage: (msg) => {
 *     // 스크롤 또는 알림 처리
 *   },
 * });
 * ```
 */
export function useChatRealtime({
  roomId,
  userId,
  enabled = true,
  onNewMessage,
  onMessageDeleted,
}: UseChatRealtimeOptions) {
  const queryClient = useQueryClient();

  // 콜백을 ref로 저장하여 의존성 변경 방지
  const callbacksRef = useRef({ onNewMessage, onMessageDeleted });
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onMessageDeleted };
  }, [onNewMessage, onMessageDeleted]);

  // 쿼리 무효화 함수
  const invalidateMessages = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "chat-messages" &&
        query.queryKey[1] === roomId,
    });
  }, [queryClient, roomId]);

  const invalidateRoomList = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) && query.queryKey[0] === "chat-rooms",
    });
  }, [queryClient]);

  const invalidatePinnedMessages = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "chat-pinned" &&
        query.queryKey[1] === roomId,
    });
  }, [queryClient, roomId]);

  const invalidateAnnouncement = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "chat-announcement" &&
        query.queryKey[1] === roomId,
    });
  }, [queryClient, roomId]);

  useEffect(() => {
    if (!enabled || !roomId || !userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`chat-room-${roomId}`)
      // 새 메시지 INSERT
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<ChatMessagePayload>) => {
          console.log("[ChatRealtime] New message:", payload.new);
          const newMessage = payload.new as ChatMessagePayload | undefined;

          // setQueryData로 캐시에 직접 추가 (서버 재요청 없음) - InfiniteQuery 구조
          queryClient.setQueryData<InfiniteMessagesCache>(
            ["chat-messages", roomId],
            (old) => {
              if (!old?.pages?.length || !newMessage) return old;

              // 첫 번째 페이지(최신 메시지들)에서 중복 체크 및 추가
              const firstPage = old.pages[0];
              const existingIndex = firstPage.messages.findIndex(
                (m) =>
                  m.id === newMessage.id ||
                  (m.id.startsWith("temp-") &&
                    m.content === newMessage.content &&
                    m.sender_id === newMessage.sender_id)
              );

              if (existingIndex !== -1) {
                // 낙관적 메시지 → 실제 메시지로 교체
                const updatedMessages = [...firstPage.messages];
                const existingMessage = updatedMessages[existingIndex];
                updatedMessages[existingIndex] = {
                  ...existingMessage,
                  ...newMessage,
                  sender: existingMessage.sender,
                  status: "sent" as const,
                };
                return {
                  ...old,
                  pages: [
                    { ...firstPage, messages: updatedMessages },
                    ...old.pages.slice(1),
                  ],
                };
              }

              // 타인의 새 메시지 추가
              const defaultSender: ChatUser = {
                id: newMessage.sender_id,
                type: newMessage.sender_type,
                name: "알 수 없음",
              };

              const newCacheMessage: CacheMessage = {
                ...newMessage,
                sender: defaultSender,
                reactions: [],
                replyTarget: null,
              };

              return {
                ...old,
                pages: [
                  {
                    ...firstPage,
                    messages: [...firstPage.messages, newCacheMessage],
                  },
                  ...old.pages.slice(1),
                ],
              };
            }
          );

          // 채팅방 목록도 무효화 (마지막 메시지 업데이트)
          invalidateRoomList();

          // 콜백 호출 (타인의 메시지만)
          if (newMessage?.sender_id && newMessage.sender_id !== userId) {
            callbacksRef.current.onNewMessage?.(newMessage);
          }
        }
      )
      // 메시지 UPDATE (삭제/수정 등)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<ChatMessagePayload>) => {
          console.log("[ChatRealtime] Message updated:", payload.new);
          const updatedMessage = payload.new as ChatMessagePayload | undefined;

          // setQueryData로 해당 메시지만 업데이트 (서버 재요청 없음) - InfiniteQuery 구조
          queryClient.setQueryData<InfiniteMessagesCache>(
            ["chat-messages", roomId],
            (old) => {
              if (!old?.pages?.length || !updatedMessage) return old;

              // 모든 페이지에서 해당 메시지 찾아서 업데이트
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  messages: page.messages.map((m) =>
                    m.id === updatedMessage.id
                      ? {
                          ...m,
                          content: updatedMessage.content,
                          is_deleted: updatedMessage.is_deleted,
                          updated_at: updatedMessage.updated_at,
                          deleted_at: updatedMessage.deleted_at,
                        }
                      : m
                  ),
                })),
              };
            }
          );

          // 삭제된 경우 콜백 호출
          if (updatedMessage?.is_deleted && updatedMessage.id) {
            callbacksRef.current.onMessageDeleted?.(updatedMessage.id);
          }
        }
      )
      // 리액션 INSERT
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message_reactions",
        },
        () => {
          console.log("[ChatRealtime] Reaction added");
          invalidateMessages();
        }
      )
      // 리액션 DELETE
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_message_reactions",
        },
        () => {
          console.log("[ChatRealtime] Reaction removed");
          invalidateMessages();
        }
      )
      // 고정 메시지 INSERT
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_pinned_messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          console.log("[ChatRealtime] Message pinned");
          invalidatePinnedMessages();
        }
      )
      // 고정 메시지 DELETE
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_pinned_messages",
        },
        () => {
          console.log("[ChatRealtime] Message unpinned");
          invalidatePinnedMessages();
        }
      )
      // 채팅방 UPDATE (공지 변경)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          console.log("[ChatRealtime] Room updated (announcement)");
          invalidateAnnouncement();
        }
      )
      .subscribe((status) => {
        console.log(`[ChatRealtime] Room ${roomId} subscription:`, status);

        if (status === "SUBSCRIBED") {
          // 연결 성공 또는 재연결(Recovery) 시 최신 데이터 동기화
          // 소켓 연결이 끊긴 동안 누락된 메시지나 변경사항을 불러옵니다.
          console.log("[ChatRealtime] Connected/Reconnected. Syncing data...");
          invalidateMessages();
          invalidateRoomList();
          invalidatePinnedMessages();
          invalidateAnnouncement();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[ChatRealtime] Connection error: ${status}`);
        }
      });

    return () => {
      console.log(`[ChatRealtime] Unsubscribing from room ${roomId}`);
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, enabled, invalidateMessages, invalidateRoomList, invalidatePinnedMessages, invalidateAnnouncement]);
}

// ============================================
// 채팅방 목록 실시간 구독
// ============================================

type UseChatRoomListRealtimeOptions = {
  /** 현재 사용자 ID */
  userId: string;
  /** 사용자 유형 */
  userType: "student" | "admin";
  /** 구독 활성화 여부 */
  enabled?: boolean;
};

/**
 * 채팅방 목록 실시간 구독 훅
 *
 * 새 채팅방 생성, 멤버 변경 등을 실시간으로 반영합니다.
 */
export function useChatRoomListRealtime({
  userId,
  userType,
  enabled = true,
}: UseChatRoomListRealtimeOptions) {
  const queryClient = useQueryClient();

  const invalidateRoomList = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) && query.queryKey[0] === "chat-rooms",
    });
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`chat-rooms-${userId}`)
      // 내가 멤버로 추가된 경우
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_room_members",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[ChatRealtime] Added to room:", payload);
          invalidateRoomList();
        }
      )
      // 멤버십 변경 (나가기 등)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_room_members",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("[ChatRealtime] Membership updated:", payload);
          invalidateRoomList();
        }
      )
      .subscribe((status) => {
        console.log(`[ChatRealtime] Room list subscription:`, status);

        if (status === "SUBSCRIBED") {
          console.log("[ChatRealtime] Room list connected/reconnected. Syncing...");
          invalidateRoomList();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[ChatRealtime] Room list connection error: ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userType, enabled, invalidateRoomList]);
}
