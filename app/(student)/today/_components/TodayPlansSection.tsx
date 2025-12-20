"use client";

import { PlanViewContainer, type ViewMode } from "./PlanViewContainer";
import { useTodayPageContext } from "./TodayPageContext";

type TodayPlansSectionProps = {
  initialMode: ViewMode;
  initialPlanDate?: string | null;
  userId?: string;
  tenantId?: string | null;
  campMode?: boolean;
};

export function TodayPlansSection({
  initialMode,
  initialPlanDate = null,
  userId,
  tenantId = null,
  campMode = false,
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
    />
  );
}

