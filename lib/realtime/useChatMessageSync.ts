"use client";

/**
 * 증분 메시지 동기화 훅
 *
 * - 마지막 동기화 시점(sessionStorage 영속) 기준으로 누락 메시지만 RPC 조회
 * - 100개씩 페이지네이션, 최대 500개, 재시도 3회(지수 백오프)
 * - 호출처: SUBSCRIBED / visibilitychange / reconnect
 */

import { useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatUserType, ChatMessageType, ChatMessageMetadata } from "@/lib/domains/chat/types";
import type { InfiniteMessagesCache, CacheMessage } from "@/lib/domains/chat/cacheTypes";
import { operationTracker } from "@/lib/domains/chat/operationTracker";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { connectionManager } from "./connectionManager";

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

export type UseChatMessageSyncOptions = {
  roomId: string;
};

export function useChatMessageSync({ roomId }: UseChatMessageSyncOptions) {
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "chat-messages" &&
          query.queryKey[1] === roomId,
      });
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
          queryClient.invalidateQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0] === "chat-messages" &&
              query.queryKey[1] === roomId,
          });
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
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "chat-messages" &&
          query.queryKey[1] === roomId,
      }); // 예상치 못한 에러 시 전체 무효화
    }
  }, [roomId, queryClient, getLatestMessageTimestamp, updateSyncTimestamp]);

  return {
    lastSyncTimestampRef,
    syncMessagesSince,
    updateSyncTimestamp,
  };
}
