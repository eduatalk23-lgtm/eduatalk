"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import { checkActualConnectivity } from "@/lib/offline/networkStatus";

const RETURN_PATH_KEY = "offline:returnPath";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export default function OfflinePage() {
  const router = useRouter();
  const navigatorOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerSnapshot
  );

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [returnPath, setReturnPath] = useState<string>("/");

  // 진입 시 referrer 보관 (SW fallback 으로 떨어진 경우 원래 경로로 복귀)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(RETURN_PATH_KEY);
      if (stored) {
        setReturnPath(stored);
        return;
      }
      const ref = document.referrer;
      if (ref) {
        const url = new URL(ref);
        if (url.origin === window.location.origin && url.pathname !== "/offline") {
          sessionStorage.setItem(RETURN_PATH_KEY, url.pathname + url.search);
          setReturnPath(url.pathname + url.search);
        }
      }
    } catch {
      // sessionStorage 접근 실패는 무시
    }
  }, []);

  const handleRefresh = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryFailed(false);
    const reachable = await checkActualConnectivity(3500);
    if (reachable) {
      try {
        sessionStorage.removeItem(RETURN_PATH_KEY);
      } catch {
        // 무시
      }
      // 원래 경로(또는 루트)로 복귀
      window.location.replace(returnPath || "/");
      return;
    }
    setIsRetrying(false);
    setRetryFailed(true);
  };

  const handleHome = () => {
    try {
      sessionStorage.removeItem(RETURN_PATH_KEY);
    } catch {
      // 무시
    }
    router.replace("/");
  };

  const showSpin = isRetrying;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center flex flex-col gap-8">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            오프라인 상태입니다
          </h1>

          <p className="text-gray-600 dark:text-gray-400">
            인터넷 연결을 확인하고 다시 시도해주세요.
            <br />
            일부 기능은 오프라인에서도 사용할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleRefresh}
            variant="primary"
            className="w-full"
            disabled={isRetrying}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-2", showSpin && "animate-spin")}
            />
            {isRetrying ? "연결 확인 중..." : "다시 시도"}
          </Button>

          <Button onClick={handleHome} variant="outline" className="w-full">
            <Home className="w-4 h-4 mr-2" />
            메인으로 이동
          </Button>
        </div>

        {retryFailed && (
          <p className="text-sm text-red-600 dark:text-red-400">
            아직 인터넷에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.
          </p>
        )}

        {navigatorOnline && !isRetrying && !retryFailed && (
          <p className="text-sm text-green-600 dark:text-green-400">
            네트워크가 복구된 것 같습니다. 다시 시도를 눌러주세요.
          </p>
        )}
      </div>
    </div>
  );
}
