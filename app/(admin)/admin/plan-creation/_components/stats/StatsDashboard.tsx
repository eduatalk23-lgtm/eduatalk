"use client";

/**
 * 통계 대시보드 컴포넌트
 * 플랜 생성 통계 요약 표시
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, borderInput } from "@/lib/utils/darkMode";
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  Zap,
  BookOpen,
  Loader2,
  BarChart3,
} from "lucide-react";
import type { HistoryStats } from "../../_types/historyTypes";
import type { CreationMethod } from "../../_types";
import { getHistoryStats } from "../../_actions";

interface StatsDashboardProps {
  className?: string;
}

const METHOD_CONFIG: Record<
  CreationMethod,
  { icon: typeof Sparkles; label: string; color: string }
> = {
  ai: {
    icon: Sparkles,
    label: "AI 플랜",
    color: "bg-purple-500",
  },
  planGroup: {
    icon: Calendar,
    label: "플랜 그룹",
    color: "bg-indigo-500",
  },
  quickPlan: {
    icon: Zap,
    label: "빠른 플랜",
    color: "bg-amber-500",
  },
  contentAdd: {
    icon: BookOpen,
    label: "콘텐츠 추가",
    color: "bg-emerald-500",
  },
};

export function StatsDashboard({ className }: StatsDashboardProps) {
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 통계 로드
  const loadStats = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await getHistoryStats();
    if (!error && data) {
      setStats(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <BarChart3 className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p className={cn("text-sm", textSecondary)}>통계 데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  // 메서드별 비율 계산
  const totalMethodUsage = Object.values(stats.methodBreakdown).reduce((a, b) => a + b, 0);
  const methodPercentages = Object.entries(stats.methodBreakdown).map(([method, count]) => ({
    method: method as CreationMethod,
    count,
    percentage: totalMethodUsage > 0 ? (count / totalMethodUsage) * 100 : 0,
  }));

  return (
    <div className={cn("space-y-6", className)}>
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* 총 실행 횟수 */}
        <div className={cn("rounded-xl border p-5", borderInput, "bg-white dark:bg-gray-800")}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className={cn("text-sm", textSecondary)}>총 실행</p>
              <p className={cn("text-2xl font-bold", textPrimary)}>{stats.totalExecutions}</p>
            </div>
          </div>
        </div>

        {/* 처리된 학생 수 */}
        <div className={cn("rounded-xl border p-5", borderInput, "bg-white dark:bg-gray-800")}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className={cn("text-sm", textSecondary)}>처리된 학생</p>
              <p className={cn("text-2xl font-bold", textPrimary)}>
                {stats.totalStudentsProcessed}
              </p>
            </div>
          </div>
        </div>

        {/* 성공률 */}
        <div className={cn("rounded-xl border p-5", borderInput, "bg-white dark:bg-gray-800")}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className={cn("text-sm", textSecondary)}>성공률</p>
              <p className={cn("text-2xl font-bold", textPrimary)}>
                {stats.successRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* 가장 많이 사용된 방법 */}
        <div className={cn("rounded-xl border p-5", borderInput, "bg-white dark:bg-gray-800")}>
          <div className="flex items-center gap-3">
            {(() => {
              const topMethod = methodPercentages.sort((a, b) => b.count - a.count)[0];
              if (!topMethod || topMethod.count === 0) {
                return (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                      <BarChart3 className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <p className={cn("text-sm", textSecondary)}>주요 방법</p>
                      <p className={cn("text-lg font-bold", textPrimary)}>-</p>
                    </div>
                  </>
                );
              }
              const config = METHOD_CONFIG[topMethod.method];
              const Icon = config.icon;
              return (
                <>
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      config.color,
                      "bg-opacity-20 dark:bg-opacity-30"
                    )}
                  >
                    <Icon className="h-5 w-5 text-current" />
                  </div>
                  <div>
                    <p className={cn("text-sm", textSecondary)}>주요 방법</p>
                    <p className={cn("text-lg font-bold", textPrimary)}>{config.label}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 메서드별 사용량 */}
      <div className={cn("rounded-xl border p-5", borderInput, "bg-white dark:bg-gray-800")}>
        <h4 className={cn("mb-4 font-medium", textPrimary)}>생성 방법별 사용 현황</h4>

        <div className="space-y-4">
          {methodPercentages.map(({ method, count, percentage }) => {
            const config = METHOD_CONFIG[method];
            const Icon = config.icon;

            return (
              <div key={method}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className={cn("text-sm", textPrimary)}>{config.label}</span>
                  </div>
                  <span className={cn("text-sm font-medium", textSecondary)}>
                    {count}회 ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className={cn("h-full rounded-full transition-all", config.color)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {totalMethodUsage === 0 && (
          <div className={cn("py-8 text-center", textSecondary)}>
            <BarChart3 className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">아직 생성 이력이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
