"use client";

import { useEffect } from "react";

type ClearAppBadgeNavigator = Navigator & { clearAppBadge: () => Promise<void> };

/**
 * Service Worker를 등록하는 훅.
 *
 * 기본적으로 프로덕션에서만 등록합니다.
 * 개발 모드에서 Push 테스트가 필요하면 .env.local에
 * NEXT_PUBLIC_ENABLE_SW_DEV=true 를 추가하세요.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // 개발 모드에서는 명시적 환경변수가 있을 때만 등록
    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_ENABLE_SW_DEV !== "true"
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // SW 업데이트 감지
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                // 새 SW 활성화 → 커스텀 이벤트로 UI 알림
                window.dispatchEvent(new CustomEvent("sw-updated"));
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
        // SW 등록 실패 → 커스텀 이벤트로 UI 알림
        window.dispatchEvent(new CustomEvent("sw-error", { detail: err }));
      });

    // Push 알림 클릭 시 네비게이션 처리
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NAVIGATE" && event.data.url) {
        if ("clearAppBadge" in navigator) {
          (navigator as ClearAppBadgeNavigator).clearAppBadge().catch(() => {});
        }
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // 앱 포커스 시 뱃지 초기화
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        "clearAppBadge" in navigator
      ) {
        (navigator as ClearAppBadgeNavigator).clearAppBadge().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
