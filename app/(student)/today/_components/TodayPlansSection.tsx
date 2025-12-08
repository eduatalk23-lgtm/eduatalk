"use client";

import { PlanViewContainer, type ViewMode } from "./PlanViewContainer";
import { useTodayPageContext } from "./TodayPageContext";
import type { PlanWithContent } from "../_utils/planGroupUtils";

type PlansResponse = {
  plans: PlanWithContent[];
  sessions: Record<string, {
    isPaused: boolean;
    startedAt?: string | null;
    pausedAt?: string | null;
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  }>;
  planDate: string;
  isToday?: boolean;
  serverNow?: number;
  todayProgress?: import("@/lib/metrics/todayProgress").TodayProgress | null;
};

type TodayPlansSectionProps = {
  initialMode: ViewMode;
  initialPlanDate?: string | null;
  userId?: string;
  campMode?: boolean;
  initialPlansData?: PlansResponse;
};

export function TodayPlansSection({
  initialMode,
  initialPlanDate = null,
  userId,
  campMode = false,
  initialPlansData,
}: TodayPlansSectionProps) {
  const { handleDateChange } = useTodayPageContext();

  return (
    <PlanViewContainer
      initialMode={initialMode}
      initialPlanDate={initialPlanDate}
      onDateChange={handleDateChange}
      userId={userId}
      campMode={campMode}
      initialData={initialPlansData}
    />
  );
}

