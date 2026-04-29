"use client";

/**
 * 메시지/리액션 Realtime 핸들러 훅
 *
 * - INSERT/UPDATE 핸들러: operationTracker dedup + 배치 버퍼
 * - REACTION_INSERT/DELETE 핸들러: 배치 버퍼
 * - 배치 윈도우: 디바이스 성능 적응형 (50~150ms)
 * - cleanup: 버퍼 타이머 clearTimeout + 남은 항목 즉시 flush
 */

import { useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  REACTION_EMOJIS,
  type ChatUser,
  type ChatUserType,
  type ReactionEmoji,
} from "@/lib/domains/chat/types";
import {
  type InfiniteMessagesCache,
  type CacheMessage,
} from "@/lib/domains/chat/cacheTypes";
import { operationTracker } from "@/lib/domains/chat/operationTracker";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import type { ChatMessagePayload, ChatReactionPayload } from "./chatRealtimeTypes";
import type { LRUCache } from "./useChatSender";

// 프로덕션에서 로그 비활성화
const __DEV__ = process.env.NODE_ENV === "development";
function debugLog(...args: unknown[]) { if (__DEV__) console.log(...args); }
function debugWarn(...args: unknown[]) { if (__DEV__) console.warn(...args); }

/** 메시지를 시간순 정렬 (동일 시각이면 id로 안정 정렬) — 원본 배열을 변경하지 않음 */
function sortMessagesByTime<T extends { created_at: string; id: string }>(msgs: T[]): T[] {
  return [...msgs].sort((a, b) => {
    const t = a.created_at.localeCompare(b.created_at);
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });
}

export type UseChatMessageHandlersOptions = {
  roomId: string;
  userId: string;
  senderCacheRef: React.MutableRefObject<LRUCache<string, ChatUser>>;
  /** fnRef에서 주입되는 함수들 (orchestrator의 fnRef.current 기반) */
  fnRef: React.MutableRefObject<{
    findSenderFromExistingMessages: (senderId: string) => ChatUser | null;
    fetchSenderInfo: (senderId: string, senderType: ChatUserType) => Promise<ChatUser>;
    invalidateRoomList: () => void;
    onMessageDeleted?: (id: string) => void;
    onNewMessage?: (msg: ChatMessagePayload) => void;
    onReadReceipt?: (readerId: string, readAt: string) => void;
  }>;
};

/** 버퍼 상태 (orchestrator가 cleanup 시 참조) */
export type MessageHandlerBuffers = {
  insertBufferTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  reactionBufferTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  flushInsertBuffer: () => void;
  flushReactionBuffer: () => void;
};

export function useChatMessageHandlers({
  roomId,
  userId,
  senderCacheRef,
  fnRef,
}: UseChatMessageHandlersOptions) {
  const queryClient = useQueryClient();

  // === 배치 윈도우 (디바이스 성능 적응형) ===
  const batchWindowMs = (() => {
    if (typeof navigator === "undefined") return 80;
    const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (mem <= 2 || cores <= 2) return 150;
    if (mem >= 8 && cores >= 8) return 50;
    return 80;
  })();

  // === 메시지 INSERT 배치 버퍼 ===
  const INSERT_BATCH_WINDOW_MS = batchWindowMs;
  const insertBufferRef = useRef<Array<{ msg: ChatMessagePayload; tempId: string | undefined }>>([]);
  const insertBufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === 리액션 배치 버퍼 ===
  const REACTION_BATCH_WINDOW_MS = batchWindowMs;
  const reactionBufferRef = useRef<Array<{ reaction: ChatReactionPayload; isAdd: boolean }>>([]);
  const reactionBufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushReactionBuffer = useCallback(() => {
    const batch = reactionBufferRef.current.splice(0);
    reactionBufferTimerRef.current = null;

    if (batch.length === 0) return;

    debugLog(`[ChatRealtime] Flushing ${batch.length} buffered reactions`);

    queryClient.setQueryData<InfiniteMessagesCache>(
      chatKeys.messages(roomId),
      (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => {
              // 이 메시지에 해당하는 리액션만 필터
              const relatedReactions = batch.filter((b) => b.reaction.message_id === m.id);
              if (relatedReactions.length === 0) return m;

              const reactions = [...(m.reactions ?? [])];

              for (const { reaction, isAdd } of relatedReactions) {
                const existingIdx = reactions.findIndex((r) => r.emoji === reaction.emoji);

                if (isAdd) {
                  if (existingIdx >= 0) {
                    if (reaction.user_id === userId && reactions[existingIdx].hasReacted) continue;
                    reactions[existingIdx] = {
                      ...reactions[existingIdx],
                      count: reactions[existingIdx].count + 1,
                      hasReacted: reactions[existingIdx].hasReacted || reaction.user_id === userId,
                    };
                  } else {
                    reactions.push({
                      emoji: reaction.emoji as ReactionEmoji,
                      count: 1,
                      hasReacted: reaction.user_id === userId,
                    });
                  }
                } else {
                  if (existingIdx >= 0) {
                    if (reaction.user_id === userId && !reactions[existingIdx].hasReacted) continue;
                    const newCount = reactions[existingIdx].count - 1;
                    if (newCount <= 0) {
                      reactions.splice(existingIdx, 1);
                    } else {
                      reactions[existingIdx] = {
                        ...reactions[existingIdx],
                        count: newCount,
                        hasReacted: reaction.user_id === userId ? false : reactions[existingIdx].hasReacted,
                      };
                    }
                  }
                }
              }

              return { ...m, reactions };
            }),
          })),
        };
      }
    );
  }, [queryClient, roomId, userId]);

  const flushInsertBuffer = useCallback(() => {
    const batch = insertBufferRef.current.splice(0);
    insertBufferTimerRef.current = null;

    if (batch.length === 0) return;

    debugLog(`[ChatRealtime] Flushing ${batch.length} buffered inserts`);

    // 한 번의 setQueryData로 모든 메시지 적용 (1 React 리렌더)
    queryClient.setQueryData<InfiniteMessagesCache>(
      chatKeys.messages(roomId),
      (old) => {
        if (!old?.pages?.length) return old;

        const firstPage = old.pages[0];
        const messages = [...firstPage.messages];

        // O(1) 조회용 인덱스 구축 (id → index, content+sender → index for temp matching)
        const idIndex = new Map<string, number>();
        const tempContentIndex = new Map<string, number>();
        for (let i = 0; i < messages.length; i++) {
          const m = messages[i];
          idIndex.set(m.id, i);
          if (m.id.startsWith("temp-")) {
            const contentKey = `${m.content}::${m.sender_id}`;
            // 동일 content+sender의 temp가 여러 개면 첫 번째를 유지 (findIndex 동작 일치)
            if (!tempContentIndex.has(contentKey)) {
              tempContentIndex.set(contentKey, i);
            }
          }
        }

        for (const { msg: newMessage, tempId } of batch) {
          // O(1) 중복 체크 (id 매칭 → tempId 매칭 → content 기반 temp 매칭)
          const existingIndex =
            idIndex.get(newMessage.id) ??
            (tempId ? idIndex.get(tempId) : undefined) ??
            tempContentIndex.get(`${newMessage.content}::${newMessage.sender_id}`) ??
            -1;

          if (existingIndex !== -1) {
            // 낙관적 메시지 → 실제 메시지로 교체
            const existingMessage = messages[existingIndex];
            messages[existingIndex] = {
              ...existingMessage,
              ...newMessage,
              sender: existingMessage.sender,
              status: "sent" as const,
            };
            // 인덱스 갱신 (temp id → real id 교체)
            idIndex.set(newMessage.id, existingIndex);
          } else {
            // 새 메시지 추가
            const cacheKey = `${newMessage.sender_id}_${newMessage.sender_type}`;
            const existingSender = fnRef.current.findSenderFromExistingMessages(
              newMessage.sender_id
            );
            const senderFromCache = senderCacheRef.current.get(cacheKey);

            // 비정규화된 sender 정보가 있으면 캐시에 저장 (fetch 생략 가능)
            let denormalizedSender: ChatUser | undefined;
            if (!existingSender && !senderFromCache && newMessage.sender_name) {
              denormalizedSender = {
                id: newMessage.sender_id,
                type: newMessage.sender_type,
                name: newMessage.sender_name,
                profileImageUrl: newMessage.sender_profile_url ?? undefined,
              };
              senderCacheRef.current.set(cacheKey, denormalizedSender);
            }

            const tempSender: ChatUser =
              existingSender ??
              senderFromCache ??
              denormalizedSender ?? {
                id: newMessage.sender_id,
                type: newMessage.sender_type,
                name: newMessage.sender_name ?? "로딩 중...",
              };

            const newIndex = messages.length;
            messages.push({
              ...newMessage,
              sender: tempSender,
              reactions: [],
              replyTarget: null,
              sender_name: newMessage.sender_name ?? tempSender.name,
              sender_profile_url: newMessage.sender_profile_url ?? tempSender.profileImageUrl ?? null,
              metadata: null,
            } as CacheMessage);
            // 인덱스 갱신 (새 메시지 추가)
            idIndex.set(newMessage.id, newIndex);
          }
        }

        // 병합 후 시간순 정렬
        const sortedMessages = sortMessagesByTime(messages);

        return {
          ...old,
          pages: [
            { ...firstPage, messages: sortedMessages },
            ...old.pages.slice(1),
          ],
        };
      }
    );

    // 후처리: 한 번만 실행 (배치 전체에 대해)
    fnRef.current.invalidateRoomList();

    // 개별 메시지별 후처리
    for (const { msg: newMessage } of batch) {
      // 타인 메시지 sender 정보 보강
      if (newMessage.sender_id && newMessage.sender_id !== userId) {
        const cacheKey = `${newMessage.sender_id}_${newMessage.sender_type}`;
        const hasSenderInfo =
          fnRef.current.findSenderFromExistingMessages(newMessage.sender_id) ??
          senderCacheRef.current.get(cacheKey);

        if (!hasSenderInfo && !newMessage.sender_name) {
          // 비정규화 sender 정보도 없는 경우에만 fetch
          fnRef.current.fetchSenderInfo(newMessage.sender_id, newMessage.sender_type)
            .then((senderInfo) => {
              queryClient.setQueryData<InfiniteMessagesCache>(
                chatKeys.messages(roomId),
                (old) => {
                  if (!old?.pages?.length) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page) => ({
                      ...page,
                      messages: page.messages.map((m) =>
                        m.id === newMessage.id ? { ...m, sender: senderInfo } : m
                      ),
                    })),
                  };
                }
              );
            })
            .catch((error) => {
              debugWarn("[ChatRealtime] Failed to fetch sender info:", error);
            });
        }

        fnRef.current.onNewMessage?.(newMessage);
      }
    }
  }, [queryClient, roomId, userId, senderCacheRef, fnRef]);

  // === INSERT 핸들러 ===
  const handleMessageInsert = useCallback((newMessage: ChatMessagePayload) => {
    // 이벤트 ID 생성 (중복 처리 방지) — dedup은 즉시 실행
    const eventId = `insert:${newMessage.id}`;

    if (operationTracker.isRealtimeProcessed(eventId)) {
      return;
    }

    if (operationTracker.isMessageBeingSent(newMessage.id)) {
      operationTracker.markRealtimeProcessed(eventId);
      return;
    }

    if (newMessage.sender_id === userId) {
      const cache = queryClient.getQueryData<InfiniteMessagesCache>(chatKeys.messages(roomId));
      const hasPendingTemp = cache?.pages?.[0]?.messages.some(
        (m) =>
          m.id.startsWith("temp-") &&
          m.content === newMessage.content &&
          m.sender_id === newMessage.sender_id &&
          m.status !== "error"
      );
      if (hasPendingTemp) {
        operationTracker.markRealtimeProcessed(eventId);
        return;
      }
    }

    let tempId = operationTracker.getTempIdForRealId(newMessage.id);
    // DB trigger broadcast가 completeSend보다 먼저 도착하면 tempId가 없을 수 있음
    // → content 기반으로 pending send를 찾아서 매칭
    if (!tempId && newMessage.sender_id === userId) {
      tempId = operationTracker.findPendingSendByContent(newMessage.content, roomId);
      if (tempId) {
        operationTracker.completeSend(tempId, newMessage.id);
      }
    }

    // 버퍼에 추가 (setQueryData는 배치 후 실행)
    insertBufferRef.current.push({ msg: newMessage, tempId });
    operationTracker.markRealtimeProcessed(eventId);

    if (!insertBufferTimerRef.current) {
      insertBufferTimerRef.current = setTimeout(flushInsertBuffer, INSERT_BATCH_WINDOW_MS);
    }
  }, [queryClient, roomId, userId, flushInsertBuffer, INSERT_BATCH_WINDOW_MS]);

  // === UPDATE 핸들러 ===
  const handleMessageUpdate = useCallback((updatedMessage: ChatMessagePayload) => {
    // UPDATE dedup: 클라이언트 broadcast와 DB trigger broadcast 양쪽에서 수신되므로 중복 방지
    const eventId = `update:${updatedMessage.id}:${updatedMessage.updated_at}`;
    if (operationTracker.isRealtimeProcessed(eventId)) {
      debugLog("[ChatRealtime] Skipping already processed update:", eventId);
      return;
    }

    // setQueryData로 해당 메시지만 업데이트 (서버 재요청 없음) - InfiniteQuery 구조
    queryClient.setQueryData<InfiniteMessagesCache>(
      chatKeys.messages(roomId),
      (old) => {
        if (!old?.pages?.length) return old;

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
                    // attachments, linkPreviews, reactions, replyTarget, sender 등
                    // 기존 캐시 값을 ...m 스프레드로 보존 (broadcast payload에 미포함)
                  }
                : m
            ),
          })),
        };
      }
    );

    // 삭제된 경우 콜백 호출
    if (updatedMessage.is_deleted && updatedMessage.id) {
      fnRef.current.onMessageDeleted?.(updatedMessage.id);
    }

    operationTracker.markRealtimeProcessed(eventId);
  }, [queryClient, roomId, fnRef]);

  // === REACTION_INSERT 핸들러 ===
  const handleReactionInsert = useCallback((reaction: ChatReactionPayload) => {
    debugLog("[ChatRealtime] Reaction added:", reaction?.message_id);

    if (reaction?.message_id && (REACTION_EMOJIS as readonly string[]).includes(reaction.emoji)) {
      const pendingState = operationTracker.isReactionPending(
        reaction.message_id,
        reaction.emoji
      );

      if (reaction.user_id === userId && pendingState.isPending && pendingState.isAdd) {
        debugLog("[ChatRealtime] Skipping pending reaction add:", reaction.message_id, reaction.emoji);
        return;
      }

      reactionBufferRef.current.push({ reaction, isAdd: true });
      if (!reactionBufferTimerRef.current) {
        reactionBufferTimerRef.current = setTimeout(flushReactionBuffer, REACTION_BATCH_WINDOW_MS);
      }
    }
  }, [userId, flushReactionBuffer, REACTION_BATCH_WINDOW_MS]);

  // === REACTION_DELETE 핸들러 ===
  const handleReactionDelete = useCallback((reaction: ChatReactionPayload) => {
    debugLog("[ChatRealtime] Reaction removed:", reaction?.message_id);

    if (reaction?.message_id && (REACTION_EMOJIS as readonly string[]).includes(reaction.emoji)) {
      const pendingState = operationTracker.isReactionPending(
        reaction.message_id,
        reaction.emoji
      );

      if (reaction.user_id === userId && pendingState.isPending && !pendingState.isAdd) {
        debugLog("[ChatRealtime] Skipping pending reaction remove:", reaction.message_id, reaction.emoji);
        return;
      }

      reactionBufferRef.current.push({ reaction, isAdd: false });
      if (!reactionBufferTimerRef.current) {
        reactionBufferTimerRef.current = setTimeout(flushReactionBuffer, REACTION_BATCH_WINDOW_MS);
      }
    }
  }, [userId, flushReactionBuffer, REACTION_BATCH_WINDOW_MS]);

  return {
    handleMessageInsert,
    handleMessageUpdate,
    handleReactionInsert,
    handleReactionDelete,
    flushInsertBuffer,
    flushReactionBuffer,
    insertBufferTimerRef,
    reactionBufferTimerRef,
    insertBufferRef,
    reactionBufferRef,
  };
}
