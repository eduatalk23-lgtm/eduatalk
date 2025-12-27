"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  getLearningStatistics,
  type TimeRange,
} from "@/lib/domains/plan/actions/statistics";
import { StatsSummaryCard } from "./StatsSummaryCard";
import { WeeklyPatternChart } from "./WeeklyPatternChart";
import { SubjectProgressList } from "./SubjectProgressList";
import { DailyActivityChart } from "./DailyActivityChart";
import { cn } from "@/lib/cn";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "week", label: "1주" },
  { value: "month", label: "1개월" },
  { value: "quarter", label: "3개월" },
  { value: "year", label: "1년" },
  { value: "all", label: "전체" },
];

export function StatsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  const {
    data: statsResult,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["learningStats", timeRange],
    queryFn: () => getLearningStatistics(timeRange),
    staleTime: 1000 * 60 * 5, // 5분
  });

  return (
    <div className="space-y-6">
      {/* 헤더 및 필터 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            학습 통계
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            학습 성과와 패턴을 분석합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 기간 선택 */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => setTimeRange(range.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg",
                  timeRange === range.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* 새로고침 */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* 에러 */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">
            통계를 불러오는 중 오류가 발생했습니다.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      {statsResult?.success && statsResult.data && (
        <>
          {/* 요약 카드 */}
          <StatsSummaryCard stats={statsResult.data} />

          {/* 차트 그리드 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 일별 활동 */}
            <DailyActivityChart daily={statsResult.data.daily} />

            {/* 요일별 패턴 */}
            <WeeklyPatternChart pattern={statsResult.data.weeklyPattern} />
          </div>

          {/* 과목별 진행률 */}
          <SubjectProgressList subjects={statsResult.data.bySubject} />

          {/* 학습 팁 */}
          {statsResult.data.trends.consistencyScore < 60 && (
            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
              <h4 className="font-medium text-amber-700 dark:text-amber-300">
                학습 팁
              </h4>
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                일관성 점수가 낮습니다. 매일 조금씩이라도 학습하면 장기 기억에 더
                효과적입니다. 작은 목표부터 시작해보세요!
              </p>
            </div>
          )}

          {statsResult.data.summary.currentStreak >= 7 && (
            <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <h4 className="font-medium text-green-700 dark:text-green-300">
                축하합니다!
              </h4>
              <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                {statsResult.data.summary.currentStreak}일 연속 학습 중입니다!
                꾸준함이 성공의 비결입니다. 계속 이어가세요!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
