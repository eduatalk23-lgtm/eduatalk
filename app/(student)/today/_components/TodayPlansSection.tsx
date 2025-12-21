"use client";

import { PlanViewContainer, type ViewMode } from "./PlanViewContainer";
import { useTodayPageContext } from "./TodayPageContext";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";

type TodayPlansSectionProps = {
  initialMode: ViewMode;
  initialPlanDate?: string | null;
  userId?: string;
  tenantId?: string | null;
  campMode?: boolean;
  /**
   * If provided, passes this data to PlanViewContainer to avoid client-side fetch.
   * Used on pages like /camp/today where data is already fetched on the server.
   */
  initialPlansData?: TodayPlansResponse;
};

export function TodayPlansSection({
  initialMode,
  initialPlanDate = null,
  userId,
  tenantId = null,
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
      tenantId={tenantId}
      campMode={campMode}
      initialData={initialPlansData}
    />
  );
}

