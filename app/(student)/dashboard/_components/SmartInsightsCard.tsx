"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Award,
  Flame,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  getSmartRecommendations,
  type SmartRecommendation,
  type LearningInsight,
} from "@/lib/domains/content/actions/recommendations";
import { cn } from "@/lib/cn";

/**
 * 스마트 인사이트 카드
 *
 * 학습 패턴을 분석하여 개인화된 추천과 인사이트를 표시합니다.
 */
export function SmartInsightsCard() {
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const result = await getSmartRecommendations();
      if (result.success && result.data) {
        setRecommendations(result.data.recommendations);
        setInsights(result.data.insights);
      }
    } catch (error) {
      console.error("Failed to fetch smart recommendations:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getInsightIcon = (type: LearningInsight["type"]) => {
    switch (type) {
      case "streak":
        return <Flame className="h-4 w-4 text-orange-500" />;
      case "achievement":
        return <Award className="h-4 w-4 text-yellow-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "suggestion":
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendIcon = (trend?: "up" | "down" | "stable") => {
    if (!trend) return null;
    if (trend === "up") return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-500" />;
    return null;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-sm text-gray-500">인사이트 분석 중...</span>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0 && insights.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            스마트 인사이트
          </h3>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          학습 기록이 쌓이면 개인화된 추천을 제공해드릴게요!
        </p>
        <Link
          href="/plan"
          className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          첫 플랜 시작하기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            스마트 인사이트
          </h3>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
        </button>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid gap-3 p-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 rounded-lg p-3",
                insight.type === "streak" && "bg-orange-50 dark:bg-orange-900/10",
                insight.type === "achievement" && "bg-yellow-50 dark:bg-yellow-900/10",
                insight.type === "warning" && "bg-amber-50 dark:bg-amber-900/10",
                insight.type === "suggestion" && "bg-blue-50 dark:bg-blue-900/10"
              )}
            >
              <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {insight.title}
                  </p>
                  {getTrendIcon(insight.trend)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {insight.description}
                </p>
                {insight.metric && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {insight.metric.current}
                        {insight.metric.unit}
                        {insight.metric.target && ` / ${insight.metric.target}${insight.metric.unit}`}
                      </span>
                    </div>
                    {insight.metric.target && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            insight.type === "streak" && "bg-orange-500",
                            insight.type === "achievement" && "bg-yellow-500",
                            insight.type === "warning" && "bg-amber-500",
                            insight.type === "suggestion" && "bg-blue-500"
                          )}
                          style={{
                            width: `${Math.min(
                              (insight.metric.current / insight.metric.target) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              추천
            </h4>
            <div className="space-y-2">
              {recommendations.map((rec, index) => (
                <Link
                  key={index}
                  href={
                    rec.action?.type === "create_plan"
                      ? "/plan"
                      : rec.action?.type === "start_review" && rec.content
                        ? `/plan/content-add?contentId=${rec.content.id}`
                        : "/plan"
                  }
                  className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      rec.type === "review" && "bg-purple-100 dark:bg-purple-900/30",
                      rec.type === "content" && "bg-indigo-100 dark:bg-indigo-900/30",
                      rec.type === "weakness" && "bg-amber-100 dark:bg-amber-900/30",
                      rec.type === "popular" && "bg-green-100 dark:bg-green-900/30"
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        rec.type === "review" && "text-purple-600 dark:text-purple-400",
                        rec.type === "content" && "text-indigo-600 dark:text-indigo-400",
                        rec.type === "weakness" && "text-amber-600 dark:text-amber-400",
                        rec.type === "popular" && "text-green-600 dark:text-green-400"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {rec.title}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {rec.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
