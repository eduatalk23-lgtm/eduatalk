"use client";

/**
 * 결과 요약 컴포넌트
 * 성공/실패/스킵 통계를 카드 형태로 표시
 */

import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";
import { CheckCircle2, XCircle, SkipForward } from "lucide-react";
import type { CreationResult } from "../../_context/types";

interface ResultsSummaryProps {
  results: CreationResult[];
}

export function ResultsSummary({ results }: ResultsSummaryProps) {
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const totalCount = results.length;

  const stats = [
    {
      label: "성공",
      count: successCount,
      icon: CheckCircle2,
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      textColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "실패",
      count: errorCount,
      icon: XCircle,
      bgColor: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      textColor: "text-red-700 dark:text-red-300",
    },
    {
      label: "스킵",
      count: skippedCount,
      icon: SkipForward,
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      textColor: "text-amber-700 dark:text-amber-300",
    },
  ];

  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 성공률 표시 */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className={cn("text-sm font-medium", textSecondary)}>
              전체 진행률
            </span>
            <span className={cn("text-sm font-semibold", textPrimary)}>
              {successRate}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 통계 카드들 */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                "flex flex-col items-center rounded-lg p-4",
                stat.bgColor
              )}
            >
              <Icon className={cn("mb-2 h-6 w-6", stat.iconColor)} />
              <span className={cn("text-2xl font-bold", stat.textColor)}>
                {stat.count}
              </span>
              <span className={cn("text-sm", stat.textColor)}>{stat.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
