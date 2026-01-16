"use client";

/**
 * ConnectionStatusIndicator - 채팅 연결 상태 표시 컴포넌트
 *
 * 연결 상태에 따라 시각적 피드백을 제공합니다.
 * - 연결됨: 표시하지 않음 (정상 상태)
 * - 연결 끊김: 오프라인 아이콘 + "연결 끊김" + 재연결 버튼
 * - 재연결 중: 로딩 스피너 + "재연결 중..." + 재시도 정보
 * - 대기 메시지: "(N개 대기)" 표시
 */

import { memo } from "react";
import { WifiOff, Loader2, RefreshCw } from "lucide-react";
import type { ConnectionStatus } from "@/lib/realtime/connectionManager";
import { cn } from "@/lib/cn";

interface ConnectionStatusIndicatorProps {
  /** 연결 상태 */
  status: ConnectionStatus;
  /** 대기 중인 메시지 수 */
  pendingCount?: number;
  /** 재시도 횟수 (N/MAX 표시용) */
  retryCount?: number;
  /** 최대 재시도 횟수 */
  maxRetries?: number;
  /** 다음 재시도까지 남은 시간 (초) */
  nextRetryIn?: number | null;
  /** 수동 재연결 콜백 */
  onReconnect?: () => void;
  /** 추가 className */
  className?: string;
}

function ConnectionStatusIndicatorComponent({
  status,
  pendingCount = 0,
  retryCount = 0,
  maxRetries = 5,
  nextRetryIn = null,
  onReconnect,
  className,
}: ConnectionStatusIndicatorProps) {
  // 연결된 상태면 표시하지 않음
  if (status === "connected" && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
        status === "connected" && pendingCount > 0 && "bg-warning/10 text-warning",
        status === "disconnected" && "bg-error/10 text-error",
        status === "reconnecting" && "bg-warning/10 text-warning",
        className
      )}
    >
      {status === "disconnected" && (
        <>
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            <span>
              오프라인
              {pendingCount > 0 && (
                <span className="text-text-secondary"> · {pendingCount}개 메시지 저장됨</span>
              )}
            </span>
          </div>

          {/* 수동 재연결 버튼 - 모바일 터치 타겟 44px */}
          {onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg",
                "bg-primary/20 hover:bg-primary/30 text-primary",
                "transition-colors"
              )}
            >
              <RefreshCw className="w-4 h-4" />
              <span>재연결</span>
            </button>
          )}
        </>
      )}

      {status === "reconnecting" && (
        <>
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>
              재연결 중
              {retryCount > 0 && ` (${retryCount}/${maxRetries})`}
              {pendingCount > 0 && (
                <span className="text-text-secondary"> · {pendingCount}개 대기</span>
              )}
            </span>
          </div>

          {/* 다음 재시도 시간 표시 */}
          {nextRetryIn !== null && nextRetryIn > 0 && (
            <span className="text-text-tertiary text-xs">
              다음 시도: {Math.ceil(nextRetryIn)}초 후
            </span>
          )}
        </>
      )}

      {status === "connected" && pendingCount > 0 && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{pendingCount}개 전송 중...</span>
        </>
      )}
    </div>
  );
}

export const ConnectionStatusIndicator = memo(ConnectionStatusIndicatorComponent);
