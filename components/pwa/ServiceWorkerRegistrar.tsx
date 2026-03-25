"use client";

import { useEffect, useState, useCallback } from "react";
import { useServiceWorker } from "@/lib/hooks/useServiceWorker";
import { useToast } from "@/components/ui/ToastProvider";
import { RefreshCw } from "lucide-react";

/**
 * Service Worker 등록 + 업데이트 배너 UI.
 *
 * 새 SW가 대기 중이면 하단에 "새 버전이 있습니다 [새로고침]" 배너를 표시합니다.
 * 사용자가 새로고침을 누르면 SKIP_WAITING → controllerchange → 자동 리로드.
 */
export function ServiceWorkerRegistrar() {
  useServiceWorker();
  const { showError } = useToast();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null
  );

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
  }, [waitingWorker]);

  useEffect(() => {
    const handleSwWaiting = (e: Event) => {
      const waiting = (e as CustomEvent).detail
        ?.waiting as ServiceWorker | null;
      if (waiting) setWaitingWorker(waiting);
    };

    const handleSwError = () => {
      showError(
        "알림 서비스를 시작하지 못했습니다. 페이지를 새로고침해주세요."
      );
    };

    window.addEventListener("sw-waiting", handleSwWaiting);
    window.addEventListener("sw-error", handleSwError);

    return () => {
      window.removeEventListener("sw-waiting", handleSwWaiting);
      window.removeEventListener("sw-error", handleSwError);
    };
  }, [showError]);

  if (!waitingWorker) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-primary-600 px-4 py-3 text-white shadow-lg">
      <p className="text-body-2 font-medium">새 버전이 있습니다.</p>
      <button
        onClick={handleUpdate}
        className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-body-2 font-semibold transition-colors hover:bg-white/30"
      >
        <RefreshCw className="size-4" />
        새로고침
      </button>
    </div>
  );
}
