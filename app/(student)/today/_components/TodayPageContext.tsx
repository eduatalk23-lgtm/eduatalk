"use client";

import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from "react";
import type { TodayProgress } from "@/lib/metrics/todayProgress";
import { MilestoneProvider } from "./MilestoneContext";
import { NetworkStatusBanner } from "./NetworkStatusIndicator";

type ProgressResponse = {
  planDate: string;
  progress: TodayProgress;
};

type TodayPageContextValue = {
  selectedDate: string;
  progress: TodayProgress;
  isProgressLoading: boolean;
  progressError: string | null;
  handleDateChange: (date: string, options?: { isToday: boolean; todayProgress?: TodayProgress | null }) => void;
  shouldSkipProgressFetch: boolean;
};

const TodayPageContext = createContext<TodayPageContextValue | null>(null);

type TodayPageContextProviderProps = {
  children: ReactNode;
  initialProgressDate: string;
  initialProgress: TodayProgress;
  initialPlansData?: {
    todayProgress?: TodayProgress | null;
  };
};

export function TodayPageContextProvider({
  children,
  initialProgressDate,
  initialProgress,
  initialPlansData,
}: TodayPageContextProviderProps) {
  const fallbackDate = initialProgressDate;
  const [selectedDate, setSelectedDate] = useState<string>(fallbackDate);
  
  // If initialPlansData includes todayProgress, use it instead of initialProgress
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
      console.error("[TodayPageContext] 성취도 로딩 실패", error);
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

  return (
    <TodayPageContext.Provider
      value={{
        selectedDate,
        progress,
        isProgressLoading,
        progressError,
        handleDateChange,
        shouldSkipProgressFetch,
      }}
    >
      <MilestoneProvider>
        {children}
      </MilestoneProvider>
      <NetworkStatusBanner />
    </TodayPageContext.Provider>
  );
}

export function useTodayPageContext() {
  const context = useContext(TodayPageContext);
  if (!context) {
    throw new Error("useTodayPageContext must be used within TodayPageContextProvider");
  }
  return context;
}

