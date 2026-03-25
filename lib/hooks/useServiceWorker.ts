"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Service Worker를 등록하고 업데이트를 감지하는 훅.
 *
 * - updateViaCache: "none" — HTTP 캐시를 우회하여 항상 최신 SW 확인
 * - visibilitychange — iOS 홈 화면 앱 대응: 포그라운드 복귀 시 업데이트 체크
 * - waiting worker 감지 → "sw-waiting" 이벤트 발행 → UI에서 배너 표시
 * - controllerchange → 새 SW 활성화 시 페이지 자동 리로드
 */
export function useServiceWorker() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const promptUpdate = useCallback((waiting: ServiceWorker) => {
    window.dispatchEvent(
      new CustomEvent("sw-waiting", { detail: { waiting } })
    );
  }, []);

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
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          registrationRef.current = registration;

          // 이미 대기 중인 SW가 있으면 즉시 프롬프트
          if (registration.waiting) {
            promptUpdate(registration.waiting);
          }

          // 새 SW 설치 감지
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              // 새 SW가 installed(대기) 상태 + 기존 controller가 있으면 = 업데이트
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                promptUpdate(newWorker);
              }
            });
          });
        })
        .catch((err) => {
          console.error("[SW] Registration failed:", err);
          window.dispatchEvent(new CustomEvent("sw-error", { detail: err }));
        });
    };

    // 메인 스레드 블로킹 방지: 브라우저 유휴 시 등록
    if ("requestIdleCallback" in window) {
      (window as Window).requestIdleCallback(registerSW, { timeout: 5000 });
    } else {
      setTimeout(registerSW, 3000);
    }

    // controllerchange: SKIP_WAITING 후 새 SW가 활성화되면 페이지 리로드
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

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

    // iOS 대응: 앱이 포그라운드로 돌아올 때 업데이트 체크
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && registrationRef.current) {
        registrationRef.current.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [promptUpdate]);
}
