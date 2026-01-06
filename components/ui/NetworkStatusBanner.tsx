"use client";

/**
 * 네트워크 상태 배너 컴포넌트
 *
 * 오프라인 상태 또는 연결 복구 시 사용자에게 알림을 표시합니다.
 *
 * @module components/ui/NetworkStatusBanner
 */

import { memo, useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";

export type NetworkStatusBannerProps = {
  /** 배너 위치 */
  position?: "top" | "bottom";
  /** 연결 복구 메시지 자동 숨김 시간 (ms), 0이면 숨기지 않음 */
  reconnectHideDelay?: number;
  /** 오프라인 메시지 커스텀 */
  offlineMessage?: string;
  /** 연결 복구 메시지 커스텀 */
  reconnectMessage?: string;
  /** 추가 className */
  className?: string;
};

/**
 * 네트워크 상태 배너
 *
 * @example
 * ```tsx
 * // app/layout.tsx에서 사용
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <NetworkStatusBanner position="top" />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
function NetworkStatusBannerComponent({
  position = "top",
  reconnectHideDelay = 3000,
  offlineMessage = "인터넷 연결이 끊어졌습니다. 연결을 확인해주세요.",
  reconnectMessage = "인터넷 연결이 복구되었습니다.",
  className,
}: NetworkStatusBannerProps) {
  const { isOffline, wasOffline, isOnline } = useNetworkStatus();
  const [showReconnect, setShowReconnect] = useState(false);

  // 연결 복구 시 메시지 표시
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnect(true);

      if (reconnectHideDelay > 0) {
        const timer = setTimeout(() => {
          setShowReconnect(false);
        }, reconnectHideDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [isOnline, wasOffline, reconnectHideDelay]);

  // 표시할 내용이 없으면 렌더링하지 않음
  if (!isOffline && !showReconnect) {
    return null;
  }

  const positionClasses = position === "top" ? "top-0" : "bottom-0";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "fixed left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium shadow-lg transition-all duration-300",
        positionClasses,
        isOffline
          ? "bg-warning-500 text-white animate-pulse"
          : "bg-success-500 text-white",
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-center gap-2">
        {isOffline ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5"
            >
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                clipRule="evenodd"
              />
            </svg>
            <span>{offlineMessage}</span>
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                clipRule="evenodd"
              />
            </svg>
            <span>{reconnectMessage}</span>
          </>
        )}
      </div>
    </div>
  );
}

export const NetworkStatusBanner = memo(NetworkStatusBannerComponent);
export default NetworkStatusBanner;
