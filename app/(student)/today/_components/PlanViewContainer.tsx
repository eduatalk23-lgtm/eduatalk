"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SinglePlanView } from "./SinglePlanView";
import { DailyPlanListView } from "./DailyPlanListView";
import { ViewModeSelector } from "./ViewModeSelector";
import { PlanDateNavigator } from "./PlanDateNavigator";
import { usePlanRealtimeUpdates } from "@/lib/realtime/usePlanRealtimeUpdates";
import {
  groupPlansByPlanNumber,
  PlanGroup,
  PlanWithContent,
} from "../_utils/planGroupUtils";
import {
  formatKoreanDateWithDay,
  getRelativeDateLabel,
  getTodayISODate,
} from "../_utils/dateDisplay";

export type ViewMode = "single" | "daily";

type PlanViewContainerProps = {
  initialMode?: ViewMode;
  initialSelectedPlanNumber?: number | null;
  initialPlanDate?: string | null;
  onDateChange?: (date: string, options?: { isToday: boolean; todayProgress?: PlansResponse["todayProgress"] }) => void;
  userId?: string;
  campMode?: boolean;
  /**
   * If provided, initializes state from this data and skips the client-side fetch.
   * This is used to avoid double-fetch on pages like /camp/today where the data
   * is already fetched on the server side.
   */
  initialData?: PlansResponse;
};

type SessionState = {
  isPaused: boolean;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  pausedDurationSeconds?: number | null;
};

type PlansResponse = {
  plans: PlanWithContent[];
  sessions: Record<string, SessionState>;
  planDate: string;
  isToday?: boolean;
  serverNow?: number;
  /**
   * Today progress summary (from /api/today/plans).
   * If provided, TodayPageContent can skip calling /api/today/progress separately.
   */
  todayProgress?: import("@/lib/metrics/todayProgress").TodayProgress | null;
};

const SESSION_REFRESH_INTERVAL_MS = 30000;

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
  campMode = false,
  initialData,
}: PlanViewContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [selectedPlanNumber, setSelectedPlanNumber] = useState<number | null>(
    initialSelectedPlanNumber
  );

  // If initialData is provided, initialize state from it to avoid double-fetch
  const [groups, setGroups] = useState<PlanGroup[]>(() => {
    if (initialData) {
      return groupPlansByPlanNumber(initialData.plans);
    }
    return [];
  });
  const [sessions, setSessions] = useState<Map<string, SessionState>>(() => {
    if (initialData) {
      const sessionEntries = Object.entries(initialData.sessions || {}) as [
        string,
        SessionState,
      ][];
      return new Map(sessionEntries);
    }
    return new Map();
  });
  const [planDate, setPlanDate] = useState<string>(() => {
    if (initialData) {
      return initialData.planDate || "";
    }
    return "";
  });
  const [isToday, setIsToday] = useState(() => {
    if (initialData) {
      return Boolean(initialData.isToday);
    }
    return true;
  });
  const [loading, setLoading] = useState(!initialData);
  const [isNavigating, setIsNavigating] = useState(false);
  const [serverNow, setServerNow] = useState<number>(() => {
    if (initialData?.serverNow) {
      return initialData.serverNow;
    }
    return Date.now();
  });

  const queryDateRef = useRef<string | null>(null);

  // Realtime 구독 설정 (30초 폴링 대체)
  usePlanRealtimeUpdates({
    planDate: planDate || getTodayISODate(),
    userId: userId || "",
    enabled: Boolean(userId && planDate),
  });

  const loadData = useCallback(
    async (date?: string, options?: { silent?: boolean }) => {
      const targetDate = date ?? queryDateRef.current;
      queryDateRef.current = targetDate ?? null;

      if (!options?.silent) {
        setLoading(true);
      }

      try {
        const queryParams = new URLSearchParams();
        if (targetDate) {
          queryParams.set("date", targetDate);
        }
        if (campMode) {
          queryParams.set("camp", "true");
        }
        // Include progress data to avoid separate /api/today/progress call
        queryParams.set("includeProgress", "true");
        const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
        const response = await fetch(`/api/today/plans${query}`, {
          cache: "no-store",
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = "플랜 조회 실패";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
          } catch {
            // JSON 파싱 실패 시 원본 텍스트 사용
            if (errorText) {
              errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
            }
          }
          console.error("[PlanViewContainer] API 에러:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        // API 응답이 { success: true, data: { plans, sessions, ... } } 형식인지 확인
        const data = (responseData.success && responseData.data 
          ? responseData.data 
          : responseData) as PlansResponse;
        const grouped = groupPlansByPlanNumber(data?.plans);

        setGroups(grouped);
        const sessionEntries = Object.entries(data?.sessions || {}) as [
          string,
          SessionState,
        ][];
        setSessions(new Map(sessionEntries));
        const resolvedDate = data?.planDate || targetDate || "";
        setPlanDate(resolvedDate);
        queryDateRef.current = resolvedDate || null;
        const resolvedIsToday = Boolean(data?.isToday);
        setIsToday(resolvedIsToday);
        
        // serverNow 저장
        if (data?.serverNow) {
          setServerNow(data.serverNow);
        }
        
        if (resolvedDate) {
          // Pass todayProgress if available to avoid separate /api/today/progress call
          onDateChange?.(resolvedDate, { 
            isToday: resolvedIsToday,
            todayProgress: data?.todayProgress,
          });
        }
        setSelectedPlanNumber((prev) => {
          if (grouped.length === 0) {
            return null;
          }
          if (prev != null && grouped.some((g) => g.planNumber === prev)) {
            return prev;
          }
          return grouped[0]?.planNumber ?? null;
        });
      } catch (error) {
        console.error("[PlanViewContainer] 데이터 로딩 실패", error);
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
        setIsNavigating(false);
      }
    },
    [onDateChange]
  );

  useEffect(() => {
    // If initialData is provided, use it and skip client-side fetch
    // This avoids double-fetch on pages like /camp/today where data is already fetched on the server
    if (initialData) {
      const grouped = groupPlansByPlanNumber(initialData.plans);
      setGroups(grouped);
      setSessions(new Map(Object.entries(initialData.sessions || {})));
      setPlanDate(initialData.planDate || "");
      setIsToday(Boolean(initialData.isToday));
      setServerNow(initialData.serverNow || Date.now());
      setLoading(false); // Data is already loaded
      queryDateRef.current = initialData.planDate || null;
      if (initialData.planDate) {
        // Pass todayProgress from initialData to avoid separate /api/today/progress call
        onDateChange?.(initialData.planDate, { 
          isToday: Boolean(initialData.isToday),
          todayProgress: initialData.todayProgress,
        });
      }
      setSelectedPlanNumber((prev) => {
        if (grouped.length === 0) return null;
        if (prev != null && grouped.some((g) => g.planNumber === prev)) return prev;
        return grouped[0]?.planNumber ?? null;
      });
      return;
    }

    // Otherwise, fetch data as usual
    if (initialPlanDate) {
      queryDateRef.current = initialPlanDate;
      loadData(initialPlanDate);
    } else {
      loadData();
    }
    // Realtime 구독으로 대체하여 폴링 제거
  }, [initialPlanDate, loadData, initialData, onDateChange]);

  const handleViewDetail = (planNumber: number | null) => {
    setSelectedPlanNumber(planNumber);
    setViewMode("single");
  };

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "single" && !selectedPlanNumber && groups.length > 0) {
      setSelectedPlanNumber(groups[0]?.planNumber ?? null);
    }
  };

  const handleMoveDay = (delta: number) => {
    const baseDate =
      planDate || queryDateRef.current || getTodayISODate();
    const nextDate = shiftIsoDate(baseDate, delta);
    if (!nextDate) return;

    setIsNavigating(true);
    loadData(nextDate);
  };

  const handleResetToToday = () => {
    const today = getTodayISODate();
    setIsNavigating(true);
    loadData(today);
  };

  if (loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PlanDateNavigator
        planDate={planDate}
        isToday={isToday}
        isLoading={loading}
        isNavigating={isNavigating}
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
          onSelectPlan={setSelectedPlanNumber}
          serverNow={serverNow}
          campMode={campMode}
        />
      )}
    </div>
  );
}
