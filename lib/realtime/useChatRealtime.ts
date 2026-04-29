"use client";

/**
 * 채팅 메시지 실시간 구독 훅
 *
 * 특정 채팅방의 새 메시지를 실시간으로 수신합니다.
 * Supabase Realtime broadcast (DB trigger) 사용.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  REACTION_EMOJIS,
  type ChatUser,
  type ChatAttachment,
  type ChatLinkPreview,
  type ReactionEmoji,
} from "@/lib/domains/chat/types";
import {
  type InfiniteMessagesCache,
  type CacheMessage,
} from "@/lib/domains/chat/cacheTypes";
import { operationTracker } from "@/lib/domains/chat/operationTracker";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { connectionManager } from "./connectionManager";
import {
  type ChatMessagePayload,
  type ChatReactionPayload,
  type UseChatRealtimeOptions,
} from "./chatRealtimeTypes";
import { useChatSender } from "./useChatSender";
import { useChatMessageSync } from "./useChatMessageSync";

// 소비처 import 경로 호환성 유지 (useChatRoomLogic.ts 등)
export type { ChatMessagePayload } from "./chatRealtimeTypes";

// 프로덕션에서 로그 비활성화 (console.log/warn → dev only)
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
  senderCache,
  onNewMessage,
  onMessageDeleted,
  onReadReceipt,
}: UseChatRealtimeOptions) {
  const queryClient = useQueryClient();

  // 재연결 트리거 (수동 재연결 시 증가하여 useEffect 재실행)
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // Broadcast-first: 채널 참조 (broadcastInsert에서 사용)
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 채널 미연결 시 broadcast 대기열 (SUBSCRIBED 후 flush)
  const pendingBroadcastsRef = useRef<Array<{ event: string; payload: Record<string, unknown> }>>(
    []
  );

  // 채널 SUBSCRIBED 상태 추적 (send() REST fallback 방지)
  const isSubscribedRef = useRef(false);

  // 콜백을 ref로 저장하여 의존성 변경 방지
  const callbacksRef = useRef({ onNewMessage, onMessageDeleted, onReadReceipt });
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onMessageDeleted, onReadReceipt };
  }, [onNewMessage, onMessageDeleted, onReadReceipt]);

  // 발신자 정보 조회 (LRU 캐시 + 100ms 배치 RPC) — useChatSender로 분리
  const {
    senderCacheRef,
    batchRef,
    fetchSenderInfo,
    findSenderFromExistingMessages,
  } = useChatSender({ roomId, senderCache });

  // 쿼리 무효화 함수
  const invalidateMessages = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "chat-messages" &&
        query.queryKey[1] === roomId,
    });
  }, [queryClient, roomId]);

  const invalidateRoomDetail = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "chat-room" &&
        query.queryKey[1] === roomId,
    });
  }, [queryClient, roomId]);

  const invalidateRoomList = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) && query.queryKey[0] === chatKeys.rooms()[0],
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

  // 증분 동기화 (재연결 시 최적화) — useChatMessageSync로 분리
  const { syncMessagesSince } = useChatMessageSync({ roomId });

  // 초기 마운트 추적 (자동 재연결과 구분하기 위해 별도 ref 사용)
  const isInitialMountRef = useRef(true);

  // 채널 연결 후 대기 중인 broadcast를 flush
  const flushPendingBroadcasts = useCallback(async () => {
    const pending = pendingBroadcastsRef.current;
    if (pending.length === 0 || !channelRef.current || !isSubscribedRef.current) return;
    pendingBroadcastsRef.current = [];

    for (const { event, payload } of pending) {
      try {
        await channelRef.current.send({ type: "broadcast", event, payload });
        debugLog(`[ChatRealtime] Flushed pending ${event}`);
      } catch (error) {
        debugWarn(`[ChatRealtime] Failed to flush pending ${event}:`, error);
      }
    }
  }, []);

  // 메인 useEffect에서 사용하는 함수들을 ref로 추적
  // → 함수 참조 변경 시 채널 재구독을 방지
  const fnRef = useRef({
    syncMessagesSince,
    invalidateRoomList,
    invalidateRoomDetail,
    invalidatePinnedMessages,
    invalidateAnnouncement,
    fetchSenderInfo,
    findSenderFromExistingMessages,
    flushPendingBroadcasts,
  });
  useEffect(() => {
    fnRef.current = {
      syncMessagesSince,
      invalidateRoomList,
      invalidateRoomDetail,
      invalidatePinnedMessages,
      invalidateAnnouncement,
      fetchSenderInfo,
      findSenderFromExistingMessages,
      flushPendingBroadcasts,
    };
  });

  useEffect(() => {
    if (!enabled || !roomId || !userId) {
      return;
    }

    // 싱글톤 클라이언트 사용 (모듈 레벨에서 import)
    const channelName = connectionManager.getChannelKey(roomId);
    const currentBatch = batchRef.current;

    // 재연결 콜백 등록 (수동 재연결 버튼용)
    connectionManager.registerReconnectCallback(channelName, async () => {
      debugLog("[ChatRealtime] Reconnect callback triggered");
      // 트리거 증가로 useEffect 재실행 → 채널 재구독
      setReconnectTrigger((prev) => prev + 1);
    });

    // 공지 변경 감지용 (announcement_at 추적)
    const lastAnnouncementAtRef = { current: null as string | null };

    // 지연 invalidation 타이머 (cleanup용)
    let delayedInvalidationTimer: ReturnType<typeof setTimeout> | null = null;

    // === 배치 윈도우 (디바이스 성능 적응형) ===
    // low: 여유 있게 모아서 처리, high: 즉시성 우선
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
    const insertBuffer: Array<{ msg: ChatMessagePayload; tempId: string | undefined }> = [];
    let insertBufferTimer: ReturnType<typeof setTimeout> | null = null;

    // === 리액션 배치 버퍼 ===
    const REACTION_BATCH_WINDOW_MS = batchWindowMs;
    const reactionBuffer: Array<{ reaction: ChatReactionPayload; isAdd: boolean }> = [];
    let reactionBufferTimer: ReturnType<typeof setTimeout> | null = null;

    const flushReactionBuffer = () => {
      const batch = reactionBuffer.splice(0);
      reactionBufferTimer = null;

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
    };

    const flushInsertBuffer = () => {
      const batch = insertBuffer.splice(0);
      insertBufferTimer = null;

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

          callbacksRef.current.onNewMessage?.(newMessage);
        }
      }
    };

    // === 핸들러 함수 추출 (클라이언트 broadcast + DB trigger broadcast 양쪽에서 재사용) ===
    const handleMessageInsert = (newMessage: ChatMessagePayload) => {
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

      // 버퍼에 추가 (setQueryData는 50ms 후 배치 실행)
      insertBuffer.push({ msg: newMessage, tempId });
      operationTracker.markRealtimeProcessed(eventId);

      if (!insertBufferTimer) {
        insertBufferTimer = setTimeout(flushInsertBuffer, INSERT_BATCH_WINDOW_MS);
      }
    };

    const handleMessageUpdate = (updatedMessage: ChatMessagePayload) => {
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
        callbacksRef.current.onMessageDeleted?.(updatedMessage.id);
      }

      operationTracker.markRealtimeProcessed(eventId);
    };

    // broadcast_changes payload 노멀라이저:
    // - 클라이언트 broadcastInsert: event.payload = flat ChatMessagePayload (id 필드 있음)
    // - DB trigger (realtime.broadcast_changes): event.payload = { record: {...}, old_record: {...}, ... }
    type BroadcastPayload = Record<string, unknown>;
    /** 메시지용: client broadcast(flat) 또는 DB trigger(nested record) 양쪽 지원 */
    const normalizeMessagePayload = (raw: BroadcastPayload): ChatMessagePayload | undefined => {
      if (raw.record) return raw.record as ChatMessagePayload;
      if (raw.id) return raw as unknown as ChatMessagePayload;
      return undefined;
    };
    /** DB trigger 전용: record 필드에서 추출 */
    const extractRecord = <T>(raw: BroadcastPayload): T | undefined =>
      raw.record as T | undefined;
    const extractOldRecord = <T>(raw: BroadcastPayload): T | undefined =>
      raw.old_record as T | undefined;

    const channel = supabase
      .channel(`chat-room-${roomId}`, {
        config: { private: true, broadcast: { ack: true } },
      })
      // === 메시지: broadcast from client (broadcastInsert) + DB trigger ===
      .on(
        "broadcast",
        { event: "INSERT" },
        (event: { payload: BroadcastPayload }) => {
          const msg = normalizeMessagePayload(event.payload);
          if (msg?.id) {
            const ts = new Date(msg.created_at).getTime();
            const latency = Number.isNaN(ts) ? "?" : `${Date.now() - ts}`;
            debugLog(`[ChatRealtime] Broadcast INSERT: ${msg.id} (latency: ${latency}ms)`);
            handleMessageInsert(msg);
          }
        }
      )
      .on(
        "broadcast",
        { event: "UPDATE" },
        (event: { payload: BroadcastPayload }) => {
          const msg = normalizeMessagePayload(event.payload);
          if (msg?.id) {
            const ts = new Date(msg.updated_at).getTime();
            const latency = Number.isNaN(ts) ? "?" : `${Date.now() - ts}`;
            debugLog(`[ChatRealtime] Broadcast UPDATE: ${msg.id} (latency: ${latency}ms)`);
            handleMessageUpdate(msg);
          }
        }
      )
      // === 리액션: broadcast from DB trigger (50ms 배치 버퍼) ===
      .on(
        "broadcast",
        { event: "REACTION_INSERT" },
        (event: { payload: BroadcastPayload }) => {
          const reaction = extractRecord<ChatReactionPayload>(event.payload);
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

            reactionBuffer.push({ reaction, isAdd: true });
            if (!reactionBufferTimer) {
              reactionBufferTimer = setTimeout(flushReactionBuffer, REACTION_BATCH_WINDOW_MS);
            }
          }
        }
      )
      .on(
        "broadcast",
        { event: "REACTION_DELETE" },
        (event: { payload: BroadcastPayload }) => {
          const reaction = extractOldRecord<ChatReactionPayload>(event.payload) ?? extractRecord<ChatReactionPayload>(event.payload);
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

            reactionBuffer.push({ reaction, isAdd: false });
            if (!reactionBufferTimer) {
              reactionBufferTimer = setTimeout(flushReactionBuffer, REACTION_BATCH_WINDOW_MS);
            }
          }
        }
      )
      // === 고정 메시지: broadcast from DB trigger ===
      .on(
        "broadcast",
        { event: "PIN_INSERT" },
        () => {
          debugLog("[ChatRealtime] Message pinned");
          fnRef.current.invalidatePinnedMessages();
        }
      )
      .on(
        "broadcast",
        { event: "PIN_DELETE" },
        () => {
          debugLog("[ChatRealtime] Message unpinned");
          fnRef.current.invalidatePinnedMessages();
        }
      )
      // === 채팅방 공지: broadcast from DB trigger ===
      .on(
        "broadcast",
        { event: "ROOM_UPDATE" },
        (event: { payload: BroadcastPayload }) => {
          const newRoom = extractRecord<{ announcement_at?: string | null }>(event.payload);
          const announcementAt = newRoom?.announcement_at ?? null;

          if (announcementAt !== lastAnnouncementAtRef.current) {
            lastAnnouncementAtRef.current = announcementAt;
            debugLog("[ChatRealtime] Announcement changed");
            fnRef.current.invalidateAnnouncement();
          }
        }
      )
      // === 읽음 확인: broadcast from client ===
      .on(
        "broadcast",
        { event: "READ_RECEIPT" },
        (event: { payload: BroadcastPayload }) => {
          const data = event.payload as { reader_id?: string; read_at?: string };
          if (data.reader_id && data.reader_id !== userId && data.read_at) {
            debugLog("[ChatRealtime] Read receipt from:", data.reader_id);
            callbacksRef.current.onReadReceipt?.(data.reader_id, data.read_at);
          }
        }
      )
      // === 채팅방 멤버: broadcast from DB trigger ===
      .on(
        "broadcast",
        { event: "MEMBER_UPDATE" },
        (event: { payload: BroadcastPayload }) => {
          const member = extractRecord<{ left_at: string | null; user_id: string }>(event.payload);
          if (member) {
            const action = member.left_at !== null ? "left" : "rejoined";
            debugLog(`[ChatRealtime] Member ${action} room:`, member.user_id);
            queryClient.invalidateQueries({ queryKey: chatKeys.room(roomId) });
          }
        }
      )
      // === 첨부파일: broadcast from DB trigger ===
      .on(
        "broadcast",
        { event: "ATTACHMENT_INSERT" },
        (event: { payload: BroadcastPayload }) => {
          const attachment = extractRecord<ChatAttachment>(event.payload);
          if (!attachment?.message_id) return;

          debugLog("[ChatRealtime] Attachment added:", attachment.id, "for message:", attachment.message_id);

          queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
            (old) => {
              if (!old?.pages?.length) return old;
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  messages: page.messages.map((m) => {
                    if (m.id !== attachment.message_id) return m;
                    const existing = m.attachments ?? [];
                    // 중복 방지
                    if (existing.some((a) => a.id === attachment.id)) return m;
                    return { ...m, attachments: [...existing, attachment] };
                  }),
                })),
              };
            }
          );
        }
      )
      // === 링크 프리뷰: broadcast from DB trigger ===
      .on(
        "broadcast",
        { event: "LINK_PREVIEW_INSERT" },
        (event: { payload: BroadcastPayload }) => {
          const preview = extractRecord<ChatLinkPreview>(event.payload);
          if (!preview?.message_id) return;

          debugLog("[ChatRealtime] Link preview added:", preview.url, "for message:", preview.message_id);

          queryClient.setQueryData<InfiniteMessagesCache>(
            chatKeys.messages(roomId),
            (old) => {
              if (!old?.pages?.length) return old;
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  messages: page.messages.map((m) => {
                    if (m.id !== preview.message_id) return m;
                    const existing = m.linkPreviews ?? [];
                    // 중복 방지 (같은 URL)
                    if (existing.some((lp) => lp.id === preview.id)) return m;
                    return { ...m, linkPreviews: [...existing, preview] };
                  }),
                })),
              };
            }
          );
        }
      )
      .subscribe((status) => {
        debugLog(`[ChatRealtime] Room ${roomId} subscription:`, status);

        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
          // ConnectionManager에 연결 상태 알림
          connectionManager.setChannelState(channelName, "connected");

          // 채널 미연결 중 큐잉된 broadcast (READ_RECEIPT 등) flush
          fnRef.current.flushPendingBroadcasts();

          if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            // 첫 마운트: 캐시 유무와 관계없이 항상 sync 실행
            // (hover prefetch로 캐시가 있어도 그 이후 새 메시지가 있을 수 있음)
            debugLog("[ChatRealtime] Initial mount, syncing...");
            fnRef.current.syncMessagesSince();
            // roomList은 스킵 (방금 목록에서 왔으므로 최신)
          } else {
            // 재연결 또는 자동 복구: 누락 메시지 복구 필요
            debugLog("[ChatRealtime] Reconnected. Syncing missed messages...");
            fnRef.current.syncMessagesSince();
            // 재연결 중 놓친 READ_RECEIPT 복구를 위해 roomDetail 갱신
            // → member.last_read_at 최신화 → readReceiptTrackRef + readCounts 재계산
            fnRef.current.invalidateRoomDetail();
          }

          // 부가 데이터는 항상 가져오되 지연 실행 (메시지 처리 우선)
          delayedInvalidationTimer = setTimeout(() => {
            delayedInvalidationTimer = null;
            fnRef.current.invalidatePinnedMessages();
            fnRef.current.invalidateAnnouncement();
          }, 1000);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[ChatRealtime] Connection error: ${status}`);
          // ConnectionManager에 연결 끊김 알림
          connectionManager.handleDisconnect(channelName);
        }
      });

    // Broadcast-first: 채널 참조 저장
    channelRef.current = channel;

    // 탭 복귀 시 누락 메시지 동기화 (5초 debounce)
    let lastVisibilitySyncAt = 0;
    const VISIBILITY_SYNC_DEBOUNCE_MS = 3000;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilitySyncAt < VISIBILITY_SYNC_DEBOUNCE_MS) return;
      lastVisibilitySyncAt = now;
      debugLog("[ChatRealtime] Tab visible — syncing missed messages & read counts");
      fnRef.current.syncMessagesSince();
      // 탭 비활성 중 놓친 READ_RECEIPT 복구를 위해 roomDetail 갱신
      fnRef.current.invalidateRoomDetail();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      debugLog(`[ChatRealtime] Unsubscribing from room ${roomId}`);
      // visibilitychange 리스너 정리
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Broadcast-first: 채널 참조 초기화
      channelRef.current = null;
      isSubscribedRef.current = false;
      // 지연 invalidation 타이머 정리
      if (delayedInvalidationTimer) {
        clearTimeout(delayedInvalidationTimer);
        delayedInvalidationTimer = null;
      }
      // 메시지 INSERT 배치 버퍼 정리 (남은 메시지 즉시 플러시)
      if (insertBufferTimer) {
        clearTimeout(insertBufferTimer);
        insertBufferTimer = null;
        if (insertBuffer.length > 0) {
          flushInsertBuffer();
        }
      }
      // 리액션 배치 버퍼 정리 (남은 리액션 즉시 플러시)
      if (reactionBufferTimer) {
        clearTimeout(reactionBufferTimer);
        reactionBufferTimer = null;
        if (reactionBuffer.length > 0) {
          flushReactionBuffer();
        }
      }
      // sender 배치 타이머 + 대기 중 요청 정리
      if (currentBatch.timer) {
        clearTimeout(currentBatch.timer);
        currentBatch.timer = null;
      }
      // 방 전환 시 대기 중인 sender fetch 요청을 reject하여 Promise 누수 방지
      for (const [, entry] of currentBatch.pending) {
        entry.resolvers.forEach((r) =>
          r.reject(new Error("Room changed, batch cancelled"))
        );
      }
      currentBatch.pending.clear();
      supabase.removeChannel(channel);
      // 재연결 콜백 해제
      connectionManager.unregisterReconnectCallback(channelName);
      // 방 나갈 때 해당 방 관련 pending 작업 정리
      operationTracker.clearForRoom(roomId);
    };
  // batchRef·senderCacheRef는 useRef로 생성된 stable 참조 — 의존성 배열 포함 불필요
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, enabled, queryClient, reconnectTrigger]);

  // 주기적 cleanup (5분마다 타임아웃된 작업 + 오래된 pending 요청 정리)
  useEffect(() => {
    if (!enabled) return;

    const cleanupInterval = setInterval(() => {
      operationTracker.cleanup();
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(cleanupInterval);
  }, [enabled]);

  // Broadcast-first: 클라이언트에서 직접 broadcast 전송 (DB INSERT 전)
  const broadcastInsert = useCallback(
    async (message: ChatMessagePayload) => {
      if (!channelRef.current || !isSubscribedRef.current) {
        debugWarn("[ChatRealtime] Channel not subscribed, queuing INSERT broadcast");
        pendingBroadcastsRef.current.push({ event: "INSERT", payload: message as unknown as Record<string, unknown> });
        return;
      }
      try {
        const status = await channelRef.current.send({
          type: "broadcast",
          event: "INSERT",
          payload: message,
        });
        if (status !== "ok") {
          debugWarn("[ChatRealtime] Broadcast ack failed:", status);
        }
      } catch (error) {
        debugWarn("[ChatRealtime] Broadcast send error:", error);
      }
    },
    []
  );

  // 읽음 확인 broadcast (markAsRead 성공 후 호출, 서버 시각 사용)
  // 채널 미연결 시 pendingBroadcastsRef에 큐잉 → SUBSCRIBED 후 flush
  const broadcastReadReceipt = useCallback(
    async (readAt?: string) => {
      const payload = { reader_id: userId, read_at: readAt ?? new Date().toISOString() };

      if (!channelRef.current || !isSubscribedRef.current) {
        debugLog("[ChatRealtime] Channel not subscribed, queuing READ_RECEIPT");
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
        debugWarn("[ChatRealtime] ReadReceipt broadcast error:", error);
      }
    },
    [userId]
  );

  return { broadcastInsert, broadcastReadReceipt };
}
