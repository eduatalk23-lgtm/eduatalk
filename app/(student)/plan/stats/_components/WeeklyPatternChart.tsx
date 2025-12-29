"use client";

import type { WeeklyPattern } from "@/lib/domains/plan/actions/statistics";
import { cn } from "@/lib/cn";

type WeeklyPatternChartProps = {
  pattern: WeeklyPattern[];
};

/**
 * 요일별 학습 패턴을 막대 차트로 시각화
 * 접근성: 스크린 리더를 위한 설명 텍스트 포함
 */
export function WeeklyPatternChart({ pattern }: WeeklyPatternChartProps) {
  const maxCompletion = Math.max(...pattern.map((p) => p.averageCompletion), 1);
  const bestDay = pattern.find((p) => p.isStrongDay);
  const chartDescription = `요일별 평균 학습 완료율 차트. ${bestDay ? `${bestDay.dayName}요일이 ${Math.round(bestDay.averageCompletion)}%로 가장 높습니다.` : ""}`;

  return (
    <div className="rounded-xl border border-secondary-200 bg-white p-5 shadow-sm dark:border-secondary-700 dark:bg-secondary-800">
      <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
        요일별 학습 패턴
      </h3>
      <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
        어떤 요일에 가장 잘 학습하시나요?
      </p>

      {/* 스크린 리더를 위한 차트 설명 */}
      <div className="sr-only" role="region" aria-label="차트 요약">
        {chartDescription}
        <ul>
          {pattern.map((day) => (
            <li key={day.dayOfWeek}>
              {day.dayName}요일: 평균 완료율 {Math.round(day.averageCompletion)}%
              {day.isStrongDay ? " (최고 성과)" : ""}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="mt-6 flex items-end justify-between gap-2"
        role="img"
        aria-label={chartDescription}
        aria-hidden="false"
      >
        {pattern.map((day) => (
          <div key={day.dayOfWeek} className="flex flex-1 flex-col items-center">
            {/* 바 */}
            <div className="relative h-32 w-full" aria-hidden="true">
              <div
                className={cn(
                  "absolute bottom-0 left-1/2 w-8 -translate-x-1/2 rounded-t-lg transition-all",
                  day.isStrongDay
                    ? "bg-gradient-to-t from-success-500 to-success-400"
                    : day.averageCompletion >= 50
                      ? "bg-gradient-to-t from-primary-500 to-primary-400"
                      : "bg-gradient-to-t from-secondary-400 to-secondary-300"
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
                  ? "bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400"
                  : day.dayOfWeek === 6
                    ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                    : "bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300"
              )}
              aria-hidden="true"
            >
              {day.dayName}
            </div>

            {/* 완료율 */}
            <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400" aria-hidden="true">
              {Math.round(day.averageCompletion)}%
            </p>

            {/* 강한 요일 표시 */}
            {day.isStrongDay && (
              <span className="mt-1 text-[10px] font-medium text-success-600 dark:text-success-400" aria-hidden="true">
                BEST
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
