"use client";

/**
 * useAppBadge - 통합 앱 뱃지 관리 훅
 *
 * 채팅 미읽은 수 + 알림 미읽은 수를 합산하여
 * navigator.setAppBadge()로 앱 아이콘 뱃지를 갱신합니다.
 *
 * SW의 IndexedDB 카운터도 SYNC_BADGE 메시지로 동기화합니다.
 */

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatKeys } from "@/lib/domains/chat/queryKeys";

type SetAppBadgeNavigator = Navigator & {
  setAppBadge: (count: number) => Promise<void>;
  clearAppBadge: () => Promise<void>;
};

interface ChatRoomItem {
  id: string;
  unreadCount?: number;
}

interface NotificationItem {
  read?: boolean;
}

function hasAppBadge(): boolean {
  return typeof navigator !== "undefined" && "setAppBadge" in navigator;
}

/**
 * 현재 React Query 캐시에서 통합 미읽은 수 계산
 */
function getTotalUnreadFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | null
): number {
  let total = 0;

  // 1. 채팅 미읽은 수
  const rooms = queryClient.getQueryData<ChatRoomItem[]>(chatKeys.rooms());
  if (rooms) {
    total += rooms.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
  }

  // 2. 알림 미읽은 수
  if (userId) {
    const notifications = queryClient.getQueryData<NotificationItem[]>([
      "notifications",
      userId,
    ]);
    if (notifications) {
      total += notifications.filter((n) => !n.read).length;
    }
  }

  return total;
}

/**
 * 앱 뱃지를 실제 미읽은 수로 갱신
 */
function updateBadge(count: number): void {
  if (!hasAppBadge()) return;

  const nav = navigator as SetAppBadgeNavigator;
  if (count > 0) {
    nav.setAppBadge(count).catch(() => {});
  } else {
    nav.clearAppBadge().catch(() => {});
  }

  // SW IndexedDB 카운터도 동기화
  navigator.serviceWorker?.controller?.postMessage({
    type: "SYNC_BADGE",
    count,
  });
}

export interface UseAppBadgeReturn {
  /** 현재 캐시 기반으로 뱃지 즉시 갱신 */
  syncBadge: () => void;
}

/**
 * 통합 앱 뱃지 관리 훅
 *
 * - React Query 캐시 변경 시 자동으로 뱃지 갱신
 * - visibilitychange 시 실제 미읽은 수 기반 갱신 (무조건 clear 대신)
 * - syncBadge()로 수동 갱신 가능
 */
export function useAppBadge(userId: string | null): UseAppBadgeReturn {
  const queryClient = useQueryClient();
  const lastCountRef = useRef<number>(-1);
  /** 캐시가 최초 로드되기 전에는 badge를 0으로 초기화하지 않음 */
  const cacheLoadedRef = useRef(false);

  const syncBadge = useCallback(() => {
    const count = getTotalUnreadFromCache(queryClient, userId);

    // 캐시가 아직 로드되지 않은 상태에서 count=0이면 무시
    // (SW가 쌓아둔 뱃지를 앱 재시작 시 지우지 않기 위해)
    if (!cacheLoadedRef.current) {
      if (count === 0) return;
      cacheLoadedRef.current = true;
    }

    // 불필요한 반복 호출 방지
    if (count !== lastCountRef.current) {
      lastCountRef.current = count;
      updateBadge(count);
    }
  }, [queryClient, userId]);

  // 채팅/알림 캐시 변경 감지 → 자동 뱃지 갱신
  // 전체 캐시 구독 대신 관련 쿼리 키만 필터링하여 불필요한 호출 방지
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event?.query?.queryKey) return;
      const key = event.query.queryKey;
      const isChat =
        Array.isArray(key) && key[0] === "chat-rooms";
      const isNotification =
        Array.isArray(key) && key[0] === "notifications";
      if (isChat || isNotification) {
        // 캐시 데이터가 실제로 존재하면 로드 완료로 표시
        if (event.query.state.data != null) {
          cacheLoadedRef.current = true;
        }
        syncBadge();
      }
    });
    return unsubscribe;
  }, [queryClient, syncBadge]);

  // visibilitychange → 실제 미읽은 수 기반 갱신 + 읽은 방의 stale 알림 정리
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncBadge();

        // unreadCount=0인 채팅방의 알림 트레이 정리
        // (백그라운드에서 앱 내 읽음 처리 후 복귀 시, 트레이에 남은 stale 알림 제거)
        const rooms = queryClient.getQueryData<ChatRoomItem[]>(chatKeys.rooms());
        if (rooms) {
          const tagsToClean = rooms
            .filter((r) => (r.unreadCount ?? 0) === 0)
            .flatMap((r) => [`chat-${r.id}`, `chat-mention-${r.id}`]);
          if (tagsToClean.length > 0) {
            navigator.serviceWorker?.controller?.postMessage({
              type: "CLEAR_NOTIFICATIONS",
              tags: tagsToClean,
            });
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncBadge, queryClient]);

  // SW 알림 클릭 후 뱃지 재계산 요청 (BADGE_NEEDS_SYNC 이벤트)
  useEffect(() => {
    const handleBadgeSync = () => {
      // 약간의 지연 후 동기화 (페이지 네비게이션 + 캐시 갱신 대기)
      setTimeout(syncBadge, 500);
    };
    window.addEventListener("badge-needs-sync", handleBadgeSync);
    return () => {
      window.removeEventListener("badge-needs-sync", handleBadgeSync);
    };
  }, [syncBadge]);

  // 초기 마운트 시 동기화
  useEffect(() => {
    syncBadge();
  }, [syncBadge]);

  return { syncBadge };
}
