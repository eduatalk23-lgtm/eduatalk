"use client";

import { memo } from "react";
import {
  Lightbulb,
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useWeeklyOptimization,
  useDayOfWeekHints,
} from "@/lib/hooks/useWeeklyOptimization";

type WeeklyOptimizationInsightsProps = {
  studentId: string | null;
  className?: string;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 주간 최적화 인사이트 패널
 *
 * 학습 패턴 분석을 기반으로 최적화 권장사항을 표시합니다.
 */
export const WeeklyOptimizationInsights = memo(function WeeklyOptimizationInsights({
  studentId,
  className,
}: WeeklyOptimizationInsightsProps) {
  const {
    idealDailyLoad,
    restDays,
    spacedRepetition,
    optimalTimePeriod,
    optimalDayOfWeek,
    weakSubjects,
    recommendations,
    isLoading,
    isError,
    refetch,
  } = useWeeklyOptimization(studentId);

  const { hints } = useDayOfWeekHints(studentId);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isRestDayToday = restDays.includes(todayStr);

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">학습 최적화</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg" />
          <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">학습 최적화</h3>
        </div>
        <div className="text-center py-4">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">분석을 불러오지 못했습니다</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">학습 최적화</h3>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="새로고침"
        >
          <RefreshCw className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* 오늘 상태 */}
      <div
        className={cn(
          "rounded-lg p-3 mb-4",
          isRestDayToday
            ? "bg-green-50 dark:bg-green-900/20"
            : "bg-indigo-50 dark:bg-indigo-900/20"
        )}
      >
        {isRestDayToday ? (
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">오늘은 휴식일</p>
              <p className="text-sm text-green-600 dark:text-green-400">가벼운 복습만 추천드려요</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-800">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-indigo-800 dark:text-indigo-300">
                오늘 권장 학습량: <span className="text-xl">{idealDailyLoad}</span>개
              </p>
              {optimalTimePeriod && (
                <p className="text-sm text-indigo-600 dark:text-indigo-400">
                  최적 시간대: {optimalTimePeriod}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 요일별 힌트 */}
      {hints.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">요일별 효율</span>
          </div>
          <div className="flex gap-1">
            {hints.map((hint) => (
              <div
                key={hint.dayOfWeek}
                className={cn(
                  "flex-1 text-center py-1.5 rounded text-xs",
                  hint.isOptimal
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium"
                    : hint.isRestRecommended
                      ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                )}
                title={hint.hint}
              >
                {hint.label}
                {hint.isOptimal && <span className="ml-0.5">*</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">* = 최적 요일</p>
        </div>
      )}

      {/* 복습 권장 과목 */}
      {spacedRepetition.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">복습 권장</span>
          </div>
          <div className="space-y-2">
            {spacedRepetition.slice(0, 3).map((item) => (
              <div
                key={item.subject}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-600 dark:text-gray-400">{item.subject}</span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  {item.recommendedDate === todayStr
                    ? "오늘"
                    : new Date(item.recommendedDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 취약 과목 경고 */}
      {weakSubjects.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">보강 필요</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {weakSubjects.slice(0, 3).map((subject) => (
              <span
                key={subject.subject}
                className="inline-block px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-800 text-xs text-amber-700 dark:text-amber-200"
              >
                {subject.subject}
              </span>
            ))}
            {weakSubjects.length > 3 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                +{weakSubjects.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 권장사항 (첫 번째만) */}
      {recommendations.length > 0 && (
        <details className="mt-4 group">
          <summary className="flex items-center justify-between cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            <span>상세 권장사항</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-2">
            {recommendations.slice(0, 2).map((rec, i) => (
              <div
                key={i}
                className="text-xs p-2 rounded bg-gray-50 dark:bg-gray-700"
              >
                <p className="font-medium text-gray-700 dark:text-gray-300">{rec.title}</p>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5">{rec.description}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 데이터 부족 시 */}
      {!weakSubjects.length && !spacedRepetition.length && hints.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <p className="text-sm">분석할 데이터가 부족합니다</p>
          <p className="text-xs mt-1">학습을 계속하면 최적화 제안이 제공됩니다</p>
        </div>
      )}
    </div>
  );
});
