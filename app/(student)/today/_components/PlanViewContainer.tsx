"use client";

import { useMemo, useEffect } from "react";
import { TimelineView } from "./TimelineView";
import { usePlanRealtimeUpdates } from "@/lib/realtime/usePlanRealtimeUpdates";
import { useTodayPlans } from "@/lib/hooks/useTodayPlans";
import { groupPlansByPlanNumber } from "../_utils/planGroupUtils";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { getTodayISODate } from "../_utils/dateDisplay";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";
import type { DailyScheduleInfo } from "@/lib/types/plan/domain";

type PlanViewContainerProps = {
  onDateChange?: (date: string, options?: { isToday: boolean; todayProgress?: import("@/lib/metrics/todayProgress").TodayProgress | null }) => void;
  userId?: string;
  tenantId?: string | null;
  campMode?: boolean;
  initialData?: TodayPlansResponse;
  dailySchedule?: DailyScheduleInfo | null;
};

export function PlanViewContainer({
  onDateChange,
  userId,
  tenantId = null,
  campMode = false,
  initialData,
  dailySchedule = null,
}: PlanViewContainerProps) {
  // 오늘 날짜 고정
  const planDate = getTodayISODate();

  // 데이터 조회
  const {
    data: plansData,
    isLoading,
    isError,
    error,
    refetch,
  } = useTodayPlans({
    studentId: userId || "",
    tenantId,
    date: planDate,
    camp: campMode,
    includeProgress: true,
    enabled: !!userId && !initialData,
    initialData: initialData && planDate === initialData.planDate ? initialData : undefined,
  });

  // 데이터 가공
  const groups = useMemo(() => {
    if (plansData?.plans) {
      return groupPlansByPlanNumber(plansData.plans);
    }
    if (initialData?.plans) {
      return groupPlansByPlanNumber(initialData.plans);
    }
    return [];
  }, [plansData?.plans, initialData?.plans]);

  const serverNow = plansData?.serverNow || Date.now();

  // Realtime 구독
  usePlanRealtimeUpdates({
    planDate,
    userId: userId || "",
    enabled: Boolean(userId),
  });

  // 데이터 로드 시 날짜 변경 콜백 호출
  useEffect(() => {
    if (!plansData) return;

    onDateChange?.(plansData.planDate, {
      isToday: true,
      todayProgress: plansData.todayProgress,
    });
  }, [plansData, onDateChange]);

  // 로딩 상태
  if (isLoading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <SuspenseFallback />
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState
          title="플랜을 불러올 수 없습니다"
          message={error instanceof Error ? error.message : "플랜을 불러오는 중 오류가 발생했습니다."}
          onRetry={() => refetch()}
          retryLabel="다시 시도"
        />
      </div>
    );
  }

  return (
    <TimelineView
      groups={groups}
      serverNow={serverNow}
      dailySchedule={dailySchedule}
    />
  );
}
