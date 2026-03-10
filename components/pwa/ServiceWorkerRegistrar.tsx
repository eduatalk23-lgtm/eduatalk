"use client";

import { useEffect } from "react";
import { useServiceWorker } from "@/lib/hooks/useServiceWorker";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * Service Worker 등록 + SW 이벤트 UI 피드백.
 * UI를 렌더링하지 않습니다. 레이아웃에서 한 번만 마운트.
 */
export function ServiceWorkerRegistrar() {
  useServiceWorker();
  const { showInfo, showError } = useToast();

  useEffect(() => {
    const handleSwUpdated = () => {
      showInfo("앱이 업데이트되었습니다. 새로고침하면 최신 버전을 사용할 수 있습니다.");
    };

    const handleSwError = () => {
      showError("알림 서비스를 시작하지 못했습니다. 페이지를 새로고침해주세요.");
    };

    window.addEventListener("sw-updated", handleSwUpdated);
    window.addEventListener("sw-error", handleSwError);

    return () => {
      window.removeEventListener("sw-updated", handleSwUpdated);
      window.removeEventListener("sw-error", handleSwError);
    };
  }, [showInfo, showError]);

  return null;
}
