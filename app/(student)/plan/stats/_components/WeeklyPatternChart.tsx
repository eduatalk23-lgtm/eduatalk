"use client";

import type { WeeklyPattern } from "@/lib/domains/plan/actions/statistics";
import { cn } from "@/lib/cn";

type WeeklyPatternChartProps = {
  pattern: WeeklyPattern[];
};

export function WeeklyPatternChart({ pattern }: WeeklyPatternChartProps) {
  const maxCompletion = Math.max(...pattern.map((p) => p.averageCompletion), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        요일별 학습 패턴
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        어떤 요일에 가장 잘 학습하시나요?
      </p>

      <div className="mt-6 flex items-end justify-between gap-2">
        {pattern.map((day) => (
          <div key={day.dayOfWeek} className="flex flex-1 flex-col items-center">
            {/* 바 */}
            <div className="relative h-32 w-full">
              <div
                className={cn(
                  "absolute bottom-0 left-1/2 w-8 -translate-x-1/2 rounded-t-lg transition-all",
                  day.isStrongDay
                    ? "bg-gradient-to-t from-green-500 to-green-400"
                    : day.averageCompletion >= 50
                      ? "bg-gradient-to-t from-blue-500 to-blue-400"
                      : "bg-gradient-to-t from-gray-400 to-gray-300"
                )}
                style={{
                  height: `${Math.max((day.averageCompletion / maxCompletion) * 100, 5)}%`,
                }}
              />
            </div>

            {/* 요일 라벨 */}
            <div
              className={cn(
                "mt-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                day.dayOfWeek === 0
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : day.dayOfWeek === 6
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              )}
            >
              {day.dayName}
            </div>

            {/* 완료율 */}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {Math.round(day.averageCompletion)}%
            </p>

            {/* 강한 요일 표시 */}
            {day.isStrongDay && (
              <span className="mt-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                BEST
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
