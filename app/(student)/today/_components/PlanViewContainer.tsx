"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { SinglePlanView } from "./SinglePlanView";
import { DailyPlanListView } from "./DailyPlanListView";
import { ViewModeSelector } from "./ViewModeSelector";
import { PlanDateNavigator } from "./PlanDateNavigator";
import { usePlanRealtimeUpdates } from "@/lib/realtime/usePlanRealtimeUpdates";
import { useTodayPlans } from "@/lib/hooks/useTodayPlans";
import {
  groupPlansByPlanNumber,
  PlanGroup,
  type PlanWithContent,
} from "../_utils/planGroupUtils";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import {
  formatKoreanDateWithDay,
  getRelativeDateLabel,
  getTodayISODate,
} from "../_utils/dateDisplay";
import type { TodayPlansResponse } from "@/lib/data/todayPlans";

export type ViewMode = "single" | "daily";

type PlanViewContainerProps = {
  initialMode?: ViewMode;
  initialSelectedPlanNumber?: number | null;
  initialPlanDate?: string | null;
  onDateChange?: (date: string, options?: { isToday: boolean; todayProgress?: import("@/lib/metrics/todayProgress").TodayProgress | null }) => void;
  userId?: string;
  tenantId?: string | null;
  campMode?: boolean;
  /**
   * If provided, uses this data as initial data instead of fetching.
   * Used on pages like /camp/today where data is already fetched on the server.
   */
  initialData?: TodayPlansResponse;
};

type SessionState = {
  isPaused: boolean;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  pausedDurationSeconds?: number | null;
};

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
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [selectedPlanNumber, setSelectedPlanNumber] = useState<number | null>(
    initialSelectedPlanNumber
  );
  
  // 사용자가 마지막으로 선택한 planNumber 추적 (같은 날짜 내에서 유지)
  const lastUserSelectedPlanNumber = useRef<number | null>(null);
  const lastPlanDate = useRef<string>(initialPlanDate || getTodayISODate());

  // 날짜 상태 관리 (초기값은 initialPlanDate 또는 오늘 날짜)
  const [planDate, setPlanDate] = useState<string>(() => {
    return initialPlanDate || getTodayISODate();
  });

  // React Query를 사용하여 데이터 조회
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
    includeProgress: true, // todayProgress 포함하여 별도 API 호출 방지
    enabled: !!userId && !!planDate && !initialData, // initialData가 있으면 fetch 비활성화
    initialData: initialData && planDate === initialData.planDate ? initialData : undefined,
  });

  // 데이터 가공 (useMemo로 최적화)
  const groups = useMemo(() => {
    if (plansData?.plans) {
      return groupPlansByPlanNumber(plansData.plans);
    }
    return [];
  }, [plansData?.plans]);

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

  // Realtime 구독 설정 (30초 폴링 대체)
  usePlanRealtimeUpdates({
    planDate: planDate || getTodayISODate(),
    userId: userId || "",
    enabled: Boolean(userId && planDate),
  });

  // 데이터가 로드되면 날짜 변경 콜백 호출
  useEffect(() => {
    if (!plansData) return;

    // todayProgress를 포함하여 onDateChange 호출
    onDateChange?.(plansData.planDate, {
      isToday: Boolean(plansData.isToday),
      todayProgress: plansData.todayProgress,
    });
  }, [plansData, onDateChange]);

  // planDate가 변경되었을 때 selectedPlanNumber 리셋
  useEffect(() => {
    if (planDate !== lastPlanDate.current) {
      lastPlanDate.current = planDate;
      lastUserSelectedPlanNumber.current = null; // 날짜 변경 시 사용자 선택 초기화
      if (groups.length > 0) {
        setSelectedPlanNumber(groups[0]?.planNumber ?? null);
      } else {
        setSelectedPlanNumber(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planDate]);

  // groups가 처음 로드될 때만 selectedPlanNumber 초기화 (planDate 변경 시 제외)
  // 사용자 선택이 있으면 절대 덮어쓰지 않음
  const groupsKey = useMemo(() => {
    return groups.map((g) => g.plan.id).join(",");
  }, [groups]);

  const prevGroupsKey = useRef<string>("");

  useEffect(() => {
    // planDate가 변경되었는지 확인 (이미 위의 useEffect에서 처리됨)
    if (planDate !== lastPlanDate.current) {
      prevGroupsKey.current = groupsKey;
      return; // planDate 변경은 위의 useEffect에서 처리
    }

    // groupsKey가 실제로 변경되었는지 확인
    if (groupsKey === prevGroupsKey.current) {
      return; // 변경되지 않았으면 실행하지 않음
    }
    prevGroupsKey.current = groupsKey;

    console.log("useEffect triggered, groupsKey changed, userSelected:", lastUserSelectedPlanNumber.current);

    // 사용자 선택이 있으면 절대 덮어쓰지 않음
    // planNumber가 null인 경우도 처리 (일일 뷰에서 상세 보기 클릭 시 null이 전달될 수 있음)
    if (lastUserSelectedPlanNumber.current !== null || selectedPlanNumber === null) {
      const userSelected = lastUserSelectedPlanNumber.current;
      // planNumber가 null인 그룹도 유효한 그룹으로 인식
      if (userSelected !== null && groups.some((g) => g.planNumber === userSelected)) {
        console.log("User selection is valid, keeping it:", userSelected);
        // 사용자 선택이 유효하면 아무것도 하지 않음
        return;
      }
      // planNumber가 null인 경우도 처리 (일일 뷰에서 상세 보기 클릭 시)
      if (userSelected === null && groups.length > 0) {
        console.log("User selected null planNumber, keeping first group");
        return;
      }
    }

    // 사용자 선택이 없거나 유효하지 않은 경우에만 초기화
    if (groups.length === 0) {
      if (selectedPlanNumber !== null) {
        setSelectedPlanNumber(null);
      }
      return;
    }

    // 현재 선택이 유효한지 확인
    // planNumber가 null인 그룹도 유효한 그룹으로 인식
    const isValidSelection = selectedPlanNumber === null 
      ? groups.length > 0  // null이면 그룹이 있으면 유효
      : groups.some((g) => g.planNumber === selectedPlanNumber);
    
    if (!isValidSelection) {
      console.log("Current selection is invalid, setting to first group");
      // 유효하지 않으면 첫 번째 그룹 선택 (planNumber가 null이어도 가능)
      setSelectedPlanNumber(groups[0]?.planNumber ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey, planDate]);

  const handleViewDetail = (planNumber: number | null) => {
    // planNumber가 null인 경우도 처리 (plan.id로 그룹을 찾을 수 있음)
    lastUserSelectedPlanNumber.current = planNumber; // 사용자 선택 추적
    setSelectedPlanNumber(planNumber);
    setViewMode("single");
  };
  
  // selectedPlanNumber를 직접 변경하는 핸들러 (SinglePlanView에서 사용)
  const handleSelectPlan = useCallback((planNumber: number | null) => {
    console.log("handleSelectPlan called with:", planNumber);
    lastUserSelectedPlanNumber.current = planNumber; // 사용자 선택 추적
    setSelectedPlanNumber(planNumber);
  }, []);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "single" && !selectedPlanNumber && groups.length > 0) {
      setSelectedPlanNumber(groups[0]?.planNumber ?? null);
    }
  };

  const handleMoveDay = useCallback((delta: number) => {
    const nextDate = shiftIsoDate(planDate, delta);
    if (!nextDate) return;
    // planDate 상태만 변경하면 useTodayPlans가 자동으로 리페치
    setPlanDate(nextDate);
  }, [planDate]);

  const handleResetToToday = useCallback(() => {
    const today = getTodayISODate();
    // planDate 상태만 변경하면 useTodayPlans가 자동으로 리페치
    setPlanDate(today);
  }, []);

  // 로딩 상태 처리
  if (isLoading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <SuspenseFallback />
      </div>
    );
  }

  // 에러 상태 처리
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "플랜을 불러오는 중 오류가 발생했습니다."}
        </p>
        <button
          onClick={() => {
            // React Query가 자동으로 리페치
            setPlanDate(planDate);
          }}
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
          onSelectPlan={handleSelectPlan}
          serverNow={serverNow}
          campMode={campMode}
        />
      )}
    </div>
  );
}
