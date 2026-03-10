"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";

const MAX_WAIT_MS = 3000; // auth 최대 대기 시간

/**
 * React hydration + auth 로딩 완료 후 인라인 스플래시 스크린을 fade-out 제거한다.
 * - PWA standalone 모드에서만 스플래시가 표시되므로, 해당 경우에만 동작.
 * - auth 로딩이 MAX_WAIT_MS 내에 완료되지 않으면 강제 제거.
 */
export function SplashDismisser() {
  const { isLoading } = useAuth();
  const dismissed = useRef(false);

  useEffect(() => {
    if (dismissed.current) return;

    const splash = document.getElementById("pwa-splash");
    if (!splash) return;

    const dismiss = () => {
      if (dismissed.current) return;
      dismissed.current = true;
      splash.style.opacity = "0";
      const onEnd = () => splash.remove();
      splash.addEventListener("transitionend", onEnd, { once: true });
      // transitionend 미발생 시 안전 제거
      setTimeout(onEnd, 500);
    };

    // auth 로딩이 끝났으면 즉시 dismiss
    if (!isLoading) {
      dismiss();
      return;
    }

    // auth 로딩 중이면 최대 대기 후 강제 dismiss
    const fallback = setTimeout(dismiss, MAX_WAIT_MS);
    return () => clearTimeout(fallback);
  }, [isLoading]);

  return null;
}
