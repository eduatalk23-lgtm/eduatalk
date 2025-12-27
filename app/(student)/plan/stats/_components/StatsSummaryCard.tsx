"use client";

import { TrendingUp, TrendingDown, Minus, Target, Clock, Flame, Calendar } from "lucide-react";
import type { LearningStats } from "@/lib/domains/plan/actions/statistics";
import { cn } from "@/lib/cn";

type StatsSummaryCardProps = {
  stats: LearningStats;
};

export function StatsSummaryCard({ stats }: StatsSummaryCardProps) {
  const { summary, trends } = stats;

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}분`;
    if (mins === 0) return `${hours}시간`;
    return `${hours}시간 ${mins}분`;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving" || trend === "increasing") {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (trend === "declining" || trend === "decreasing") {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 완료율 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          {getTrendIcon(trends.completionTrend)}
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">완료율</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {Math.round(summary.completionRate)}%
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {summary.completedPlans}/{summary.totalPlans} 완료
          </p>
        </div>
      </div>

      {/* 총 학습 시간 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
            <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          {getTrendIcon(trends.studyTimeTrend)}
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">총 학습 시간</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatMinutes(summary.totalStudyMinutes)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            일 평균 {formatMinutes(summary.averageStudyMinutesPerDay)}
          </p>
        </div>
      </div>

      {/* 연속 학습 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          {summary.currentStreak > 0 && (
            <span className="text-xs font-medium text-orange-600">진행 중!</span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">연속 학습</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {summary.currentStreak}일
          </p>
          <p className="mt-1 text-xs text-gray-400">
            최고 기록: {summary.longestStreak}일
          </p>
        </div>
      </div>

      {/* 일관성 점수 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">일관성</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {trends.consistencyScore}점
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                trends.consistencyScore >= 80
                  ? "bg-green-500"
                  : trends.consistencyScore >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
              )}
              style={{ width: `${trends.consistencyScore}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
