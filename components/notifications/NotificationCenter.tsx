"use client";

import { useState } from "react";
import { Bell, X, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";
import { useNotificationRealtime } from "@/lib/realtime/useNotificationRealtime";
import {
  fetchNotificationsAction,
  markAsReadAction,
  markAllAsReadAction,
  deleteNotificationAction,
} from "@/lib/domains/notification/actions";
import {
  mapPayloadToNotification,
  type Notification,
} from "@/lib/notifications/mapPayloadToNotification";

type NotificationCenterProps = {
  userId: string;
};

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  // React Query로 초기 데이터 로드
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const result = await fetchNotificationsAction();
      if (!result.success) {
        throw new Error(result.error ?? "알림 조회에 실패했습니다.");
      }
      return result.data?.notifications ?? [];
    },
    enabled: !!userId,
    staleTime: 30_000, // 30초 동안 캐시 유지
  });

  // Supabase Realtime 구독
  useNotificationRealtime({
    userId,
    enabled: !!userId,
    showBrowserNotification: true,
    onNewNotification: (payload) => {
      const notification = mapPayloadToNotification(payload);
      queryClient.setQueryData<Notification[]>(
        ["notifications", userId],
        (old) => [notification, ...(old ?? [])]
      );
      toast.showInfo(`새 알림: ${notification.title}`);
    },
    onNotificationUpdate: (payload) => {
      const notification = mapPayloadToNotification(payload);
      queryClient.setQueryData<Notification[]>(
        ["notifications", userId],
        (old) =>
          (old ?? []).map((n) =>
            n.id === notification.id ? notification : n
          )
      );
    },
    onNotificationDelete: (payload) => {
      queryClient.setQueryData<Notification[]>(
        ["notifications", userId],
        (old) => (old ?? []).filter((n) => n.id !== payload.id)
      );
    },
  });

  // 알림 읽음 처리 (Optimistic Update)
  const markAsRead = async (notificationId: string) => {
    // Optimistic update
    queryClient.setQueryData<Notification[]>(
      ["notifications", userId],
      (old) =>
        (old ?? []).map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
    );

    const result = await markAsReadAction(notificationId);
    if (!result.success) {
      refetch(); // Rollback on error
      toast.showError(result.error ?? "알림 읽음 처리에 실패했습니다.");
    }
  };

  // 모든 알림 읽음 처리 (Optimistic Update)
  const markAllAsRead = async () => {
    // Optimistic update
    queryClient.setQueryData<Notification[]>(
      ["notifications", userId],
      (old) => (old ?? []).map((n) => ({ ...n, read: true }))
    );

    const result = await markAllAsReadAction();
    if (!result.success) {
      refetch(); // Rollback on error
      toast.showError(result.error ?? "전체 알림 읽음 처리에 실패했습니다.");
    }
  };

  // 알림 삭제 (Optimistic Update)
  const handleDeleteNotification = async (notificationId: string) => {
    // Optimistic update - 삭제 전 백업
    const previousData = queryClient.getQueryData<Notification[]>([
      "notifications",
      userId,
    ]);

    queryClient.setQueryData<Notification[]>(
      ["notifications", userId],
      (old) => (old ?? []).filter((n) => n.id !== notificationId)
    );

    const result = await deleteNotificationAction(notificationId);
    if (!result.success) {
      // Rollback on error
      queryClient.setQueryData(["notifications", userId], previousData);
      toast.showError(result.error ?? "알림 삭제에 실패했습니다.");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition"
        aria-label="알림"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-12 z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900">알림</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    모두 읽음
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  알림을 불러오는 중...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  알림이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 ${
                        !notification.read ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {notification.title}
                          </h4>
                          <p className="mt-1 text-sm text-gray-600">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(notification.createdAt).toLocaleString(
                              "ko-KR"
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <button
                              type="button"
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-gray-400 hover:text-indigo-600"
                              title="읽음 처리"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteNotification(notification.id)
                            }
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="삭제"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
