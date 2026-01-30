"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAdminPlanRealtime } from "@/lib/realtime";
import { useTargetedDockInvalidation } from "@/lib/hooks/useAdminDockQueries";

/**
 * Filter Context - 필터/선택 상태
 *
 * 포함: selectedDate, selectedGroupId, contentTypeFilter
 * 변경 빈도: 중간 (사용자 필터 조작 시)
 *
 * 성능 최적화:
 * - handleRefresh: 모든 Dock 무효화 (전체 새로고침)
 * - refreshDaily: Daily Dock만 무효화
 * - refreshDailyAndWeekly: Daily + Weekly 무효화 (플랜 이동 시)
 */
export type ContentTypeFilter = "all" | "book" | "lecture" | "custom";

export interface AdminPlanFilterContextValue {
  selectedDate: string;
  handleDateChange: (date: string) => void;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  contentTypeFilter: ContentTypeFilter;
  setContentTypeFilter: (filter: ContentTypeFilter) => void;
  /** 모든 Dock 새로고침 (전체) */
  handleRefresh: () => void;
  /** Daily Dock만 새로고침 */
  refreshDaily: () => void;
  /** Daily + Weekly 새로고침 (플랜 이동 시) */
  refreshDailyAndWeekly: () => void;
  /** Daily + Unfinished 새로고침 (플랜 완료/취소 시) */
  refreshDailyAndUnfinished: () => void;
  isPending: boolean;
}

const AdminPlanFilterContext = createContext<AdminPlanFilterContextValue | null>(null);

interface AdminPlanFilterProviderProps {
  children: ReactNode;
  studentId: string;
  selectedPlannerId?: string;
  initialDate: string;
}

export function AdminPlanFilterProvider({
  children,
  studentId,
  selectedPlannerId,
  initialDate,
}: AdminPlanFilterProviderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 상태 관리
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  // 기본값: 전체 보기 (null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // React Query 타겟 캐시 무효화
  const {
    invalidateDaily,
    invalidateWeekly,
    invalidateUnfinished,
    invalidateDailyAndWeekly,
    invalidateDailyAndUnfinished,
    invalidateAll,
  } = useTargetedDockInvalidation();

  // 날짜 변경 핸들러
  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      startTransition(() => {
        const basePath = selectedPlannerId
          ? `/admin/students/${studentId}/plans/${selectedPlannerId}`
          : `/admin/students/${studentId}/plans`;
        router.push(`${basePath}?date=${date}`);
      });
    },
    [router, studentId, selectedPlannerId]
  );

  // 전체 새로고침 핸들러 (모든 Dock)
  const handleRefresh = useCallback(() => {
    invalidateAll();
    startTransition(() => {
      router.refresh();
    });
  }, [router, invalidateAll]);

  // Daily Dock만 새로고침
  const refreshDaily = useCallback(() => {
    invalidateDaily(studentId, selectedDate, selectedPlannerId);
  }, [invalidateDaily, studentId, selectedDate, selectedPlannerId]);

  // Daily + Weekly 새로고침 (플랜 이동 시)
  const refreshDailyAndWeekly = useCallback(() => {
    invalidateDailyAndWeekly(studentId, selectedDate, selectedPlannerId);
  }, [invalidateDailyAndWeekly, studentId, selectedDate, selectedPlannerId]);

  // Daily + Unfinished 새로고침 (플랜 완료/취소 시)
  const refreshDailyAndUnfinished = useCallback(() => {
    invalidateDailyAndUnfinished(studentId, selectedDate, selectedPlannerId);
  }, [invalidateDailyAndUnfinished, studentId, selectedDate, selectedPlannerId]);

  // 실시간 업데이트 구독 (전체 새로고침)
  useAdminPlanRealtime({
    studentId,
    onRefresh: handleRefresh,
    debounceMs: 1000,
  });

  const value = useMemo<AdminPlanFilterContextValue>(
    () => ({
      selectedDate,
      handleDateChange,
      selectedGroupId,
      setSelectedGroupId,
      contentTypeFilter,
      setContentTypeFilter,
      handleRefresh,
      refreshDaily,
      refreshDailyAndWeekly,
      refreshDailyAndUnfinished,
      isPending,
    }),
    [
      selectedDate,
      handleDateChange,
      selectedGroupId,
      contentTypeFilter,
      handleRefresh,
      refreshDaily,
      refreshDailyAndWeekly,
      refreshDailyAndUnfinished,
      isPending,
    ]
  );

  return (
    <AdminPlanFilterContext.Provider value={value}>
      {children}
    </AdminPlanFilterContext.Provider>
  );
}

export function useAdminPlanFilter() {
  const context = useContext(AdminPlanFilterContext);
  if (!context) {
    throw new Error("useAdminPlanFilter must be used within AdminPlanFilterProvider");
  }
  return context;
}
