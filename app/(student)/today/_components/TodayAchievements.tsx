"use client";

import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import {
  formatKoreanDateWithDay,
  getRelativeDateLabel,
} from "../_utils/dateDisplay";
import { cn } from "@/lib/cn";
import {
  cardBase,
  textPrimary,
  textSecondary,
  textMuted,
  textTertiary,
} from "@/lib/utils/darkMode";

type TodayAchievementsProps = {
  todayProgress: TodayProgress;
  selectedDate?: string | null;
  isLoading?: boolean;
  errorMessage?: string | null;
};

export function TodayAchievements({
  todayProgress,
  selectedDate,
  isLoading = false,
  errorMessage,
}: TodayAchievementsProps) {
  const completionRate =
    todayProgress.planTotalCount > 0
      ? Math.round(
          (todayProgress.planCompletedCount / todayProgress.planTotalCount) * 100
        )
      : 0;

  const hasPlans = todayProgress.planTotalCount > 0;
  const formattedDate = selectedDate
    ? formatKoreanDateWithDay(selectedDate)
    : "-";
  const relativeLabel = selectedDate
    ? getRelativeDateLabel(selectedDate)
    : "선택한 날짜";

  if (isLoading) {
    return (
      <div className={cn(cardBase, "p-4")}>
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-5 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-40 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={cn(
        "rounded-xl border border-dashed p-4",
        "border-red-200 dark:border-red-800",
        "bg-red-50 dark:bg-red-900/30"
      )}>
        <div className="flex flex-col gap-2">
          <h2 className={cn("text-lg font-semibold", textPrimary)}>학습 성취도 요약</h2>
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(cardBase, "p-4")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={cn("text-lg font-semibold", textPrimary)}>학습 성취도 요약</h2>
            <p className={cn("text-xs", textMuted)}>
              {relativeLabel} · {formattedDate}
            </p>
          </div>
          <div className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            "bg-indigo-50 dark:bg-indigo-900/30",
            "text-indigo-700 dark:text-indigo-300"
          )}>
            {selectedDate || "-"}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className={textTertiary}>학습 시간</span>
            <span className={cn("font-semibold", textPrimary)}>
              {Math.floor(todayProgress.todayStudyMinutes / 60)}시간{" "}
              {todayProgress.todayStudyMinutes % 60}분
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className={textTertiary}>완료한 플랜</span>
              {hasPlans ? (
                <span className={cn("font-semibold", textPrimary)}>
                  {todayProgress.planCompletedCount} /{" "}
                  {todayProgress.planTotalCount}
                </span>
              ) : (
                <span className={textMuted}>플랜 없음</span>
              )}
            </div>
            <ProgressBar
              value={hasPlans ? completionRate : 0}
              height="md"
              color={hasPlans ? "green" : undefined}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className={textTertiary}>학습 효율 점수</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {todayProgress.achievementScore}점
              </span>
            </div>
            <ProgressBar
              value={todayProgress.achievementScore}
              height="md"
              color="blue"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

