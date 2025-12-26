"use client";

import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { CircularProgress } from "./CircularProgress";
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

/**
 * B4 개선: 진행률에 따른 동기부여 메시지
 */
function getMotivationalMessage(completionRate: number, hasPlans: boolean): string {
  if (!hasPlans) return "오늘의 학습 플랜을 확인해보세요!";
  if (completionRate === 0) return "오늘 학습을 시작해보세요! 💪";
  if (completionRate < 30) return "좋은 시작이에요! 계속 힘내세요!";
  if (completionRate < 50) return "잘하고 있어요! 절반까지 파이팅!";
  if (completionRate < 70) return "반 이상 완료! 조금만 더요!";
  if (completionRate < 100) return "거의 다 왔어요! 마무리까지 화이팅!";
  return "오늘 학습 완료! 🎉 수고하셨습니다!";
}

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

  // B4 개선: 동기부여 메시지
  const motivationalMessage = getMotivationalMessage(completionRate, hasPlans);

  return (
    <div className={cn(cardBase, "p-4")}>
      <div className="flex flex-col gap-4">
        {/* B4 개선: 상단 헤더 + 원형 진행률 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className={cn("text-lg font-semibold", textPrimary)}>학습 성취도 요약</h2>
            <p className={cn("text-xs", textMuted)}>
              {relativeLabel} · {formattedDate}
            </p>
            {/* B4 개선: 동기부여 메시지 */}
            <p className={cn(
              "mt-2 text-sm font-medium",
              completionRate === 100
                ? "text-green-600 dark:text-green-400"
                : "text-indigo-600 dark:text-indigo-400"
            )}>
              {motivationalMessage}
            </p>
          </div>
          {/* B4 개선: 원형 진행률 표시 */}
          <CircularProgress
            percentage={completionRate}
            size="md"
            showPercentage
          />
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

