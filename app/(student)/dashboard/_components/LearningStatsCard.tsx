"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Flame,
  Award,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  getLearningStatistics,
  type LearningStats,
  type TimeRange,
} from "@/lib/domains/plan/actions/statistics";
import { cn } from "@/lib/cn";

/**
 * 학습 통계 카드
 *
 * 학습 진행 상황과 패턴을 시각화합니다.
 */
export function LearningStatsCard() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("month");

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const result = await getLearningStatistics(range);
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch learning stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [range]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-sm text-gray-500">통계 계산 중...</span>
        </div>
      </div>
    );
  }

  if (!stats || stats.summary.totalPlans === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            학습 통계
          </h3>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          학습 기록이 없습니다. 첫 플랜을 완료해보세요!
        </p>
        <Link
          href="/today"
          className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          오늘의 플랜 보기
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            학습 통계
          </h3>
        </div>

        {/* Range Selector */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
          {(["week", "month", "quarter"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              )}
            >
              {r === "week" ? "주간" : r === "month" ? "월간" : "분기"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 p-4">
        {/* Completion Rate */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              완료율
            </span>
            {stats.trends.completionTrend === "improving" && (
              <TrendingUp className="h-3 w-3 text-green-500" />
            )}
            {stats.trends.completionTrend === "declining" && (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {Math.round(stats.summary.completionRate)}%
          </p>
          <p className="text-xs text-gray-500">
            {stats.summary.completedPlans}/{stats.summary.totalPlans}개 완료
          </p>
        </div>

        {/* Study Time */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              총 학습 시간
            </span>
            {stats.trends.studyTimeTrend === "increasing" && (
              <TrendingUp className="h-3 w-3 text-green-500" />
            )}
            {stats.trends.studyTimeTrend === "decreasing" && (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {Math.round(stats.summary.totalStudyMinutes / 60)}
            <span className="text-sm font-normal text-gray-500">시간</span>
          </p>
          <p className="text-xs text-gray-500">
            일 평균 {Math.round(stats.summary.averageStudyMinutesPerDay)}분
          </p>
        </div>

        {/* Streak */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              연속 학습
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.summary.currentStreak}
            <span className="text-sm font-normal text-gray-500">일</span>
          </p>
          <p className="text-xs text-gray-500">
            최장 {stats.summary.longestStreak}일
          </p>
        </div>

        {/* Consistency */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              꾸준함
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.trends.consistencyScore}
            <span className="text-sm font-normal text-gray-500">점</span>
          </p>
          <p className="text-xs text-gray-500">
            {stats.summary.totalStudyDays}일 학습
          </p>
        </div>
      </div>

      {/* Weekly Pattern */}
      <div className="border-t border-gray-100 dark:border-gray-700 p-4">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          요일별 패턴
        </h4>
        <div className="flex justify-between gap-1">
          {stats.weeklyPattern.map((day) => (
            <div key={day.dayOfWeek} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "h-12 w-full rounded-md transition-colors",
                  day.averageCompletion >= 80
                    ? "bg-green-500"
                    : day.averageCompletion >= 50
                      ? "bg-yellow-400"
                      : day.averageCompletion > 0
                        ? "bg-gray-300 dark:bg-gray-600"
                        : "bg-gray-100 dark:bg-gray-700"
                )}
                style={{
                  opacity: Math.max(0.3, day.averageCompletion / 100),
                }}
                title={`${day.dayName}: ${Math.round(day.averageCompletion)}% 완료`}
              />
              <span
                className={cn(
                  "text-xs",
                  day.isStrongDay
                    ? "font-medium text-green-600 dark:text-green-400"
                    : "text-gray-500"
                )}
              >
                {day.dayName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Subjects */}
      {stats.bySubject.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            과목별 현황
          </h4>
          <div className="space-y-2">
            {stats.bySubject.slice(0, 4).map((subject) => (
              <div key={subject.subject} className="flex items-center gap-2">
                <span className="min-w-[60px] truncate text-sm text-gray-700 dark:text-gray-300">
                  {subject.subject}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600 h-2">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      subject.completionRate >= 80
                        ? "bg-green-500"
                        : subject.completionRate >= 50
                          ? "bg-yellow-500"
                          : "bg-red-400"
                    )}
                    style={{ width: `${subject.completionRate}%` }}
                  />
                </div>
                <span className="min-w-[40px] text-right text-xs text-gray-500">
                  {Math.round(subject.completionRate)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View More Link */}
      <div className="border-t border-gray-100 dark:border-gray-700 p-4">
        <Link
          href="/analysis"
          className="flex items-center justify-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          상세 분석 보기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
