"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  Video,
  FileText,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getContentRecommendations } from "@/lib/domains/ml/actions/predictions";

interface RecommendedContent {
  content_id: string;
  title: string;
  subject: string;
  content_type: string;
  difficulty: string | null;
  relevance_score: number;
  reason?: string;
}

interface Recommendations {
  recommendations: RecommendedContent[];
  weak_subjects: string[];
  strategy: string;
}

/**
 * AI 콘텐츠 추천 카드
 *
 * Python ML API를 호출하여 맞춤형 콘텐츠 추천을 표시합니다.
 */
export function AIRecommendationCard({ studentId }: { studentId: string }) {
  const [data, setData] = useState<Recommendations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const result = await getContentRecommendations(studentId, {
        limit: 4,
        includeReasons: true,
      });

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error("Recommendation error:", err);
      setError("추천 데이터를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchRecommendations();
    }
  }, [studentId]);

  const getContentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "video":
      case "lecture":
        return <Video className="h-4 w-4 text-purple-500" />;
      case "book":
      case "문제집":
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getDifficultyBadge = (difficulty: string | null) => {
    if (!difficulty) return null;

    const colors: Record<string, string> = {
      easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      쉬움: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      보통: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      어려움: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };

    return (
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", colors[difficulty] || "bg-gray-100 text-gray-600")}>
        {difficulty}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          <span className="text-sm text-gray-500">AI 추천 분석 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            AI 맞춤 추천
          </h3>
        </div>
        <div className="mt-4 flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => fetchRecommendations(true)}
          className="mt-3 text-sm text-purple-600 hover:text-purple-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            AI 맞춤 추천
          </h3>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          학습 데이터가 쌓이면 AI가 맞춤 콘텐츠를 추천합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              AI 맞춤 추천
            </h3>
            <p className="text-xs text-gray-500">{data.strategy}</p>
          </div>
        </div>
        <button
          onClick={() => fetchRecommendations(true)}
          disabled={isRefreshing}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
        </button>
      </div>

      {/* Recommendations List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {data.recommendations.slice(0, 4).map((item, index) => (
          <div
            key={item.content_id}
            className={cn(
              "flex items-start gap-3 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50",
              index === 0 && "bg-purple-50/50 dark:bg-purple-900/10"
            )}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
              {getContentTypeIcon(item.content_type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 truncate dark:text-gray-100">
                  {item.title}
                </h4>
                {index === 0 && (
                  <span className="flex-shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    최우선
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {item.subject}
                </span>
                {getDifficultyBadge(item.difficulty)}
                <span className="text-gray-400">
                  관련도 {Math.round(item.relevance_score * 100)}%
                </span>
              </div>

              {item.reason && (
                <p className="mt-1.5 text-xs text-gray-500 line-clamp-1">
                  {item.reason}
                </p>
              )}
            </div>

            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
          </div>
        ))}
      </div>

      {/* Footer - Tips */}
      {data.weak_subjects.length > 0 && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-700">
          <div className="flex items-start gap-2 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600 dark:text-purple-400" />
            <div className="text-sm text-purple-700 dark:text-purple-300">
              <strong>{data.weak_subjects.slice(0, 2).join(", ")}</strong> 과목의
              기초를 다지면 전체 성적 향상에 도움이 됩니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
