"use client";

import { PlanViewContainer } from "./PlanViewContainer";
import { useTodayPageContext } from "./TodayPageContext";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";
import type { DailyScheduleInfo } from "@/lib/types/plan/domain";

type TodayPlansSectionProps = {
  userId?: string;
  tenantId?: string | null;
  campMode?: boolean;
  /**
   * If provided, passes this data to PlanViewContainer to avoid client-side fetch.
   * Used on pages like /camp/today where data is already fetched on the server.
   */
  initialPlansData?: TodayPlansResponse;
  /**
   * 플랜 그룹에서 도출된 오늘의 타임라인 스케줄
   */
  dailySchedule?: DailyScheduleInfo | null;
};

export function TodayPlansSection({
  userId,
  tenantId = null,
  campMode = false,
  initialPlansData,
  dailySchedule = null,
}: TodayPlansSectionProps) {
  const { handleDateChange } = useTodayPageContext();

  return (
    <PlanViewContainer
      onDateChange={handleDateChange}
      userId={userId}
      tenantId={tenantId}
      campMode={campMode}
      initialData={initialPlansData}
      dailySchedule={dailySchedule}
    />
  );
}
