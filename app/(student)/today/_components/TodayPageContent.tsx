"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { PlanViewContainer, type ViewMode } from "./PlanViewContainer";
import { TodayAchievements } from "./TodayAchievements";
import { CompletionToast } from "./CompletionToast";

type TodayPageContentProps = {
  initialMode: ViewMode;
  initialPlanDate?: string | null;
  initialProgressDate: string;
  initialProgress: TodayProgress;
  showPlans?: boolean;
  showAchievements?: boolean;
  userId?: string;
  campMode?: boolean;
  completedPlanId?: string | null;
  completedPlanTitle?: string | null;
};

type ProgressResponse = {
  planDate: string;
  progress: TodayProgress;
};

export function TodayPageContent({
  initialMode,
  initialPlanDate = null,
  initialProgressDate,
  initialProgress,
  showPlans = true,
  showAchievements = true,
  userId,
  campMode = false,
  completedPlanId,
  completedPlanTitle,
}: TodayPageContentProps) {
  const fallbackDate = initialPlanDate ?? initialProgressDate;
  const [selectedDate, setSelectedDate] = useState<string>(fallbackDate);
  const [progress, setProgress] = useState<TodayProgress>(initialProgress);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const lastFetchedDateRef = useRef<string>(fallbackDate);

  const fetchProgress = useCallback(async (date: string) => {
    if (!date) {
      return;
    }

    try {
      setIsProgressLoading(true);
      setProgressError(null);
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      const response = await fetch(`/api/today/progress${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("성취도 조회 실패");
      }

      const data = (await response.json()) as ProgressResponse;
      setProgress(data.progress);
      lastFetchedDateRef.current = data.planDate ?? date;
    } catch (error) {
      console.error("[TodayPageContent] 성취도 로딩 실패", error);
      setProgressError("성취도 정보를 불러오는 중 문제가 발생했습니다.");
    } finally {
      setIsProgressLoading(false);
    }
  }, []);

  const handleDateChange = useCallback(
    (date: string, _options?: { isToday: boolean }) => {
      if (!date) {
        return;
      }
      setSelectedDate(date);
      if (lastFetchedDateRef.current !== date) {
        fetchProgress(date);
      }
    },
    [fetchProgress]
  );

  const achievementsProps = useMemo(
    () => ({
      todayProgress: progress,
      selectedDate,
      isLoading: isProgressLoading,
      errorMessage: progressError,
    }),
    [progress, selectedDate, isProgressLoading, progressError]
  );

  return (
    <div className="flex flex-col gap-6">
      <CompletionToast completedPlanId={completedPlanId} planTitle={completedPlanTitle} />
      {showPlans && (
        <PlanViewContainer
          initialMode={initialMode}
          initialPlanDate={initialPlanDate}
          onDateChange={handleDateChange}
          userId={userId}
          campMode={campMode}
        />
      )}
      {showAchievements && <TodayAchievements {...achievementsProps} />}
    </div>
  );
}


