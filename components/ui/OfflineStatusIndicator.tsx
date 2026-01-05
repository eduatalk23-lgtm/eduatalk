"use client";

/**
 * OfflineStatusIndicator - 오프라인 상태 표시 컴포넌트
 *
 * lib/offline 시스템을 기반으로 네트워크 상태와 동기화 상태를 시각적으로 표시합니다.
 *
 * @example
 * // 기본 사용
 * <OfflineStatusIndicator />
 *
 * @example
 * // 컴팩트 모드 (모바일 헤더용)
 * <OfflineStatusIndicator variant="compact" />
 */

import { useOfflineQueue } from "@/lib/offline";
import { cn } from "@/lib/cn";
import { WifiOff, RefreshCw, Check, CloudOff } from "lucide-react";

type OfflineStatusIndicatorProps = {
  /** 표시 변형 */
  variant?: "default" | "compact" | "minimal";
  /** 추가 className */
  className?: string;
  /** 온라인 상태에서도 항상 표시할지 여부 */
  showWhenOnline?: boolean;
};

/**
 * 상태별 UI 설정
 */
const statusConfig = {
  offline: {
    icon: WifiOff,
    label: "오프라인 모드",
    shortLabel: "오프라인",
    description: "인터넷 연결이 끊어졌습니다. 학습 기록은 연결되면 자동으로 동기화됩니다.",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-800 dark:text-yellow-200",
    borderClass: "border-yellow-300 dark:border-yellow-700",
    iconClass: "text-yellow-600 dark:text-yellow-400",
  },
  syncing: {
    icon: RefreshCw,
    label: "동기화 중",
    shortLabel: "동기화",
    description: "학습 기록을 서버와 동기화하고 있습니다.",
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
    textClass: "text-blue-800 dark:text-blue-200",
    borderClass: "border-blue-300 dark:border-blue-700",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
  pending: {
    icon: CloudOff,
    label: "동기화 대기",
    shortLabel: "대기",
    description: "동기화가 필요한 학습 기록이 있습니다.",
    bgClass: "bg-orange-100 dark:bg-orange-900/30",
    textClass: "text-orange-800 dark:text-orange-200",
    borderClass: "border-orange-300 dark:border-orange-700",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  synced: {
    icon: Check,
    label: "동기화 완료",
    shortLabel: "완료",
    description: "모든 학습 기록이 동기화되었습니다.",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-800 dark:text-green-200",
    borderClass: "border-green-300 dark:border-green-700",
    iconClass: "text-green-600 dark:text-green-400",
  },
};

type StatusType = keyof typeof statusConfig;

/**
 * 현재 상태 결정
 */
function getStatus(
  isOnline: boolean,
  isProcessing: boolean,
  pendingCount: number
): StatusType {
  if (!isOnline) return "offline";
  if (isProcessing) return "syncing";
  if (pendingCount > 0) return "pending";
  return "synced";
}

export function OfflineStatusIndicator({
  variant = "default",
  className,
  showWhenOnline = false,
}: OfflineStatusIndicatorProps) {
  const { pendingCount, isProcessing, isOnline, needsSync } = useOfflineQueue();

  const status = getStatus(isOnline, isProcessing, pendingCount);
  const config = statusConfig[status];
  const Icon = config.icon;

  // 온라인이고 동기화 필요 없으면 표시하지 않음 (showWhenOnline이 false일 때)
  if (!showWhenOnline && !needsSync) {
    return null;
  }

  // Minimal 변형: 아이콘만 표시
  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full",
          config.bgClass,
          className
        )}
        title={config.label}
        aria-label={config.label}
      >
        <Icon
          className={cn(
            "w-4 h-4",
            config.iconClass,
            status === "syncing" && "animate-spin"
          )}
          aria-hidden="true"
        />
      </div>
    );
  }

  // Compact 변형: 아이콘 + 짧은 라벨
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border",
          config.bgClass,
          config.textClass,
          config.borderClass,
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Icon
          className={cn(
            "w-3 h-3",
            config.iconClass,
            status === "syncing" && "animate-spin"
          )}
          aria-hidden="true"
        />
        <span>
          {config.shortLabel}
          {pendingCount > 0 && status !== "synced" && ` (${pendingCount})`}
        </span>
      </div>
    );
  }

  // Default 변형: 전체 정보 표시
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        config.bgClass,
        config.borderClass,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
          config.bgClass
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4",
            config.iconClass,
            status === "syncing" && "animate-spin"
          )}
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium text-sm", config.textClass)}>
          {config.label}
          {pendingCount > 0 && status !== "synced" && (
            <span className="ml-1">({pendingCount}개 대기)</span>
          )}
        </div>
        <p
          className={cn(
            "text-xs mt-0.5 opacity-80",
            config.textClass
          )}
        >
          {config.description}
        </p>
      </div>
    </div>
  );
}

/**
 * 플로팅 오프라인 배너 - 화면 상단에 고정 표시
 */
export function OfflineStatusBanner({
  className,
}: {
  className?: string;
}) {
  const { isOnline, needsSync, pendingCount, isProcessing } = useOfflineQueue();

  // 온라인이고 동기화 필요 없으면 표시하지 않음
  if (!needsSync) {
    return null;
  }

  const status = getStatus(isOnline, isProcessing, pendingCount);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2",
        config.bgClass,
        config.textClass,
        "shadow-md",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <Icon
        className={cn(
          "w-4 h-4",
          config.iconClass,
          status === "syncing" && "animate-spin"
        )}
        aria-hidden="true"
      />
      <span className="text-sm font-medium">
        {config.label}
        {pendingCount > 0 && status !== "synced" && ` - ${pendingCount}개 동기화 대기`}
      </span>
    </div>
  );
}
