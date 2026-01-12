"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// 탭 키 타입
export type PlanTabKey = "planner" | "calendar" | "analytics" | "history";

// 캘린더 뷰 모드 타입
export type CalendarViewMode = "month" | "gantt";

// 탭 정보 타입
export interface PlanTab {
  key: PlanTabKey;
  label: string;
  icon: string;
}

// 탭 목록 정의
export const PLAN_TABS: PlanTab[] = [
  { key: "planner", label: "플래너", icon: "📋" },
  { key: "calendar", label: "캘린더", icon: "📅" },
  { key: "analytics", label: "분석", icon: "📊" },
  { key: "history", label: "히스토리", icon: "📜" },
];

// 기본값
const DEFAULT_TAB: PlanTabKey = "planner";
const DEFAULT_CALENDAR_VIEW: CalendarViewMode = "month";

/**
 * URL 쿼리 파라미터 기반 탭 상태 관리 훅
 *
 * URL 구조:
 * - ?tab=planner&date=2026-01-12
 * - ?tab=calendar&view=month&date=2026-01-12
 * - ?tab=analytics
 * - ?tab=history
 */
export function usePlanTabState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 현재 탭 읽기
  const activeTab: PlanTabKey =
    (searchParams.get("tab") as PlanTabKey) || DEFAULT_TAB;

  // 캘린더 뷰 모드 읽기
  const calendarView: CalendarViewMode =
    (searchParams.get("view") as CalendarViewMode) || DEFAULT_CALENDAR_VIEW;

  // 현재 날짜 읽기
  const selectedDate = searchParams.get("date") || "";

  // URL 쿼리 파라미터 업데이트 헬퍼
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // 탭 변경 핸들러
  const handleTabChange = useCallback(
    (tab: PlanTabKey) => {
      // 캘린더 탭이 아닌 경우 view 파라미터 제거
      if (tab === "calendar") {
        updateSearchParams({ tab, view: calendarView });
      } else {
        updateSearchParams({ tab, view: null });
      }
    },
    [updateSearchParams, calendarView]
  );

  // 캘린더 뷰 모드 변경 핸들러
  const handleCalendarViewChange = useCallback(
    (view: CalendarViewMode) => {
      updateSearchParams({ view });
    },
    [updateSearchParams]
  );

  // 날짜 변경 핸들러 (Context의 handleDateChange와 별도로 URL만 변경)
  const handleDateChangeInUrl = useCallback(
    (date: string) => {
      updateSearchParams({ date });
    },
    [updateSearchParams]
  );

  return {
    // 현재 상태
    activeTab,
    calendarView,
    selectedDate,

    // 핸들러
    handleTabChange,
    handleCalendarViewChange,
    handleDateChangeInUrl,

    // 유틸리티
    isTabActive: (tab: PlanTabKey) => activeTab === tab,
    tabs: PLAN_TABS,
  };
}
