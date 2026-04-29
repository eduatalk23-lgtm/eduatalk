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
  type ChatAttachment,
  type ChatLinkPreview,
} from "@/lib/domains/chat/types";
import {
  type InfiniteMessagesCache,
} from "@/lib/domains/chat/cacheTypes";
import { operationTracker } from "@/lib/domains/chat/operationTracker";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { connectionManager } from "./connectionManager";
import {
  type ChatMessagePayload,
  type UseChatRealtimeOptions,
} from "./chatRealtimeTypes";
import { useChatSender } from "./useChatSender";
import { useChatMessageSync } from "./useChatMessageSync";
import { useChatMessageHandlers } from "./useChatMessageHandlers";
import { useChatBroadcast } from "./useChatBroadcast";

// 소비처 import 경로 호환성 유지 (useChatRoomLogic.ts 등)
export type { ChatMessagePayload } from "./chatRealtimeTypes";

// 프로덕션에서 로그 비활성화 (console.log/warn → dev only)
const __DEV__ = process.env.NODE_ENV === "development";
function debugLog(...args: unknown[]) { if (__DEV__) console.log(...args); }
function debugWarn(...args: unknown[]) { if (__DEV__) console.warn(...args); }

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

  // Broadcast-first: 채널 참조 (broadcast 훅에서 사용)
  const channelRef = useRef<RealtimeChannel | null>(null);

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

  // === Broadcast 전송 (useChatBroadcast로 분리) ===
  const {
    flushPendingBroadcasts,
    clearPendingBroadcasts,
    broadcastInsert,
    broadcastReadReceipt,
  } = useChatBroadcast({ userId, channelRef, isSubscribedRef });

  // 핸들러 훅에 주입할 fnRef (orchestrator 함수들 + 콜백 브릿지)
  // → useChatMessageHandlers가 참조하는 콜백을 안정적으로 전달
  const handlerFnRef = useRef({
    findSenderFromExistingMessages,
    fetchSenderInfo,
    invalidateRoomList,
    onMessageDeleted: onMessageDeleted as ((id: string) => void) | undefined,
    onNewMessage: onNewMessage as ((msg: ChatMessagePayload) => void) | undefined,
    onReadReceipt: onReadReceipt as ((readerId: string, readAt: string) => void) | undefined,
  });
  useEffect(() => {
    handlerFnRef.current = {
      findSenderFromExistingMessages,
      fetchSenderInfo,
      invalidateRoomList,
      onMessageDeleted,
      onNewMessage,
      onReadReceipt,
    };
  });

  // === 메시지/리액션 핸들러 (useChatMessageHandlers로 분리) ===
  const {
    handleMessageInsert,
    handleMessageUpdate,
    handleReactionInsert,
    handleReactionDelete,
    flushInsertBuffer,
    flushReactionBuffer,
    insertBufferTimerRef,
    reactionBufferTimerRef,
  } = useChatMessageHandlers({
    roomId,
    userId,
    senderCacheRef,
    fnRef: handlerFnRef,
  });

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
    clearPendingBroadcasts,
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
      clearPendingBroadcasts,
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
      // === 리액션: broadcast from DB trigger (배치 버퍼) ===
      .on(
        "broadcast",
        { event: "REACTION_INSERT" },
        (event: { payload: BroadcastPayload }) => {
          const reaction = extractRecord<import("./chatRealtimeTypes").ChatReactionPayload>(event.payload);
          if (reaction) handleReactionInsert(reaction);
        }
      )
      .on(
        "broadcast",
        { event: "REACTION_DELETE" },
        (event: { payload: BroadcastPayload }) => {
          const reaction =
            extractOldRecord<import("./chatRealtimeTypes").ChatReactionPayload>(event.payload) ??
            extractRecord<import("./chatRealtimeTypes").ChatReactionPayload>(event.payload);
          if (reaction) handleReactionDelete(reaction);
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

    // 탭 복귀 시 누락 메시지 동기화 (3초 debounce)
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
      // 대기 중 broadcast 큐 비우기 (방 전환 시 오래된 큐 제거)
      fnRef.current.clearPendingBroadcasts();
      // 지연 invalidation 타이머 정리
      if (delayedInvalidationTimer) {
        clearTimeout(delayedInvalidationTimer);
        delayedInvalidationTimer = null;
      }
      // 메시지 INSERT 배치 버퍼 정리 (남은 메시지 즉시 플러시)
      if (insertBufferTimerRef.current) {
        clearTimeout(insertBufferTimerRef.current);
        insertBufferTimerRef.current = null;
        flushInsertBuffer();
      }
      // 리액션 배치 버퍼 정리 (남은 리액션 즉시 플러시)
      if (reactionBufferTimerRef.current) {
        clearTimeout(reactionBufferTimerRef.current);
        reactionBufferTimerRef.current = null;
        flushReactionBuffer();
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
  }, [roomId, userId, enabled, queryClient, reconnectTrigger, handleMessageInsert, handleMessageUpdate, handleReactionInsert, handleReactionDelete]);

  // 주기적 cleanup (5분마다 타임아웃된 작업 + 오래된 pending 요청 정리)
  useEffect(() => {
    if (!enabled) return;

    const cleanupInterval = setInterval(() => {
      operationTracker.cleanup();
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(cleanupInterval);
  }, [enabled]);

  // invalidateMessages는 현재 외부 노출하지 않지만 향후 확장을 위해 내부 보유
  void invalidateMessages;

  return { broadcastInsert, broadcastReadReceipt };
}
