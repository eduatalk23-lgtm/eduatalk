"use client";

/**
 * StorageQuotaBar — 채팅 첨부 스토리지 사용량 표시
 *
 * 표시 조건 (호출 측에서 결정):
 * - 첨부 큐가 있을 때
 * - 사용량 ≥ 70% (지속 경고)
 *
 * 색상 코드:
 * - <70% : 기본
 * - 70~90% : warning
 * - ≥90%  : error
 */

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatStorageSize, type StorageQuotaInfo } from "@/lib/domains/chat/quota";

interface StorageQuotaBarProps {
  quota: StorageQuotaInfo;
  className?: string;
}

export function StorageQuotaBar({ quota, className }: StorageQuotaBarProps) {
  const percent = Math.min(100, Math.max(0, quota.usagePercent));
  const isCritical = percent >= 90;
  const isWarning = percent >= 70;

  const fillClass = isCritical
    ? "bg-error"
    : isWarning
      ? "bg-warning"
      : "bg-primary";

  const textClass = isCritical
    ? "text-error"
    : isWarning
      ? "text-warning"
      : "text-text-tertiary";

  return (
    <div
      className={cn("flex items-center gap-2 px-3 py-1.5 text-2xs", className)}
      role="status"
      aria-label={`스토리지 사용량 ${percent}%`}
    >
      {isCritical && (
        <AlertTriangle className="w-3 h-3 text-error flex-shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1 h-1 rounded-full bg-bg-tertiary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", fillClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("flex-shrink-0 tabular-nums", textClass)}>
        {formatStorageSize(quota.usedBytes)} / {formatStorageSize(quota.totalBytes)}
        {isWarning && ` (${percent}%)`}
      </span>
    </div>
  );
}
