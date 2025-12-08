"use client";

import { useMemo } from "react";
import { TodayAchievements } from "./TodayAchievements";
import { useTodayPageContext } from "./TodayPageContext";

export function TodayAchievementsSection() {
  const { progress, selectedDate, isProgressLoading, progressError } = useTodayPageContext();

  const achievementsProps = useMemo(
    () => ({
      todayProgress: progress,
      selectedDate,
      isLoading: isProgressLoading,
      errorMessage: progressError,
    }),
    [progress, selectedDate, isProgressLoading, progressError]
  );

  return <TodayAchievements {...achievementsProps} />;
}

