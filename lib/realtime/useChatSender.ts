"use client";

/**
 * 발신자 정보 조회 훅
 *
 * - LRU 캐시 (최대 500명) + 100ms 배치 RPC
 * - 기존 메시지 캐시에서 발신자를 먼저 조회 (fetch 절약)
 * - 방 전환 시 batchRef cleanup 책임은 useChatRealtime이 직접 수행
 *   (batchRef를 외부로 노출하여 cleanup 후 reject 처리)
 */

import { useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatUser, ChatUserType } from "@/lib/domains/chat/types";
import type { InfiniteMessagesCache } from "@/lib/domains/chat/cacheTypes";

// ============================================
// LRU Cache (메모리 누수 방지)
// ============================================

const SENDER_CACHE_MAX_SIZE = 500;

export class LRUCache<K, V> {
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

// ============================================
// 배치 수집기 타입
// ============================================

export type SenderBatchEntry = {
  senderId: string;
  senderType: ChatUserType;
  resolvers: Array<{ resolve: (v: ChatUser) => void; reject: (e: Error) => void }>;
};

export type SenderBatchRef = {
  pending: Map<string, SenderBatchEntry>;
  timer: ReturnType<typeof setTimeout> | null;
};

// ============================================
// 훅 옵션
// ============================================

export type UseChatSenderOptions = {
  roomId: string;
  /** 외부 senderCache (roomData.members에서 구성) — 변경 시 자동 동기화 */
  senderCache?: Map<string, ChatUser>;
};

// ============================================
// useChatSender 훅
// ============================================

export function useChatSender({ roomId, senderCache }: UseChatSenderOptions) {
  const queryClient = useQueryClient();

  // 발신자 정보 LRU 캐시
  const senderCacheRef = useRef(new LRUCache<string, ChatUser>(SENDER_CACHE_MAX_SIZE));

  // 배치 수집기 ref (100ms 윈도우로 RPC 요청 배치 처리)
  const batchRef = useRef<SenderBatchRef>({ pending: new Map(), timer: null });

  // 외부 senderCache가 변경되면 내부 캐시에 동기화
  useEffect(() => {
    if (senderCache) {
      senderCache.forEach((user, key) => {
        senderCacheRef.current.set(key, user);
      });
    }
  }, [senderCache]);

  // 기존 메시지에서 발신자 조회 (fetch 없이 캐시 히트)
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

    const senderIds = [...new Set([...batch.values()].map(({ senderId }) => senderId))];
    const rpcClient = createSupabaseBrowserClient();

    try {
      const { data, error } = await rpcClient.rpc("get_sender_info_batch", {
        p_sender_ids: senderIds,
      });

      if (!error && data) {
        const senderMap = data as Record<
          string,
          { id: string; name: string; profileImageUrl?: string | null }
        >;
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

  return {
    senderCacheRef,
    batchRef,
    fetchSenderInfo,
    findSenderFromExistingMessages,
  };
}
