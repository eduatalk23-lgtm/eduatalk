"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { Database, Trash2, Target, BarChart3 } from "lucide-react";

export interface CacheStatsData {
  webSearchContent: {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
  };
  generatedAt: string;
}

interface CacheStatsCardProps {
  data: CacheStatsData | null;
  isLoading: boolean;
  onClear: () => void;
  isClearing: boolean;
}

function CacheStatsCardComponent({
  data,
  isLoading,
  onClear,
  isClearing,
}: CacheStatsCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-gray-500 dark:text-gray-400">캐시 통계를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const { webSearchContent } = data;
  const hitRatePercent = Math.round(webSearchContent.hitRate * 100);

  const getHitRateColor = () => {
    if (hitRatePercent >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (hitRatePercent >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-cyan-100 dark:bg-cyan-900/50 p-2">
            <Database className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="text-h3 text-gray-900 dark:text-gray-100">콘텐츠 캐시</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">웹 검색 결과 캐시</p>
          </div>
        </div>
        <button
          onClick={onClear}
          disabled={isClearing}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
            "border border-red-300 dark:border-red-600",
            "text-red-600 dark:text-red-400",
            "hover:bg-red-50 dark:hover:bg-red-900/20",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Trash2 className={cn("w-4 h-4", isClearing && "animate-pulse")} />
          {isClearing ? "초기화 중..." : "캐시 초기화"}
        </button>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className={cn("text-3xl font-bold", getHitRateColor())}>
          {hitRatePercent}%
        </span>
        <span className="text-gray-500 dark:text-gray-400">히트율</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1" />
          <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
            {webSearchContent.hits}
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">히트</span>
        </div>
        <div className="flex flex-col items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-1" />
          <span className="text-lg font-semibold text-amber-700 dark:text-amber-300">
            {webSearchContent.misses}
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400">미스</span>
        </div>
        <div className="flex flex-col items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
          <span className="text-lg font-semibold text-blue-700 dark:text-blue-300">
            {webSearchContent.size}
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400">캐시 크기</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        마지막 갱신: {new Date(data.generatedAt).toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

export const CacheStatsCard = memo(CacheStatsCardComponent);
export default CacheStatsCard;
