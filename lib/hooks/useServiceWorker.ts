"use client";

import { useEffect } from "react";

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

    const registerSW = () => {
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
    };

    // 메인 스레드 블로킹 방지: 브라우저 유휴 시 등록
    if ("requestIdleCallback" in window) {
      (window as Window).requestIdleCallback(registerSW, { timeout: 5000 });
    } else {
      setTimeout(registerSW, 3000);
    }

    // Push 알림 클릭 시 네비게이션 처리
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NAVIGATE" && event.data.url) {
        // 뱃지 갱신은 useAppBadge가 visibilitychange에서 처리
        window.location.href = event.data.url;
      }
      // SW에서 알림 클릭 후 뱃지 재계산 요청
      if (event.data?.type === "BADGE_NEEDS_SYNC") {
        window.dispatchEvent(new CustomEvent("badge-needs-sync"));
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // 뱃지 관리: useAppBadge 훅이 visibilitychange + 캐시 변경 감지로 처리
    // (기존 무조건 clearAppBadge 제거 → 실제 미읽은 수 기반 갱신)

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);
}
