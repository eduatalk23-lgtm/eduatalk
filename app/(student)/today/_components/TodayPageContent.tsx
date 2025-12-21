"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { PlanViewContainer, type ViewMode } from "./PlanViewContainer";
import { TodayAchievements } from "./TodayAchievements";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";

type TodayPageContentProps = {
  initialMode: ViewMode;
  initialPlanDate?: string | null;
  initialProgressDate: string;
  initialProgress: TodayProgress;
  showPlans?: boolean;
  showAchievements?: boolean;
  userId?: string;
  campMode?: boolean;
  /**
   * If provided, passes this data to PlanViewContainer to avoid client-side fetch.
   * Used on pages like /camp/today where data is already fetched on the server.
   */
  initialPlansData?: TodayPlansResponse;
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
  initialPlansData,
}: TodayPageContentProps) {
  const fallbackDate = initialPlanDate ?? initialProgressDate;
  const [selectedDate, setSelectedDate] = useState<string>(fallbackDate);
  
  // If initialPlansData includes todayProgress, use it instead of initialProgress
  // This avoids the need for a separate /api/today/progress call
  const effectiveInitialProgress = initialPlansData?.todayProgress ?? initialProgress;
  const [progress, setProgress] = useState<TodayProgress>(effectiveInitialProgress);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const lastFetchedDateRef = useRef<string>(fallbackDate);
  
  // Track if we should skip progress fetch (when data comes from /api/today/plans)
  const shouldSkipProgressFetch = Boolean(initialPlansData?.todayProgress);

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
    (date: string, options?: { isToday: boolean; todayProgress?: TodayProgress | null }) => {
      if (!date) {
        return;
      }
      setSelectedDate(date);
      
      // If todayProgress is provided from /api/today/plans response, use it
      if (options?.todayProgress) {
        setProgress(options.todayProgress);
        lastFetchedDateRef.current = date;
        return;
      }
      
      // Otherwise, fetch progress separately (only if date changed)
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
      {showPlans && (
        <PlanViewContainer
          initialMode={initialMode}
          initialPlanDate={initialPlanDate}
          onDateChange={handleDateChange}
          userId={userId}
          campMode={campMode}
          initialData={initialPlansData}
        />
      )}
      {showAchievements && <TodayAchievements {...achievementsProps} />}
    </div>
  );
}


