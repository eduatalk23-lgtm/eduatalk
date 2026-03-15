"use client";

/**
 * 채팅 메시지 실시간 구독 훅
 *
 * 특정 채팅방의 새 메시지를 실시간으로 수신합니다.
 * Supabase Realtime broadcast (DB trigger) 사용.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  REACTION_EMOJIS,
  type ChatUserType,
  type ChatMessageType,
  type ChatMessageMetadata,
  type ChatUser,
  type ChatRoomListItem,
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
import { useDebouncedCallback } from "@/lib/hooks/useDebounce";

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

// Supabase Realtime Payload 타입 (DB 컬럼과 1:1 매핑)
export interface ChatMessagePayload {
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
  /** 비정규화된 발신자 이름 스냅샷 */
  sender_name: string;
  /** 비정규화된 발신자 프로필 URL 스냅샷 */
  sender_profile_url: string | null;
}

// 리액션 Payload 타입
interface ChatReactionPayload {
  id: string;
  message_id: string;
  user_id: string;
  user_type: ChatUserType;
  emoji: string;
  created_at: string;
}

// LRU 캐시 클래스 (메모리 누수 방지)
const SENDER_CACHE_MAX_SIZE = 500;

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 최근 접근으로 이동 (삭제 후 재삽입)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 가장 오래된 항목 제거 (Map의 첫 번째 항목)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

type UseChatRealtimeOptions = {
  /** 채팅방 ID */
  roomId: string;
  /** 현재 사용자 ID (본인 메시지 구분용) */
  userId: string;
  /** 구독 활성화 여부 */
  enabled?: boolean;
  /** 발신자 정보 캐시 (roomData.members에서 구성) */
  senderCache?: Map<string, ChatUser>;
  /** 새 메시지 수신 콜백 */
  onNewMessage?: (message: ChatMessagePayload) => void;
  /** 메시지 삭제 콜백 */
  onMessageDeleted?: (messageId: string) => void;
  /** 읽음 확인 수신 콜백 (상대방이 메시지를 읽었을 때) */
  onReadReceipt?: (readerId: string, readAt: string) => void;
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

  // 발신자 정보 캐시 (LRU로 메모리 누수 방지)
  const senderCacheRef = useRef(new LRUCache<string, ChatUser>(SENDER_CACHE_MAX_SIZE));

  // 배치 수집기 ref (100ms 윈도우로 sender 요청 배치 처리)
  const batchRef = useRef<{
    pending: Map<string, {
      senderId: string;
      senderType: ChatUserType;
      resolvers: Array<{ resolve: (v: ChatUser) => void; reject: (e: Error) => void }>;
    }>;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ pending: new Map(), timer: null });

  // 외부 senderCache가 변경되면 ref 업데이트
  useEffect(() => {
    if (senderCache) {
      senderCache.forEach((user, key) => {
        senderCacheRef.current.set(key, user);
      });
    }
  }, [senderCache]);

  // 기존 메시지에서 발신자 조회 함수
  const findSenderFromExistingMessages = useCallback(
    (senderId: string): ChatUser | null => {
      const cache = queryClient.getQueryData<InfiniteMessagesCache>([
        "chat-messages",
        roomId,
      ]);
      if (!cache?.pages) return null;

      for (const page of cache.pages) {
        for (const msg of page.messages) {
          if (
            msg.sender_id === senderId &&
            msg.sender?.name &&
            msg.sender.name !== "로딩 중..."
          ) {
            return msg.sender;
          }
        }
      }
      return null;
    },
    [queryClient, roomId]
  );

  // 배치 플러시: 100ms 윈도우 내 수집된 요청을 한 번에 처리
  const flushBatch = useCallback(async () => {
    const batch = new Map(batchRef.current.pending);
    batchRef.current.pending.clear();
    batchRef.current.timer = null;

    if (batch.size === 0) return;

    // Browser RPC — Server Action + getUser() 호출 제거
    const senderIds = [...new Set([...batch.values()].map(({ senderId }) => senderId))];
    const rpcClient = createSupabaseBrowserClient();

    try {
      const { data, error } = await rpcClient.rpc("get_sender_info_batch", {
        p_sender_ids: senderIds,
      });

      if (!error && data) {
        // RPC returns Record<userId, {id, name, profileImageUrl}>
        const senderMap = data as Record<string, { id: string; name: string; profileImageUrl?: string | null }>;
        for (const [cacheKey, entry] of batch) {
          const info = senderMap[entry.senderId];
          if (info) {
            const user: ChatUser = {
              id: info.id,
              type: entry.senderType,
              name: info.name,
              profileImageUrl: info.profileImageUrl,
            };
            senderCacheRef.current.set(cacheKey, user);
            entry.resolvers.forEach((r) => r.resolve(user));
          } else {
            const fallback: ChatUser = {
              id: entry.senderId,
              type: entry.senderType,
              name: "탈퇴한 사용자",
            };
            senderCacheRef.current.set(cacheKey, fallback);
            entry.resolvers.forEach((r) => r.resolve(fallback));
          }
        }
      } else {
        // RPC 실패 → 폴백
        for (const [cacheKey, { senderId, senderType, resolvers }] of batch) {
          const fallback: ChatUser = { id: senderId, type: senderType, name: "로딩 실패" };
          senderCacheRef.current.set(cacheKey, fallback);
          resolvers.forEach((r) => r.resolve(fallback));
        }
      }
    } catch {
      // 네트워크 에러 등 → 폴백 + 캐시 저장 (반복 요청 방지)
      for (const [cacheKey, { senderId, senderType, resolvers }] of batch) {
        const fallback: ChatUser = { id: senderId, type: senderType, name: "로딩 실패" };
        senderCacheRef.current.set(cacheKey, fallback);
        resolvers.forEach((r) => r.resolve(fallback));
      }
    }
  }, []);

  // 발신자 정보 조회 (캐시 우선, 100ms 배치 수집)
  const fetchSenderInfo = useCallback(
    (senderId: string, senderType: ChatUserType): Promise<ChatUser> => {
      const cacheKey = `${senderId}_${senderType}`;

      // 1. 캐시 확인
      const cached = senderCacheRef.current.get(cacheKey);
      if (cached) return Promise.resolve(cached);

      // 2. 이미 pending이면 같은 Promise에 리스너 추가
      return new Promise((resolve, reject) => {
        const existing = batchRef.current.pending.get(cacheKey);
        if (existing) {
          existing.resolvers.push({ resolve, reject });
          return;
        }

        // 3. 배치에 추가 + 100ms 타이머
        batchRef.current.pending.set(cacheKey, {
          senderId,
          senderType,
          resolvers: [{ resolve, reject }],
        });

        if (!batchRef.current.timer) {
          batchRef.current.timer = setTimeout(() => flushBatch(), 100);
        }
      });
    },
    [flushBatch]
  );

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

  // ============================================
  // 증분 동기화 (재연결 시 최적화)
  // ============================================

  // 마지막 동기화 시점 추적 (sessionStorage로 새로고침 시에도 유지)
  const syncStorageKey = `chat_sync_${roomId}`;
  const lastSyncTimestampRef = useRef<string | null>(null);
  if (lastSyncTimestampRef.current === null && typeof window !== "undefined") {
    try { lastSyncTimestampRef.current = sessionStorage.getItem(syncStorageKey); } catch { /* ignore */ }
  }
  const updateSyncTimestamp = useCallback((ts: string) => {
    lastSyncTimestampRef.current = ts;
    try { sessionStorage.setItem(syncStorageKey, ts); } catch { /* ignore */ }
  }, [syncStorageKey]);

  // 캐시에서 최신 메시지 타임스탬프 가져오기
  const getLatestMessageTimestamp = useCallback((): string | null => {
    const cache = queryClient.getQueryData<InfiniteMessagesCache>([
      "chat-messages",
      roomId,
    ]);

    if (!cache?.pages?.length) return null;

    // 첫 번째 페이지(가장 최신)의 마지막 메시지
    const firstPage = cache.pages[0];
    const messages = firstPage?.messages;
    if (!messages?.length) return null;

    // 가장 최신 메시지의 타임스탬프
    const latestMessage = messages[messages.length - 1];
    return latestMessage?.created_at ?? null;
  }, [queryClient, roomId]);

  // 증분 동기화: 마지막 동기화 이후 메시지만 가져와 캐시에 병합
  // - 페이지네이션 지원 (100개씩 배치로 가져옴)
  // - 재시도 로직 포함 (네트워크 오류 시)
  // - 최대 500개 메시지 제한 (무한 루프 방지)
  const syncMessagesSince = useCallback(async () => {
    const BATCH_SIZE = 100;
    const MAX_TOTAL_MESSAGES = 500;
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 500;

    const initialTimestamp = lastSyncTimestampRef.current || getLatestMessageTimestamp();

    if (!initialTimestamp) {
      // 타임스탬프 없으면 전체 무효화 (첫 로드 또는 캐시 없음)
      debugLog("[ChatRealtime] No timestamp for incremental sync, full invalidate");
      invalidateMessages();
      return;
    }

    // 네트워크 오류 여부 판별
    const isNetworkError = (error: unknown): boolean => {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (
          msg.includes("network") ||
          msg.includes("fetch") ||
          msg.includes("timeout") ||
          msg.includes("offline") ||
          msg.includes("failed to fetch") ||
          error.name === "TypeError"
        );
      }
      return false;
    };

    // Browser RPC 기반 단일 배치 요청 (재시도 포함)
    type SyncMessage = CacheMessage;
    const rpcClient = createSupabaseBrowserClient();
    const fetchBatchWithRetry = async (
      sinceTimestamp: string
    ): Promise<{ success: boolean; data?: SyncMessage[]; error?: string }> => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { data, error } = await rpcClient.rpc("get_chat_messages_since", {
            p_room_id: roomId,
            p_since: sinceTimestamp,
            p_limit: BATCH_SIZE,
          });

          if (error) {
            // 권한 오류 등 재시도해도 의미 없는 경우
            if (error.message?.includes("Not a member") || error.message?.includes("Not authenticated")) {
              return { success: false, error: error.message };
            }
            lastError = new Error(error.message);
          } else {
            // RPC returns RETURNS TABLE — Supabase types rows correctly
            type RpcRow = {
              id: string; room_id: string; sender_id: string; sender_type: ChatUserType;
              message_type: ChatMessageType; content: string; reply_to_id: string | null;
              is_deleted: boolean; deleted_at: string | null; created_at: string;
              updated_at: string; sender_name: string; sender_profile_url: string | null;
              metadata: ChatMessageMetadata | null;
            };
            const messages: SyncMessage[] = ((data ?? []) as RpcRow[]).map((m) => ({
              ...m,
              sender: { id: m.sender_id, type: m.sender_type, name: m.sender_name, profileImageUrl: m.sender_profile_url },
              reactions: [],
              replyTarget: null,
            }));
            return { success: true, data: messages };
          }
        } catch (error) {
          lastError = error;

          // 네트워크 오류가 아니면 재시도 불필요
          if (!isNetworkError(error)) {
            console.error("[ChatRealtime] Non-network sync error:", error);
            return { success: false, error: String(error) };
          }
        }

        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          debugLog(`[ChatRealtime] Retrying sync (${attempt + 1}/${MAX_RETRIES}) in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return { success: false, error: String(lastError) };
    };

    try {
      debugLog("[ChatRealtime] Incremental sync since:", initialTimestamp);

      // 모든 새 메시지 수집 (페이지네이션)
      const allNewMessages: SyncMessage[] = [];
      let cursor = initialTimestamp;
      let hasMore = true;

      while (hasMore && allNewMessages.length < MAX_TOTAL_MESSAGES) {
        const result = await fetchBatchWithRetry(cursor);

        if (!result.success) {
          console.error("[ChatRealtime] Sync failed after retries:", result.error);
          // 부분적으로 가져온 메시지라도 있으면 병합
          if (allNewMessages.length > 0) {
            debugLog(`[ChatRealtime] Merging ${allNewMessages.length} partial messages`);
            break;
          }
          // 아무것도 못 가져왔으면 전체 무효화
          invalidateMessages();
          return;
        }

        const newMessages = result.data ?? [];

        if (newMessages.length === 0) {
          hasMore = false;
        } else {
          allNewMessages.push(...newMessages);

          // 다음 페이지 커서 설정
          const lastMessage = newMessages[newMessages.length - 1];
          cursor = lastMessage?.created_at ?? cursor;

          // 배치 크기보다 적게 왔으면 마지막 페이지
          if (newMessages.length < BATCH_SIZE) {
            hasMore = false;
          }
        }
      }

      if (allNewMessages.length === 0) {
        debugLog("[ChatRealtime] No new messages since last sync");
        updateSyncTimestamp(new Date().toISOString());
        // readCounts는 실시간 READ_RECEIPT으로 갱신되므로 별도 refetch 불필요
        // (readReceiptTrackRef가 멤버의 last_read_at으로 초기화되어 정확한 감소 보장)
        return;
      }

      // 최대 제한 도달 시 경고
      if (allNewMessages.length >= MAX_TOTAL_MESSAGES) {
        debugWarn(`[ChatRealtime] Reached max sync limit (${MAX_TOTAL_MESSAGES}), some messages may be missing`);
      }

      debugLog(`[ChatRealtime] Synced ${allNewMessages.length} new messages`);

      // 캐시에 새 메시지 병합
      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
        (old) => {
          if (!old?.pages?.length) return old;

          const firstPage = old.pages[0];

          // 중복 방지: 모든 페이지의 기존 ID + 전송 중인 메시지(operationTracker) 체크
          const existingIds = new Set<string>();
          for (const page of old.pages) {
            for (const m of page.messages) {
              existingIds.add(m.id);
            }
          }

          const uniqueNewMessages = allNewMessages.filter((m) => {
            // ① 캐시에 이미 있는 메시지 스킵
            if (existingIds.has(m.id)) return false;
            // ② 현재 전송 중인 메시지(오프라인 큐 처리 중)와 중복 스킵
            if (operationTracker.isMessageBeingSent(m.id)) return false;
            return true;
          });

          if (uniqueNewMessages.length === 0) return old;

          debugLog(`[ChatRealtime] Adding ${uniqueNewMessages.length} unique messages to cache`);

          // 새 메시지를 첫 번째 페이지에 병합 후 시간순 정렬
          const merged = [...firstPage.messages, ...uniqueNewMessages];
          sortMessagesByTime(merged);

          return {
            ...old,
            pages: [
              {
                ...firstPage,
                messages: merged,
              },
              ...old.pages.slice(1),
            ],
          };
        }
      );

      // 마지막 동기화 시점 갱신
      const latestNew = allNewMessages[allNewMessages.length - 1];
      const newSyncTs = latestNew?.created_at ?? new Date().toISOString();
      updateSyncTimestamp(newSyncTs);

      // ConnectionManager에도 동기화 시점 업데이트
      const channelName = connectionManager.getChannelKey(roomId);
      connectionManager.updateSyncTimestamp(channelName, newSyncTs);

      // readCounts는 실시간 READ_RECEIPT + readReceiptTrackRef로 관리됨
      // roomData 갱신 시 trackRef가 동기화되므로 별도 full refetch 불필요
      // (refetchOnMount: "always"가 방 재진입 시 정확한 값 보장)
    } catch (error) {
      console.error("[ChatRealtime] Unexpected sync error:", error);
      invalidateMessages(); // 예상치 못한 에러 시 전체 무효화
    }
  }, [roomId, queryClient, getLatestMessageTimestamp, invalidateMessages]);

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

    // === 메시지 INSERT 배치 버퍼 (50ms 윈도우로 setQueryData 호출 최소화) ===
    const INSERT_BATCH_WINDOW_MS = 50;
    const insertBuffer: Array<{ msg: ChatMessagePayload; tempId: string | undefined }> = [];
    let insertBufferTimer: ReturnType<typeof setTimeout> | null = null;

    // === 리액션 배치 버퍼 (50ms 윈도우로 여러 리액션을 1회 setQueryData로 적용) ===
    const REACTION_BATCH_WINDOW_MS = 50;
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
          if (member && member.left_at !== null) {
            debugLog("[ChatRealtime] Member left room:", member.user_id);
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
      // sender 배치 타이머 정리
      if (currentBatch.timer) {
        clearTimeout(currentBatch.timer);
        currentBatch.timer = null;
      }
      supabase.removeChannel(channel);
      // 재연결 콜백 해제
      connectionManager.unregisterReconnectCallback(channelName);
      // 방 나갈 때 해당 방 관련 pending 작업 정리
      operationTracker.clearForRoom(roomId);
    };
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

// ============================================
// 채팅방 목록 실시간 구독
// ============================================

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

    // broadcast_changes payload 노멀라이저 (DB trigger → record 래핑)
    type BroadcastPayload = Record<string, unknown>;
    const extractRecord = <T>(raw: BroadcastPayload): T | undefined =>
      raw.record as T | undefined;

    const channel = supabase
      .channel(`chat-rooms-${userId}`)
      // 멤버 추가 (broadcast from DB trigger)
      .on(
        "broadcast",
        { event: "INSERT" },
        (event: { payload: BroadcastPayload }) => {
          debugLog("[ChatRealtime] Added to room:", event.payload);
          invalidateRoomList();
        }
      )
      // 멤버십 변경 (나가기 등) - markAsRead의 last_read_at 업데이트는 무시
      .on(
        "broadcast",
        { event: "UPDATE" },
        (event: { payload: BroadcastPayload }) => {
          const record = extractRecord<{ left_at?: string | null }>(event.payload);
          // left_at 변경(나가기)만 처리, last_read_at 변경(읽음 처리)은 무시
          // → markAsReadMutation의 onMutate가 이미 낙관적 업데이트 처리함
          if (record?.left_at !== undefined && record.left_at !== null) {
            debugLog("[ChatRealtime] Member left room, refreshing list");
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
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userType, enabled, invalidateRoomList, debouncedInvalidate]);
}
