"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";

/**
 * 오프라인 상태일 때 표시되는 페이지
 * Service Worker가 자동으로 이 페이지를 표시합니다.
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // 온라인 상태 감지
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          오프라인 상태입니다
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-8">
          인터넷 연결을 확인하고 다시 시도해주세요.
          <br />
          일부 기능은 오프라인에서도 사용할 수 있습니다.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleRefresh}
            variant="default"
            className="w-full"
            disabled={!isOnline}
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 mr-2",
                !isOnline && "animate-spin"
              )}
            />
            {isOnline ? "새로고침" : "연결 확인 중..."}
          </Button>

          <Link href="/">
            <Button variant="outline" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              홈으로 이동
            </Button>
          </Link>
        </div>

        {isOnline && (
          <p className="mt-4 text-sm text-green-600 dark:text-green-400">
            인터넷 연결이 복구되었습니다!
          </p>
        )}
      </div>
    </div>
  );
}

