"use client";

/**
 * NetworkStatusIndicator - 네트워크 상태 표시 컴포넌트
 *
 * Option A: 기존 오프라인 시스템 활용도 개선
 * 실시간 네트워크 상태를 표시하고 동기화 상태를 보여줍니다.
 */

import { useOfflineQueue } from "@/lib/offline/useOfflineQueue";
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

interface NetworkStatusIndicatorProps {
  /** 컴팩트 모드 (아이콘만 표시) */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 항상 표시 (기본: 오프라인이거나 동기화 필요할 때만) */
  alwaysShow?: boolean;
}

/**
 * 네트워크 상태 인디케이터
 *
 * - 온라인/오프라인 상태 표시
 * - 대기 중인 동기화 작업 표시
 * - 동기화 진행 중 애니메이션
 */
export function NetworkStatusIndicator({
  compact = false,
  className,
  alwaysShow = false,
}: NetworkStatusIndicatorProps) {
  const { isOnline, pendingCount, isProcessing, needsSync } = useOfflineQueue();

  // 항상 표시 모드가 아니고 온라인이며 동기화 필요 없으면 렌더링하지 않음
  if (!alwaysShow && isOnline && !needsSync) {
    return null;
  }

  // 오프라인 상태
  if (!isOnline) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5",
          "bg-yellow-100 text-yellow-800",
          "dark:bg-yellow-900/50 dark:text-yellow-200",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <WifiOff className="h-4 w-4" />
        {!compact && (
          <span className="text-xs font-medium">
            오프라인
            {pendingCount > 0 && ` · ${pendingCount}개 대기`}
          </span>
        )}
      </div>
    );
  }

  // 동기화 진행 중
  if (isProcessing) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5",
          "bg-blue-100 text-blue-800",
          "dark:bg-blue-900/50 dark:text-blue-200",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="h-4 w-4 animate-spin" />
        {!compact && (
          <span className="text-xs font-medium">
            동기화 중... ({pendingCount})
          </span>
        )}
      </div>
    );
  }

  // 대기 중인 작업이 있음
  if (pendingCount > 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5",
          "bg-orange-100 text-orange-800",
          "dark:bg-orange-900/50 dark:text-orange-200",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Cloud className="h-4 w-4" />
        {!compact && (
          <span className="text-xs font-medium">
            {pendingCount}개 동기화 대기
          </span>
        )}
      </div>
    );
  }

  // 항상 표시 모드에서 온라인 상태
  if (alwaysShow) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1.5",
          "bg-green-100 text-green-800",
          "dark:bg-green-900/50 dark:text-green-200",
          className
        )}
        role="status"
      >
        <Wifi className="h-4 w-4" />
        {!compact && <span className="text-xs font-medium">온라인</span>}
      </div>
    );
  }

  return null;
}

/**
 * 플로팅 네트워크 상태 배너
 *
 * 화면 하단에 고정되어 오프라인/동기화 상태를 눈에 띄게 표시
 */
export function NetworkStatusBanner() {
  const { isOnline, pendingCount, isProcessing } = useOfflineQueue();

  // 온라인이고 동기화 작업이 없으면 표시하지 않음
  if (isOnline && pendingCount === 0 && !isProcessing) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform",
        "flex items-center gap-3 rounded-full px-4 py-2 shadow-lg",
        "transition-all duration-300 ease-out",
        !isOnline
          ? "bg-yellow-500 text-white"
          : isProcessing
          ? "bg-blue-500 text-white"
          : "bg-orange-500 text-white"
      )}
      role="alert"
      aria-live="assertive"
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-5 w-5" />
          <span className="text-sm font-medium">
            오프라인 모드
            {pendingCount > 0 && ` · ${pendingCount}개 작업 대기 중`}
          </span>
        </>
      ) : isProcessing ? (
        <>
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">동기화 중...</span>
        </>
      ) : (
        <>
          <Cloud className="h-5 w-5" />
          <span className="text-sm font-medium">
            {pendingCount}개 작업 동기화 대기
          </span>
        </>
      )}
    </div>
  );
}
