"use client";

import { useMemo } from "react";
import type { DailyStats } from "@/lib/domains/plan/actions/statistics";
import { cn } from "@/lib/cn";

type DailyActivityChartProps = {
  daily: DailyStats[];
  daysToShow?: number;
};

export function DailyActivityChart({
  daily,
  daysToShow = 30,
}: DailyActivityChartProps) {
  // 최근 N일 데이터만 표시
  const recentDaily = useMemo(() => {
    const sortedDaily = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    return sortedDaily.slice(-daysToShow);
  }, [daily, daysToShow]);

  const maxPlanned = useMemo(() => {
    return Math.max(...recentDaily.map((d) => d.planned), 1);
  }, [recentDaily]);

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 요일별 색상
  const getDayColor = (dateStr: string) => {
    const day = new Date(dateStr).getDay();
    if (day === 0) return "text-red-500";
    if (day === 6) return "text-blue-500";
    return "text-gray-500 dark:text-gray-400";
  };

  if (recentDaily.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          일별 학습 현황
        </h3>
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            아직 학습 데이터가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          일별 학습 현황
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-gray-300 dark:bg-gray-600" />
            <span>예정</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-green-500" />
            <span>완료</span>
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="mt-6 overflow-x-auto">
        <div className="flex items-end gap-1" style={{ minWidth: `${recentDaily.length * 24}px` }}>
          {recentDaily.map((day) => (
            <div key={day.date} className="flex flex-col items-center">
              {/* 막대 */}
              <div className="relative h-24 w-5">
                {/* 예정 (배경) */}
                <div
                  className="absolute bottom-0 left-0 w-full rounded-t bg-gray-200 dark:bg-gray-700"
                  style={{
                    height: `${(day.planned / maxPlanned) * 100}%`,
                  }}
                />
                {/* 완료 (전경) */}
                <div
                  className={cn(
                    "absolute bottom-0 left-0 w-full rounded-t transition-all",
                    day.completed === day.planned
                      ? "bg-green-500"
                      : day.completed > 0
                        ? "bg-green-400"
                        : "bg-transparent"
                  )}
                  style={{
                    height: `${(day.completed / maxPlanned) * 100}%`,
                  }}
                />
              </div>

              {/* 날짜 (5일 간격으로 표시) */}
              {recentDaily.indexOf(day) % 5 === 0 && (
                <span className={cn("mt-1 text-[10px]", getDayColor(day.date))}>
                  {formatDate(day.date)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 요약 */}
      <div className="mt-4 flex justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {recentDaily.reduce((sum, d) => sum + d.completed, 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">완료 플랜</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {recentDaily.filter((d) => d.completed > 0).length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">학습일</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {Math.round(
              (recentDaily.reduce((sum, d) => sum + d.completed, 0) /
                Math.max(recentDaily.reduce((sum, d) => sum + d.planned, 0), 1)) *
                100
            )}
            %
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">평균 달성률</p>
        </div>
      </div>
    </div>
  );
}
