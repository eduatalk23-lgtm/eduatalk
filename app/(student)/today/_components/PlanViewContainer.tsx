"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { SinglePlanView } from "./SinglePlanView";
import { DailyPlanListView } from "./DailyPlanListView";
import { ViewModeSelector } from "./ViewModeSelector";
import { PlanDateNavigator } from "./PlanDateNavigator";
import { usePlanRealtimeUpdates } from "@/lib/realtime/usePlanRealtimeUpdates";
import { useTodayPlans } from "@/lib/hooks/useTodayPlans";
import { usePlanViewState, type ViewMode } from "@/lib/hooks/usePlanViewState";
import { groupPlansByPlanNumber } from "../_utils/planGroupUtils";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import {
  formatKoreanDateWithDay,
  getRelativeDateLabel,
  getTodayISODate,
} from "../_utils/dateDisplay";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";

export type { ViewMode };

type PlanViewContainerProps = {
  initialMode?: ViewMode;
  initialSelectedPlanNumber?: number | null;
  initialPlanDate?: string | null;
  onDateChange?: (date: string, options?: { isToday: boolean; todayProgress?: import("@/lib/metrics/todayProgress").TodayProgress | null }) => void;
  userId?: string;
  tenantId?: string | null;
  campMode?: boolean;
  initialData?: TodayPlansResponse;
};

type SessionState = {
  isPaused: boolean;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  pausedDurationSeconds?: number | null;
};

/**
 * ISO 날짜 문자열에 delta 일수를 더한 날짜를 반환
 */
function shiftIsoDate(baseDate: string, delta: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
    return null;
  }

  const [year, month, day] = baseDate.split("-").map(Number);
  if (
    [year, month, day].some(
      (value) => typeof value !== "number" || Number.isNaN(value)
    )
  ) {
    return null;
  }

  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + delta);

  const formattedMonth = String(date.getMonth() + 1).padStart(2, "0");
  const formattedDay = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${formattedMonth}-${formattedDay}`;
}

export function PlanViewContainer({
  initialMode = "daily",
  initialSelectedPlanNumber = null,
  initialPlanDate = null,
  onDateChange,
  userId,
  tenantId = null,
  campMode = false,
  initialData,
}: PlanViewContainerProps) {
  // 날짜 상태 (순환 의존성 방지를 위해 컴포넌트에서 직접 관리)
  const [planDate, setPlanDate] = useState<string>(() => {
    return initialPlanDate || getTodayISODate();
  });

  // 데이터 조회
  const {
    data: plansData,
    isLoading,
    isError,
    error,
  } = useTodayPlans({
    studentId: userId || "",
    tenantId,
    date: planDate,
    camp: campMode,
    includeProgress: true,
    enabled: !!userId && !!planDate && !initialData,
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

  const sessions = useMemo(() => {
    if (plansData?.sessions) {
      const sessionEntries = Object.entries(plansData.sessions) as [
        string,
        SessionState,
      ][];
      return new Map(sessionEntries);
    }
    return new Map<string, SessionState>();
  }, [plansData?.sessions]);

  const isToday = Boolean(plansData?.isToday);
  const serverNow = plansData?.serverNow || Date.now();

  // 선택 및 뷰 모드 상태 관리 Hook
  const {
    viewMode,
    selectedPlanNumber,
    selectedPlanId,
    handleViewDetail,
    handleSelectPlan,
    handleSelectPlanById,
    handleModeChange,
  } = usePlanViewState({
    initialMode,
    initialSelectedPlanNumber,
    groups,
    planDate,
  });

  // 날짜 이동 핸들러
  const handleMoveDay = useCallback(
    (delta: number) => {
      const nextDate = shiftIsoDate(planDate, delta);
      if (nextDate) {
        setPlanDate(nextDate);
      }
    },
    [planDate]
  );

  // 오늘로 리셋 핸들러
  const handleResetToToday = useCallback(() => {
    setPlanDate(getTodayISODate());
  }, []);

  // Realtime 구독
  usePlanRealtimeUpdates({
    planDate: planDate || getTodayISODate(),
    userId: userId || "",
    enabled: Boolean(userId && planDate),
  });

  // 데이터 로드 시 날짜 변경 콜백 호출
  useEffect(() => {
    if (!plansData) return;

    onDateChange?.(plansData.planDate, {
      isToday: Boolean(plansData.isToday),
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
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "플랜을 불러오는 중 오류가 발생했습니다."}
        </p>
        <button
          onClick={handleResetToToday}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PlanDateNavigator
        planDate={planDate}
        isToday={isToday}
        isLoading={isLoading}
        isNavigating={false}
        onMoveDay={handleMoveDay}
        onResetToToday={handleResetToToday}
      />

      {!isToday && planDate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-amber-900">
              {getRelativeDateLabel(planDate)}의 플랜을 보고 있습니다
            </p>
            <p className="text-xs text-amber-700">
              {formatKoreanDateWithDay(planDate)}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <ViewModeSelector mode={viewMode} onChange={handleModeChange} />
      </div>

      {viewMode === "daily" ? (
        <DailyPlanListView
          groups={groups}
          sessions={sessions}
          planDate={planDate}
          onViewDetail={handleViewDetail}
          serverNow={serverNow}
          campMode={campMode}
        />
      ) : (
        <SinglePlanView
          groups={groups}
          sessions={sessions}
          planDate={planDate}
          selectedPlanNumber={selectedPlanNumber}
          selectedPlanId={selectedPlanId}
          onSelectPlan={handleSelectPlan}
          onSelectPlanById={handleSelectPlanById}
          serverNow={serverNow}
          campMode={campMode}
        />
      )}
    </div>
  );
}
