"use client";

import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  formatKoreanDateWithDay,
  getRelativeDateLabel,
} from "../_utils/dateDisplay";

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
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-5 w-28 rounded bg-gray-200" />
          <div className="h-4 w-40 rounded bg-gray-100" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-3/4 rounded bg-gray-100" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-gray-900">학습 성취도 요약</h2>
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">학습 성취도 요약</h2>
            <p className="text-xs text-gray-500">
              {relativeLabel} · {formattedDate}
            </p>
          </div>
          <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            {selectedDate || "-"}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">학습 시간</span>
            <span className="font-semibold text-gray-900">
              {Math.floor(todayProgress.todayStudyMinutes / 60)}시간{" "}
              {todayProgress.todayStudyMinutes % 60}분
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">완료한 플랜</span>
              {hasPlans ? (
                <span className="font-semibold text-gray-900">
                  {todayProgress.planCompletedCount} /{" "}
                  {todayProgress.planTotalCount}
                </span>
              ) : (
                <span className="text-gray-400">플랜 없음</span>
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
              <span className="text-gray-600">학습 효율 점수</span>
              <span className="font-semibold text-blue-600">
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

