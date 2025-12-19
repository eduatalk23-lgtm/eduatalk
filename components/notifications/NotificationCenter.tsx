"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X, Check } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import type { Notification } from "@/lib/services/inAppNotificationService";

type NotificationCenterProps = {
  userId: string;
};

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // 알림 조회
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notifications");
      if (!response.ok) {
        throw new Error("알림 조회에 실패했습니다.");
      }
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("[NotificationCenter] 알림 조회 실패:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // SSE 연결 설정
  useEffect(() => {
    if (!userId) return;

    const eventSource = new EventSource("/api/notifications/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "initial" || data.type === "update") {
          setNotifications(data.notifications || []);
          
          // 새 알림이 있으면 토스트 표시
          if (data.type === "update" && data.notifications.length > 0) {
            const unreadCount = data.notifications.filter(
              (n: Notification) => !n.read
            ).length;
            if (unreadCount > 0) {
              toast.showInfo(`새 알림 ${unreadCount}개가 도착했습니다.`);
            }
          }
        }
      } catch (error) {
        console.error("[NotificationCenter] SSE 메시지 파싱 실패:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[NotificationCenter] SSE 연결 오류:", error);
      eventSource.close();
      // 재연결 시도
      setTimeout(() => {
        if (userId) {
          fetchNotifications();
        }
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [userId, toast, fetchNotifications]);

  // 초기 로드
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId, fetchNotifications]);

  // 알림 읽음 처리
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("알림 읽음 처리에 실패했습니다.");
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error("[NotificationCenter] 알림 읽음 처리 실패:", error);
      toast.showError("알림 읽음 처리에 실패했습니다.");
    }
  };

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("전체 알림 읽음 처리에 실패했습니다.");
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("[NotificationCenter] 전체 알림 읽음 처리 실패:", error);
      toast.showError("전체 알림 읽음 처리에 실패했습니다.");
    }
  };

  // 알림 삭제
  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("알림 삭제에 실패했습니다.");
      }
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("[NotificationCenter] 알림 삭제 실패:", error);
      toast.showError("알림 삭제에 실패했습니다.");
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
                            onClick={() => deleteNotification(notification.id)}
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

