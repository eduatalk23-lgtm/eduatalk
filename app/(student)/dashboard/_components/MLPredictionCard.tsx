"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  predictScore,
  getPredictableSubjects,
  getWeakSubjects,
  checkMLApiStatus,
} from "@/lib/domains/ml/actions/predictions";

interface SubjectPrediction {
  subject: string;
  currentScore: number | null;
  predictedScore: number;
  confidence: number;
  trend: "improving" | "stable" | "declining" | "unknown";
}

/**
 * ML 기반 성적 예측 카드
 *
 * Python ML API를 호출하여 과목별 성적 예측을 표시합니다.
 */
export function MLPredictionCard({ studentId }: { studentId: string }) {
  const [predictions, setPredictions] = useState<SubjectPrediction[]>([]);
  const [weakSubjects, setWeakSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  const fetchPredictions = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      // API 상태 확인
      const status = await checkMLApiStatus();
      if (!status.available) {
        setApiAvailable(false);
        setError("ML 서비스에 연결할 수 없습니다.");
        return;
      }
      setApiAvailable(true);

      // 예측 가능한 과목 조회
      const subjectsResult = await getPredictableSubjects(studentId);
      if (!subjectsResult.success) {
        setError(subjectsResult.error);
        return;
      }

      const subjects = subjectsResult.data.subjects.slice(0, 4); // 최대 4과목

      if (subjects.length === 0) {
        setPredictions([]);
        return;
      }

      // 각 과목별 예측 실행
      const predictionPromises = subjects.map(async (subject) => {
        const result = await predictScore(studentId, subject, 30);
        if (result.success) {
          return {
            subject,
            currentScore: result.data.current_score,
            predictedScore: result.data.predicted_score,
            confidence: result.data.confidence,
            trend: result.data.trend,
          } as SubjectPrediction;
        }
        return null;
      });

      const results = await Promise.all(predictionPromises);
      setPredictions(results.filter((r): r is SubjectPrediction => r !== null));

      // 취약 과목 조회
      const weakResult = await getWeakSubjects(studentId);
      if (weakResult.success) {
        setWeakSubjects(weakResult.data.weak_subjects);
      }
    } catch (err) {
      console.error("ML prediction error:", err);
      setError("예측 데이터를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      fetchPredictions();
    }
  }, [studentId]);

  const getTrendIcon = (trend: SubjectPrediction["trend"]) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendText = (trend: SubjectPrediction["trend"]) => {
    switch (trend) {
      case "improving":
        return "상승 추세";
      case "declining":
        return "하락 추세";
      case "stable":
        return "유지";
      default:
        return "";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.4) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-500";
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-sm text-gray-500">AI 예측 분석 중...</span>
        </div>
      </div>
    );
  }

  if (!apiAvailable || error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            AI 성적 예측
          </h3>
        </div>
        <div className="mt-4 flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error || "서비스 연결 중..."}</p>
        </div>
        <button
          onClick={() => fetchPredictions(true)}
          className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            AI 성적 예측
          </h3>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          성적 데이터가 쌓이면 AI가 예측을 시작합니다.
          <br />
          (과목당 최소 3개의 성적 필요)
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              AI 성적 예측
            </h3>
            <p className="text-xs text-gray-500">30일 후 예상 점수</p>
          </div>
        </div>
        <button
          onClick={() => fetchPredictions(true)}
          disabled={isRefreshing}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
        </button>
      </div>

      {/* Predictions Grid */}
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {predictions.map((pred) => (
          <div
            key={pred.subject}
            className={cn(
              "rounded-lg border p-3",
              weakSubjects.includes(pred.subject)
                ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                : "border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {pred.subject}
                </span>
                {weakSubjects.includes(pred.subject) && (
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-800 dark:text-amber-200">
                    취약
                  </span>
                )}
              </div>
              {getTrendIcon(pred.trend)}
            </div>

            <div className="mt-2 flex items-end gap-2">
              {pred.currentScore !== null && (
                <span className="text-lg text-gray-400 line-through">
                  {pred.currentScore}
                </span>
              )}
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {pred.predictedScore}
              </span>
              <span className="mb-1 text-sm text-gray-500">점</span>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">{getTrendText(pred.trend)}</span>
              <span className={getConfidenceColor(pred.confidence)}>
                신뢰도 {Math.round(pred.confidence * 100)}%
              </span>
            </div>

            {/* Confidence Bar */}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pred.confidence >= 0.7
                    ? "bg-green-500"
                    : pred.confidence >= 0.4
                      ? "bg-yellow-500"
                      : "bg-gray-400"
                )}
                style={{ width: `${pred.confidence * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {weakSubjects.length > 0 && (
        <div className="border-t border-gray-100 p-4 dark:border-gray-700">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-sm text-amber-700 dark:text-amber-300">
              <strong>{weakSubjects.slice(0, 2).join(", ")}</strong> 과목에 더
              집중해보세요!
            </p>
            <ChevronRight className="h-4 w-4 text-amber-500" />
          </div>
        </div>
      )}
    </div>
  );
}
