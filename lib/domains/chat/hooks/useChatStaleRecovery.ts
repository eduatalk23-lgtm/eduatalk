"use client";

/**
 * useChatStaleRecovery - stale "sending" 메시지 자동 복구 훅
 *
 * 30초 이상 "sending" 상태에 머무는 stuck 메시지를 10초 주기로 감지하여
 * operationTracker.failSend() 호출 후 캐시 상태를 "error"로 전환합니다.
 */

import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { operationTracker } from "../operationTracker";
import { type InfiniteMessagesCache } from "@/lib/domains/chat/cacheTypes";
import { chatKeys } from "../queryKeys";

const STALE_THRESHOLD_MS = 30_000;
const CHECK_INTERVAL_MS = 10_000;

export function useChatStaleRecovery(roomId: string, queryClient: QueryClient): void {
  useEffect(() => {
    const interval = setInterval(() => {
      const cache = queryClient.getQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId)
      );
      if (!cache?.pages) return;

      const now = Date.now();
      const staleIds: string[] = [];

      for (const page of cache.pages) {
        for (const msg of page.messages) {
          if (
            msg.status === "sending" &&
            now - new Date(msg.created_at).getTime() > STALE_THRESHOLD_MS
          ) {
            staleIds.push(msg.id);
          }
        }
      }

      if (staleIds.length === 0) return;

      staleIds.forEach((id) => operationTracker.failSend(id));

      const staleIdSet = new Set(staleIds);
      queryClient.setQueryData<InfiniteMessagesCache>(
        chatKeys.messages(roomId),
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((m) =>
                staleIdSet.has(m.id) ? { ...m, status: "error" as const } : m
              ),
            })),
          };
        }
      );
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roomId, queryClient]);
}
