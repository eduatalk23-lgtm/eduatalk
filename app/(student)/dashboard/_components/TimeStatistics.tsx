"use client";

import { cn, bgSurfaceVar, borderDefaultVar, textPrimaryVar, textTertiaryVar } from "@/lib/utils/darkMode";

type TimeStatisticsProps = {
  totalStudySeconds: number;
  pureStudySeconds: number;
  pausedSeconds: number;
  averagePlanMinutes: number;
};

export function TimeStatistics({
  totalStudySeconds,
  pureStudySeconds,
  pausedSeconds,
  averagePlanMinutes,
}: TimeStatisticsProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  return (
    <div className={cn("rounded-xl border p-6 shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
      <div className="flex flex-col gap-4">
        <h3 className={cn("text-lg font-semibold", textPrimaryVar)}>📊 오늘의 시간 분석</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1 text-center">
            <div className={cn("text-sm font-medium", textTertiaryVar)}>총 학습 시간</div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatTime(totalStudySeconds)}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className={cn("text-sm font-medium", textTertiaryVar)}>순수 학습 시간</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatTime(pureStudySeconds)}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className={cn("text-sm font-medium", textTertiaryVar)}>일시정지 시간</div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatTime(pausedSeconds)}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <div className={cn("text-sm font-medium", textTertiaryVar)}>평균 플랜 시간</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {averagePlanMinutes}분
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

