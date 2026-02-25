/**
 * Browser Notification API의 단일 래퍼.
 *
 * 이전에 2곳에서 독립적으로 호출하던 것을 이 파일로 통합합니다.
 * - lib/realtime/useNotificationRealtime.ts
 * - lib/domains/calendar/reminders.ts
 */

const NOTIFICATION_AUTO_CLOSE_MS = 5000;

/** 권한 요청 (단일 진입점) */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/** 알림 표시 (단일 진입점) */
export function showBrowserNotification(options: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
}) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon ?? "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: options.tag ?? "default",
    });

    notification.onclick = () => {
      window.focus();
      if (options.url) {
        window.location.href = options.url;
      }
      notification.close();
    };

    setTimeout(() => notification.close(), NOTIFICATION_AUTO_CLOSE_MS);
  } catch {
    // 브라우저 알림 실패 시 무시
  }
}
