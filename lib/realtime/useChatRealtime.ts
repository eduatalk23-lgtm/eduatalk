"use client";

/**
 * 채팅 메시지 실시간 구독 훅
 *
 * 특정 채팅방의 새 메시지를 실시간으로 수신합니다.
 * Supabase Realtime postgres_changes 사용.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";
import type {
  ChatUserType,
  ChatMessageType,
  ChatUser,
  ChatRoomListItem,
} from "@/lib/domains/chat/types";
import {
  type InfiniteMessagesCache,
  type CacheMessage,
} from "@/lib/domains/chat/cacheTypes";
import { getSenderInfoBatchAction, getMessagesSinceAction } from "@/lib/domains/chat/actions";
import { operationTracker } from "@/lib/domains/chat/operationTracker";
import { connectionManager } from "./connectionManager";
import { useDebouncedCallback } from "@/lib/hooks/useDebounce";

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
const SENDER_CACHE_MAX_SIZE = 100;

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
}: UseChatRealtimeOptions) {
  const queryClient = useQueryClient();

  // 재연결 트리거 (수동 재연결 시 증가하여 useEffect 재실행)
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // Broadcast-first: 채널 참조 (broadcastInsert에서 사용)
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 콜백을 ref로 저장하여 의존성 변경 방지
  const callbacksRef = useRef({ onNewMessage, onMessageDeleted });
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onMessageDeleted };
  }, [onNewMessage, onMessageDeleted]);

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

    const keys = [...batch.values()].map(({ senderId, senderType }) => ({
      id: senderId,
      type: senderType,
    }));

    try {
      const result = await getSenderInfoBatchAction(keys);
      if (result.success && result.data) {
        // Server Action은 Record<string, ChatUser>를 반환 (Map 직렬화 불가)
        const data = result.data;
        for (const [cacheKey, entry] of batch) {
          const user = data[cacheKey];
          if (user) {
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
        // 배치 실패 → 폴백
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

  // ============================================
  // 증분 동기화 (재연결 시 최적화)
  // ============================================

  // 마지막 동기화 시점 추적
  const lastSyncTimestampRef = useRef<string | null>(null);

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
    const BASE_DELAY_MS = 1000;

    const initialTimestamp = lastSyncTimestampRef.current || getLatestMessageTimestamp();

    if (!initialTimestamp) {
      // 타임스탬프 없으면 전체 무효화 (첫 로드 또는 캐시 없음)
      console.log("[ChatRealtime] No timestamp for incremental sync, full invalidate");
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

    // 단일 배치 요청 (재시도 포함)
    type SyncResult = Awaited<ReturnType<typeof getMessagesSinceAction>>;
    const fetchBatchWithRetry = async (
      sinceTimestamp: string
    ): Promise<{ success: boolean; data?: SyncResult["data"]; error?: string }> => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await getMessagesSinceAction(roomId, sinceTimestamp, BATCH_SIZE);

          if (result.success) {
            return result;
          }

          // 권한 오류 등 재시도해도 의미 없는 경우
          if (result.error?.includes("permission") || result.error?.includes("denied")) {
            return result;
          }

          lastError = new Error(result.error || "Unknown error");
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
          console.log(`[ChatRealtime] Retrying sync (${attempt + 1}/${MAX_RETRIES}) in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return { success: false, error: String(lastError) };
    };

    try {
      console.log("[ChatRealtime] Incremental sync since:", initialTimestamp);

      // 모든 새 메시지 수집 (페이지네이션)
      type MessageType = NonNullable<Awaited<ReturnType<typeof getMessagesSinceAction>>["data"]>[number];
      const allNewMessages: MessageType[] = [];
      let cursor = initialTimestamp;
      let hasMore = true;

      while (hasMore && allNewMessages.length < MAX_TOTAL_MESSAGES) {
        const result = await fetchBatchWithRetry(cursor);

        if (!result.success) {
          console.error("[ChatRealtime] Sync failed after retries:", result.error);
          // 부분적으로 가져온 메시지라도 있으면 병합
          if (allNewMessages.length > 0) {
            console.log(`[ChatRealtime] Merging ${allNewMessages.length} partial messages`);
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
        console.log("[ChatRealtime] No new messages since last sync");
        lastSyncTimestampRef.current = new Date().toISOString();
        return;
      }

      // 최대 제한 도달 시 경고
      if (allNewMessages.length >= MAX_TOTAL_MESSAGES) {
        console.warn(`[ChatRealtime] Reached max sync limit (${MAX_TOTAL_MESSAGES}), some messages may be missing`);
      }

      console.log(`[ChatRealtime] Synced ${allNewMessages.length} new messages`);

      // 캐시에 새 메시지 병합
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) => {
          if (!old?.pages?.length) return old;

          const firstPage = old.pages[0];

          // 모든 페이지의 메시지 ID 수집 (중복 방지)
          const existingIds = new Set<string>();
          for (const page of old.pages) {
            for (const msg of page.messages) {
              existingIds.add(msg.id);
            }
          }

          // 중복 제거 후 새 메시지만 추가
          const uniqueNewMessages = allNewMessages.filter(
            (m) => !existingIds.has(m.id)
          );

          if (uniqueNewMessages.length === 0) return old;

          console.log(`[ChatRealtime] Adding ${uniqueNewMessages.length} unique messages to cache`);

          // 새 메시지를 첫 번째 페이지 끝에 추가 (시간순)
          return {
            ...old,
            pages: [
              {
                ...firstPage,
                messages: [...firstPage.messages, ...uniqueNewMessages],
              },
              ...old.pages.slice(1),
            ],
          };
        }
      );

      // 마지막 동기화 시점 갱신
      const latestNew = allNewMessages[allNewMessages.length - 1];
      lastSyncTimestampRef.current = latestNew?.created_at ?? new Date().toISOString();

      // ConnectionManager에도 동기화 시점 업데이트
      const channelName = connectionManager.getChannelKey(roomId);
      connectionManager.updateSyncTimestamp(channelName, lastSyncTimestampRef.current);
    } catch (error) {
      console.error("[ChatRealtime] Unexpected sync error:", error);
      invalidateMessages(); // 예상치 못한 에러 시 전체 무효화
    }
  }, [roomId, queryClient, getLatestMessageTimestamp, invalidateMessages]);

  // 초기 마운트 추적 (자동 재연결과 구분하기 위해 별도 ref 사용)
  const isInitialMountRef = useRef(true);

  // 메인 useEffect에서 사용하는 함수들을 ref로 추적
  // → 함수 참조 변경 시 채널 재구독을 방지
  const fnRef = useRef({
    syncMessagesSince,
    invalidateRoomList,
    invalidatePinnedMessages,
    invalidateAnnouncement,
    fetchSenderInfo,
    findSenderFromExistingMessages,
  });
  useEffect(() => {
    fnRef.current = {
      syncMessagesSince,
      invalidateRoomList,
      invalidatePinnedMessages,
      invalidateAnnouncement,
      fetchSenderInfo,
      findSenderFromExistingMessages,
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
      console.log("[ChatRealtime] Reconnect callback triggered");
      // 트리거 증가로 useEffect 재실행 → 채널 재구독
      setReconnectTrigger((prev) => prev + 1);
    });

    // 공지 변경 감지용 (announcement_at 추적)
    const lastAnnouncementAtRef = { current: null as string | null };

    // 지연 invalidation 타이머 (cleanup용)
    let delayedInvalidationTimer: ReturnType<typeof setTimeout> | null = null;

    // === 핸들러 함수 추출 (broadcast + postgres_changes 양쪽에서 재사용) ===
    const handleMessageInsert = (newMessage: ChatMessagePayload) => {
      // 이벤트 ID 생성 (중복 처리 방지)
      const eventId = `insert:${newMessage.id}`;

      // 1. 이미 처리된 Realtime 이벤트 스킵
      if (operationTracker.isRealtimeProcessed(eventId)) {
        console.log("[ChatRealtime] Skipping already processed event:", eventId);
        return;
      }

      // 2. 낙관적 업데이트로 이미 처리 중인 메시지 스킵 (completeSend 완료 전)
      if (operationTracker.isMessageBeingSent(newMessage.id)) {
        console.log("[ChatRealtime] Skipping message being sent:", newMessage.id);
        operationTracker.markRealtimeProcessed(eventId);
        return;
      }

      // 3. 발신자 자신의 메시지: 아직 전송 중인 낙관적 메시지가 있으면 스킵
      //    (onSuccess가 tempId→realId 교체를 처리, broadcast보다 깔끔)
      if (newMessage.sender_id === userId) {
        const cache = queryClient.getQueryData<InfiniteMessagesCache>(["chat-messages", roomId]);
        const hasPendingTemp = cache?.pages?.[0]?.messages.some(
          (m) =>
            m.id.startsWith("temp-") &&
            m.content === newMessage.content &&
            m.sender_id === newMessage.sender_id &&
            m.status !== "error"
        );
        if (hasPendingTemp) {
          console.log("[ChatRealtime] Skipping broadcast for own pending message:", newMessage.id);
          operationTracker.markRealtimeProcessed(eventId);
          return;
        }
      }

      // 4. tempId → realId 매핑으로 교체가 필요한지 확인
      const tempId = operationTracker.getTempIdForRealId(newMessage.id);

      // setQueryData로 캐시에 직접 추가 (서버 재요청 없음) - InfiniteQuery 구조
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
        (old) => {
          if (!old?.pages?.length) return old;

          // 첫 번째 페이지(최신 메시지들)에서 중복 체크 및 추가
          const firstPage = old.pages[0];

          // tempId 매핑이 있으면 해당 temp 메시지를 찾음
          const existingIndex = firstPage.messages.findIndex(
            (m) =>
              m.id === newMessage.id ||
              (tempId && m.id === tempId) ||
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

          // 타인의 새 메시지 추가 (기존 캐시에서 sender 정보 조회 우선)
          const cacheKey = `${newMessage.sender_id}_${newMessage.sender_type}`;
          const existingSender = fnRef.current.findSenderFromExistingMessages(
            newMessage.sender_id
          );
          const senderFromCache = senderCacheRef.current.get(cacheKey);

          // 비정규화 필드에서 sender 정보 구성 (DB trigger payload에 포함)
          const tempSender: ChatUser =
            existingSender ??
            senderFromCache ?? {
              id: newMessage.sender_id,
              type: newMessage.sender_type,
              name: newMessage.sender_name ?? "로딩 중...",
            };

          const newCacheMessage: CacheMessage = {
            ...newMessage,
            sender: tempSender,
            reactions: [],
            replyTarget: null,
            sender_name: newMessage.sender_name ?? tempSender.name,
            sender_profile_url: newMessage.sender_profile_url ?? tempSender.profileImageUrl ?? null,
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

      // 타인 메시지인 경우 sender 정보가 없을 때만 비동기로 보강
      if (newMessage?.sender_id && newMessage.sender_id !== userId) {
        const cacheKey = `${newMessage.sender_id}_${newMessage.sender_type}`;
        const hasSenderInfo =
          fnRef.current.findSenderFromExistingMessages(newMessage.sender_id) ??
          senderCacheRef.current.get(cacheKey);

        // sender 정보가 없을 때만 서버에서 조회
        if (!hasSenderInfo) {
          fnRef.current.fetchSenderInfo(newMessage.sender_id, newMessage.sender_type)
            .then((senderInfo) => {
              queryClient.setQueryData<InfiniteMessagesCache>(
                ["chat-messages", roomId],
                (old) => {
                  if (!old?.pages?.length) return old;
                  return {
                    ...old,
                    pages: old.pages.map((page) => ({
                      ...page,
                      messages: page.messages.map((m) =>
                        m.id === newMessage.id
                          ? { ...m, sender: senderInfo }
                          : m
                      ),
                    })),
                  };
                }
              );
            })
            .catch((error) => {
              console.warn(
                "[ChatRealtime] Failed to fetch sender info:",
                error
              );
            });
        }
      }

      // 채팅방 목록도 무효화 (마지막 메시지 업데이트)
      fnRef.current.invalidateRoomList();

      // 콜백 호출 (타인의 메시지만)
      if (newMessage.sender_id !== userId) {
        callbacksRef.current.onNewMessage?.(newMessage);
      }

      // 이벤트 처리 완료 표시 (중복 방지)
      operationTracker.markRealtimeProcessed(eventId);
    };

    const handleMessageUpdate = (updatedMessage: ChatMessagePayload) => {
      // UPDATE dedup: broadcast와 postgres_changes 양쪽에서 수신되므로 중복 방지
      const eventId = `update:${updatedMessage.id}:${updatedMessage.updated_at}`;
      if (operationTracker.isRealtimeProcessed(eventId)) {
        console.log("[ChatRealtime] Skipping already processed update:", eventId);
        return;
      }

      // setQueryData로 해당 메시지만 업데이트 (서버 재요청 없음) - InfiniteQuery 구조
      queryClient.setQueryData<InfiniteMessagesCache>(
        ["chat-messages", roomId],
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

    const channel = supabase
      .channel(`chat-room-${roomId}`, { config: { private: true } })
      // === Broadcast 리스너 (DB trigger → realtime.send(), 빠름 ~150ms) ===
      .on(
        "broadcast",
        { event: "INSERT" },
        (event: { payload: ChatMessagePayload }) => {
          const msg = event.payload;
          if (msg?.id) {
            const latency = Date.now() - new Date(msg.created_at).getTime();
            console.log(`[ChatRealtime] Broadcast INSERT: ${msg.id} (latency: ${latency}ms)`);
            handleMessageInsert(msg);
          }
        }
      )
      .on(
        "broadcast",
        { event: "UPDATE" },
        (event: { payload: ChatMessagePayload }) => {
          const msg = event.payload;
          if (msg?.id) {
            const latency = Date.now() - new Date(msg.updated_at).getTime();
            console.log(`[ChatRealtime] Broadcast UPDATE: ${msg.id} (latency: ${latency}ms)`);
            handleMessageUpdate(msg);
          }
        }
      )
      // === postgres_changes 리스너 (백업, dedup으로 스킵) ===
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
          const newMessage = payload.new as ChatMessagePayload | undefined;
          if (newMessage) {
            const latency = Date.now() - new Date(newMessage.created_at).getTime();
            console.log(`[ChatRealtime] postgres_changes INSERT: ${newMessage.id} (latency: ${latency}ms)`);
            handleMessageInsert(newMessage);
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
          const updatedMessage = payload.new as ChatMessagePayload | undefined;
          if (updatedMessage) {
            const latency = Date.now() - new Date(updatedMessage.created_at).getTime();
            console.log(`[ChatRealtime] postgres_changes UPDATE: ${updatedMessage.id} (latency: ${latency}ms)`);
            handleMessageUpdate(updatedMessage);
          }
        }
      )
      // 리액션 INSERT (타겟 캐시 업데이트, 낙관적 업데이트 중복 방지)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message_reactions",
        },
        (payload: RealtimePostgresChangesPayload<ChatReactionPayload>) => {
          const reaction = payload.new as ChatReactionPayload | undefined;
          console.log("[ChatRealtime] Reaction added:", reaction?.message_id);

          if (reaction?.message_id) {
            // Operation Tracker로 pending 상태 체크 (낙관적 업데이트 중복 방지)
            const pendingState = operationTracker.isReactionPending(
              reaction.message_id,
              reaction.emoji
            );

            // 현재 사용자의 리액션 추가가 pending 상태이면 스킵
            if (reaction.user_id === userId && pendingState.isPending && pendingState.isAdd) {
              console.log("[ChatRealtime] Skipping pending reaction add:", reaction.message_id, reaction.emoji);
              return;
            }

            // 해당 메시지에만 리액션 추가 (전체 무효화 대신)
            queryClient.setQueryData<InfiniteMessagesCache>(
              ["chat-messages", roomId],
              (old) => {
                if (!old?.pages?.length) return old;
                return {
                  ...old,
                  pages: old.pages.map((page) => ({
                    ...page,
                    messages: page.messages.map((m) => {
                      if (m.id !== reaction.message_id) return m;

                      // 기존 리액션에서 같은 이모지 찾기
                      const existingReactions = m.reactions ?? [];
                      const existingIdx = existingReactions.findIndex(
                        (r) => r.emoji === reaction.emoji
                      );

                      if (existingIdx >= 0) {
                        // 현재 사용자의 리액션이고 이미 낙관적 업데이트로 처리됨
                        if (
                          reaction.user_id === userId &&
                          existingReactions[existingIdx].hasReacted
                        ) {
                          return m; // 스킵
                        }

                        // 기존 이모지 카운트 증가
                        const updated = [...existingReactions];
                        updated[existingIdx] = {
                          ...updated[existingIdx],
                          count: updated[existingIdx].count + 1,
                          hasReacted:
                            updated[existingIdx].hasReacted ||
                            reaction.user_id === userId,
                        };
                        return { ...m, reactions: updated };
                      } else {
                        // 새 이모지 추가
                        return {
                          ...m,
                          reactions: [
                            ...existingReactions,
                            {
                              emoji: reaction.emoji as "👍" | "❤️" | "😂" | "🔥" | "😮",
                              count: 1,
                              hasReacted: reaction.user_id === userId,
                            },
                          ],
                        };
                      }
                    }),
                  })),
                };
              }
            );
          }
        }
      )
      // 리액션 DELETE (타겟 캐시 업데이트, 낙관적 업데이트 중복 방지)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_message_reactions",
        },
        (payload: RealtimePostgresChangesPayload<ChatReactionPayload>) => {
          const reaction = payload.old as ChatReactionPayload | undefined;
          console.log("[ChatRealtime] Reaction removed:", reaction?.message_id);

          if (reaction?.message_id) {
            // Operation Tracker로 pending 상태 체크 (낙관적 업데이트 중복 방지)
            const pendingState = operationTracker.isReactionPending(
              reaction.message_id,
              reaction.emoji
            );

            // 현재 사용자의 리액션 제거가 pending 상태이면 스킵
            if (reaction.user_id === userId && pendingState.isPending && !pendingState.isAdd) {
              console.log("[ChatRealtime] Skipping pending reaction remove:", reaction.message_id, reaction.emoji);
              return;
            }

            // 해당 메시지에서만 리액션 제거 (전체 무효화 대신)
            queryClient.setQueryData<InfiniteMessagesCache>(
              ["chat-messages", roomId],
              (old) => {
                if (!old?.pages?.length) return old;
                return {
                  ...old,
                  pages: old.pages.map((page) => ({
                    ...page,
                    messages: page.messages.map((m) => {
                      if (m.id !== reaction.message_id) return m;

                      const existingReactions = m.reactions ?? [];
                      const existingIdx = existingReactions.findIndex(
                        (r) => r.emoji === reaction.emoji
                      );

                      if (existingIdx >= 0) {
                        // 현재 사용자의 리액션 취소이고 이미 낙관적 업데이트로 처리됨
                        if (
                          reaction.user_id === userId &&
                          !existingReactions[existingIdx].hasReacted
                        ) {
                          return m; // 스킵
                        }

                        const updated = [...existingReactions];
                        const newCount = updated[existingIdx].count - 1;

                        if (newCount <= 0) {
                          // 카운트가 0이면 제거
                          updated.splice(existingIdx, 1);
                        } else {
                          // 카운트 감소
                          updated[existingIdx] = {
                            ...updated[existingIdx],
                            count: newCount,
                            hasReacted:
                              reaction.user_id === userId
                                ? false
                                : updated[existingIdx].hasReacted,
                          };
                        }
                        return { ...m, reactions: updated };
                      }
                      return m;
                    }),
                  })),
                };
              }
            );
          }
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
          fnRef.current.invalidatePinnedMessages();
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
          fnRef.current.invalidatePinnedMessages();
        }
      )
      // 채팅방 UPDATE (공지 변경 시에만 invalidate)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const newRoom = payload.new as { announcement_at?: string | null } | undefined;
          const announcementAt = newRoom?.announcement_at ?? null;

          // announcement_at이 변경된 경우에만 공지 무효화
          // (매 메시지마다 updated_at만 변경되는 경우 스킵)
          if (announcementAt !== lastAnnouncementAtRef.current) {
            lastAnnouncementAtRef.current = announcementAt;
            console.log("[ChatRealtime] Announcement changed");
            fnRef.current.invalidateAnnouncement();
          }
        }
      )
      // 채팅방 멤버 UPDATE (멤버 나가기 등)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_room_members",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const member = payload.new as { left_at: string | null; user_id: string } | undefined;
          if (member?.left_at !== null) {
            console.log("[ChatRealtime] Member left room:", member?.user_id);
            // 멤버 목록 캐시 무효화 (남은 멤버들의 UI 갱신)
            queryClient.invalidateQueries({ queryKey: ["chat-room", roomId] });
          }
        }
      )
      .subscribe((status) => {
        console.log(`[ChatRealtime] Room ${roomId} subscription:`, status);

        if (status === "SUBSCRIBED") {
          // ConnectionManager에 연결 상태 알림
          connectionManager.setChannelState(channelName, "connected");

          if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            // 첫 마운트: SSR prefetch 데이터가 있으면 메시지 sync 불필요
            const hasCache = queryClient.getQueryData(["chat-messages", roomId]);
            if (hasCache) {
              console.log("[ChatRealtime] Initial mount with SSR cache, skipping sync");
            } else {
              console.log("[ChatRealtime] Initial mount without cache, syncing...");
              fnRef.current.syncMessagesSince();
            }
            // roomList은 스킵 (방금 목록에서 왔으므로 최신)
          } else {
            // 재연결 또는 자동 복구: 누락 메시지 복구 필요
            console.log("[ChatRealtime] Reconnected. Syncing missed messages...");
            fnRef.current.syncMessagesSince();
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

    return () => {
      console.log(`[ChatRealtime] Unsubscribing from room ${roomId}`);
      // Broadcast-first: 채널 참조 초기화
      channelRef.current = null;
      // 지연 invalidation 타이머 정리
      if (delayedInvalidationTimer) {
        clearTimeout(delayedInvalidationTimer);
        delayedInvalidationTimer = null;
      }
      // 배치 타이머 정리
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
    (message: ChatMessagePayload) => {
      if (!channelRef.current) {
        console.warn("[ChatRealtime] No channel for broadcast");
        return;
      }
      channelRef.current.send({
        type: "broadcast",
        event: "INSERT",
        payload: message,
      });
    },
    []
  );

  return { broadcastInsert };
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
        Array.isArray(query.queryKey) && query.queryKey[0] === "chat-rooms",
    });
  }, [queryClient]);

  // Debounce로 짧은 시간 내 중복 무효화 방지 (300ms)
  const debouncedInvalidate = useDebouncedCallback(invalidateRoomList, 300);

  // 캐시에서 room ID 목록 동기화
  useEffect(() => {
    const updateRoomIds = () => {
      const cache = queryClient.getQueryData<ChatRoomListItem[]>(["chat-rooms"]);
      if (cache) {
        userRoomIdsRef.current = new Set(cache.map((room) => room.id));
      }
    };

    updateRoomIds();

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        Array.isArray(event.query.queryKey) &&
        event.query.queryKey[0] === "chat-rooms"
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
      // 멤버십 변경 (나가기 등) - markAsRead의 last_read_at 업데이트는 무시
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_room_members",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRecord = payload.new as { left_at?: string | null } | undefined;
          // left_at 변경(나가기)만 처리, last_read_at 변경(읽음 처리)은 무시
          // → markAsReadMutation의 onMutate가 이미 낙관적 업데이트 처리함
          if (newRecord?.left_at !== undefined && newRecord.left_at !== null) {
            console.log("[ChatRealtime] Member left room, refreshing list");
            invalidateRoomList();
          }
        }
      )
      // 채팅방 업데이트 (새 메시지 시 트리거로 updated_at 갱신됨)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_rooms",
        },
        (payload) => {
          const roomId = (payload.new as { id: string } | undefined)?.id;
          // 사용자가 속한 채팅방인 경우에만 목록 갱신
          if (roomId && userRoomIdsRef.current.has(roomId)) {
            console.log("[ChatRealtime] Room updated (new message):", roomId);
            debouncedInvalidate();
          }
        }
      )
      .subscribe((status) => {
        console.log(`[ChatRealtime] Room list subscription:`, status);

        if (status === "SUBSCRIBED") {
          console.log("[ChatRealtime] Room list connected/reconnected. Syncing...");
          invalidateRoomList();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[ChatRealtime] Room list connection error: ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userType, enabled, invalidateRoomList, debouncedInvalidate]);
}
