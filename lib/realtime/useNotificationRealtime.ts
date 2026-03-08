"use client";

/**
 * 실시간 알림 구독 훅
 *
 * Supabase Realtime을 사용하여 알림 테이블의 변경사항을 구독합니다.
 * 새 알림이 생성되면 콜백을 호출하고 React Query 캐시를 무효화합니다.
 *
 * @module lib/realtime/useNotificationRealtime
 */

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { clientNotificationRouter } from "@/lib/domains/notification/clientRouter";
import { requestNotificationPermission } from "@/lib/domains/notification/browserNotification";
import type { NotificationType } from "@/lib/domains/notification/types";

// ============================================
// 타입 정의
// ============================================

export type NotificationPayload = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  tenant_id: string | null;
};

export type NotificationRealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

export type NotificationEventHandler = (
  event: NotificationRealtimeEvent,
  notification: NotificationPayload
) => void;

export type UseNotificationRealtimeOptions = {
  /** 사용자 ID */
  userId: string;
  /** 활성화 여부 (기본값: true) */
  enabled?: boolean;
  /** 새 알림 생성 시 콜백 */
  onNewNotification?: (notification: NotificationPayload) => void;
  /** 알림 업데이트 시 콜백 (읽음 처리 등) */
  onNotificationUpdate?: (notification: NotificationPayload) => void;
  /** 알림 삭제 시 콜백 */
  onNotificationDelete?: (notification: NotificationPayload) => void;
  /** 브라우저 알림 표시 여부 (기본값: true) */
  showBrowserNotification?: boolean;
};

// ============================================
// 브라우저 알림 유틸리티 (browserNotification.ts로 통합됨)
// ============================================

// 하위 호환을 위해 re-export (import는 파일 상단에서)
export { requestNotificationPermission };

// ============================================
// 메인 훅
// ============================================

/**
 * 실시간 알림 구독 훅
 *
 * @example
 * ```tsx
 * function NotificationBell() {
 *   const { unreadCount, setUnreadCount } = useNotificationState();
 *
 *   useNotificationRealtime({
 *     userId: currentUser.id,
 *     onNewNotification: (notification) => {
 *       setUnreadCount((prev) => prev + 1);
 *       toast.info(notification.title);
 *     },
 *     onNotificationUpdate: (notification) => {
 *       if (notification.is_read) {
 *         setUnreadCount((prev) => Math.max(0, prev - 1));
 *       }
 *     },
 *   });
 *
 *   return <Badge count={unreadCount}>알림</Badge>;
 * }
 * ```
 */
export function useNotificationRealtime({
  userId,
  enabled = true,
  onNewNotification,
  onNotificationUpdate,
  onNotificationDelete,
  showBrowserNotification: showBrowserNotif = true,
}: UseNotificationRealtimeOptions) {
  const queryClient = useQueryClient();
  const callbacksRef = useRef({
    onNewNotification,
    onNotificationUpdate,
    onNotificationDelete,
  });

  // 콜백 레퍼런스 업데이트 (리렌더링 시에도 최신 콜백 사용)
  useEffect(() => {
    callbacksRef.current = {
      onNewNotification,
      onNotificationUpdate,
      onNotificationDelete,
    };
  }, [onNewNotification, onNotificationUpdate, onNotificationDelete]);

  // React Query 캐시 무효화
  const invalidateNotificationQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        (query.queryKey[0] === "notifications" ||
          query.queryKey[0] === "unreadNotifications" ||
          query.queryKey[0] === "notificationCount"),
    });
  }, [queryClient]);

  // 이벤트 핸들러
  const handleRealtimeEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<NotificationPayload>) => {
      const event = payload.eventType as NotificationRealtimeEvent;
      const newRecord = payload.new as NotificationPayload | undefined;
      const oldRecord = payload.old as NotificationPayload | undefined;

      // React Query 캐시 무효화
      invalidateNotificationQueries();

      switch (event) {
        case "INSERT":
          if (newRecord) {
            // 새 알림 콜백 호출
            callbacksRef.current.onNewNotification?.(newRecord);

            // 통합 알림 라우터로 디스패치
            if (showBrowserNotif && !newRecord.is_read) {
              clientNotificationRouter.dispatch({
                type: (newRecord.type as NotificationType) ?? "system",
                title: newRecord.title,
                body: newRecord.message,
                url: (newRecord.metadata?.url as string) ?? undefined,
                tag: `notification-${newRecord.id}`,
                inApp: "toast",
              });
            }
          }
          break;

        case "UPDATE":
          if (newRecord) {
            callbacksRef.current.onNotificationUpdate?.(newRecord);
          }
          break;

        case "DELETE":
          if (oldRecord) {
            callbacksRef.current.onNotificationDelete?.(oldRecord);
          }
          break;
      }
    },
    [invalidateNotificationQueries, showBrowserNotif]
  );

  // 브로드캐스트 이벤트 핸들러 (일시적 알림용)
  const handleBroadcastEvent = useCallback(
    (payload: { payload: NotificationPayload }) => {
      const notification = payload.payload;
      // 새 알림 콜백 호출
      callbacksRef.current.onNewNotification?.(notification);

      // 통합 알림 라우터로 디스패치
      if (showBrowserNotif && !notification.is_read) {
        clientNotificationRouter.dispatch({
          type: (notification.type as NotificationType) ?? "system",
          title: notification.title,
          body: notification.message,
          url: (notification.metadata?.url as string) ?? undefined,
          tag: `notification-${notification.id}`,
          inApp: "toast",
        });
      }
    },
    [showBrowserNotif]
  );

  // Supabase Realtime 구독
  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    // 싱글톤 클라이언트 사용 (모듈 레벨에서 import)
    // 알림 테이블 변경 및 브로드캐스트 구독
    const channel = supabase
      .channel(`notifications-${userId}`)
      // DB 변경 구독 (영구 알림)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        handleRealtimeEvent
      )
      // 브로드캐스트 구독 (일시적 알림)
      .on("broadcast", { event: "notification" }, handleBroadcastEvent)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, handleRealtimeEvent, handleBroadcastEvent]);
}

// ============================================
// 유틸리티 훅
// ============================================

/**
 * 브라우저 알림 권한 상태 훅
 */
export function useNotificationPermission() {
  const getPermission = useCallback((): NotificationPermission => {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }, []);

  const requestPermission = useCallback(async () => {
    return requestNotificationPermission();
  }, []);

  return {
    permission: typeof window !== "undefined" ? getPermission() : "default",
    requestPermission,
    isSupported: typeof window !== "undefined" && "Notification" in window,
  };
}
