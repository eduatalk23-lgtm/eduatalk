"use client";

import type { ClientNotificationPayload } from "./types";
import { showBrowserNotification } from "./browserNotification";

type ToastFn = (message: string, type?: "info" | "success") => void;

// 중복 방지: tag별 최근 발송 타임스탬프
const recentTags = new Map<string, number>();
const DEDUP_WINDOW = 2000; // 2초

/**
 * 클라이언트 알림의 단일 진입점.
 *
 * 모든 인앱 알림(토스트, 뱃지)은 이 Router를 통해야 합니다.
 * Browser Notification은 browserNotification.ts를 통해 호출됩니다.
 */
class ClientNotificationRouter {
  private showToast: ToastFn | null = null;
  private unreadCountUpdater: ((delta: number) => void) | null = null;

  /** ToastProvider에서 한 번 등록 */
  registerToast(fn: ToastFn) {
    this.showToast = fn;
  }

  /** 언리드 카운터 업데이트 함수 등록 */
  registerUnreadUpdater(fn: (delta: number) => void) {
    this.unreadCountUpdater = fn;
  }

  /** 알림 디스패치 */
  dispatch(notification: ClientNotificationPayload) {
    // 중복 방지
    if (notification.tag) {
      const lastSent = recentTags.get(notification.tag);
      if (lastSent && Date.now() - lastSent < DEDUP_WINDOW) return;
      recentTags.set(notification.tag, Date.now());
    }

    // 현재 URL이 알림 대상과 동일하면 스킵
    if (
      notification.url &&
      typeof window !== "undefined" &&
      window.location.pathname === notification.url
    ) {
      return;
    }

    // 탭이 백그라운드면 Browser Notification fallback
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      showBrowserNotification({
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        url: notification.url,
      });
      return;
    }

    // 포그라운드: 인앱 표시
    switch (notification.inApp) {
      case "toast":
        this.showToast?.(
          `${notification.title}: ${notification.body}`,
          "info"
        );
        break;
      case "badge":
        this.unreadCountUpdater?.(1);
        break;
      case "none":
        break;
    }
  }

  /** 오래된 tag 정리 (메모리 관리) */
  cleanup() {
    const now = Date.now();
    for (const [tag, ts] of recentTags) {
      if (now - ts > 60_000) recentTags.delete(tag);
    }
  }
}

export const clientNotificationRouter = new ClientNotificationRouter();

// 1분마다 오래된 tag 정리
if (typeof window !== "undefined") {
  setInterval(() => clientNotificationRouter.cleanup(), 60_000);
}
