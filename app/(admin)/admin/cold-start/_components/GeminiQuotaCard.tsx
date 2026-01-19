"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { Zap, RefreshCw, AlertTriangle } from "lucide-react";

export interface GeminiQuotaData {
  dailyQuota: number;
  used: number;
  remaining: number;
  usagePercent: number;
  isNearLimit: boolean;
  isExceeded: boolean;
  rateLimitHits: number;
  lastRateLimitTime: number | null;
  resetDate: string;
}

interface GeminiQuotaCardProps {
  data: GeminiQuotaData | null;
  isLoading: boolean;
  onReset: () => void;
  isResetting: boolean;
}

function GeminiQuotaCardComponent({
  data,
  isLoading,
  onReset,
  isResetting,
}: GeminiQuotaCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-gray-500 dark:text-gray-400">할당량 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const getProgressColor = () => {
    if (data.isExceeded) return "bg-red-500";
    if (data.isNearLimit) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getStatusColor = () => {
    if (data.isExceeded) return "text-red-600 dark:text-red-400";
    if (data.isNearLimit) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 dark:bg-purple-900/50 p-2">
            <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-h3 text-gray-900 dark:text-gray-100">Gemini API 할당량</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">일일 사용량</p>
          </div>
        </div>
        <button
          onClick={onReset}
          disabled={isResetting}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
            "border border-gray-300 dark:border-gray-600",
            "text-gray-700 dark:text-gray-300",
            "hover:bg-gray-50 dark:hover:bg-gray-700",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <RefreshCw className={cn("w-4 h-4", isResetting && "animate-spin")} />
          {isResetting ? "리셋 중..." : "트래커 리셋"}
        </button>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className={cn("text-3xl font-bold", getStatusColor())}>
          {data.used}
        </span>
        <span className="text-gray-500 dark:text-gray-400">/ {data.dailyQuota}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">사용됨</span>
      </div>

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={cn("h-full transition-all duration-300", getProgressColor())}
          style={{ width: `${Math.min(data.usagePercent, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          남은 횟수: <span className="font-medium text-gray-900 dark:text-gray-100">{data.remaining}회</span>
        </span>
        <span className={cn("font-medium", getStatusColor())}>
          {data.usagePercent}% 사용
        </span>
      </div>

      {data.rateLimitHits > 0 && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            Rate limit 발생: {data.rateLimitHits}회
            {data.lastRateLimitTime && (
              <span className="text-xs ml-2">
                (마지막: {new Date(data.lastRateLimitTime).toLocaleTimeString("ko-KR")})
              </span>
            )}
          </span>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        리셋 예정: {data.resetDate}
      </div>
    </div>
  );
}

export const GeminiQuotaCard = memo(GeminiQuotaCardComponent);
export default GeminiQuotaCard;
