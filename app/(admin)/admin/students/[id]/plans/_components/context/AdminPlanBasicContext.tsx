"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import type { TimeSlot } from "@/lib/types/plan-generation";
import type { PlanGroupSummary, PlannerExclusion } from "./AdminPlanContext";
import type { PrefetchedDockData } from "@/lib/domains/admin-plan/actions";

/**
 * Basic Context - 거의 변하지 않는 정적 정보
 *
 * 포함: studentId, tenantId, planner 데이터 등
 * 변경 빈도: 매우 낮음 (페이지 로드 시 1회)
 */
export interface AdminPlanBasicContextValue {
  studentId: string;
  studentName: string;
  tenantId: string;
  selectedPlannerId?: string;
  activePlanGroupId: string | null;
  allPlanGroups: PlanGroupSummary[];
  plannerDailySchedules?: DailyScheduleInfo[][];
  plannerExclusions?: PlannerExclusion[];
  plannerCalculatedSchedule?: DailyScheduleInfo[];
  plannerDateTimeSlots?: Record<string, TimeSlot[]>;
  canCreatePlans: boolean;
  toast: ReturnType<typeof useToast>;
  /** SSR 프리페치된 Dock 데이터 */
  initialDockData?: PrefetchedDockData;
}

const AdminPlanBasicContext = createContext<AdminPlanBasicContextValue | null>(null);

interface AdminPlanBasicProviderProps {
  children: ReactNode;
  studentId: string;
  studentName: string;
  tenantId: string;
  selectedPlannerId?: string;
  activePlanGroupId: string | null;
  allPlanGroups: PlanGroupSummary[];
  plannerDailySchedules?: DailyScheduleInfo[][];
  plannerExclusions?: PlannerExclusion[];
  plannerCalculatedSchedule?: DailyScheduleInfo[];
  plannerDateTimeSlots?: Record<string, TimeSlot[]>;
  initialDockData?: PrefetchedDockData;
}

export function AdminPlanBasicProvider({
  children,
  studentId,
  studentName,
  tenantId,
  selectedPlannerId,
  activePlanGroupId,
  allPlanGroups,
  plannerDailySchedules,
  plannerExclusions,
  plannerCalculatedSchedule,
  plannerDateTimeSlots,
  initialDockData,
}: AdminPlanBasicProviderProps) {
  const toast = useToast();
  const canCreatePlans = !!selectedPlannerId;

  const value = useMemo<AdminPlanBasicContextValue>(
    () => ({
      studentId,
      studentName,
      tenantId,
      selectedPlannerId,
      activePlanGroupId,
      allPlanGroups,
      plannerDailySchedules,
      plannerExclusions,
      plannerCalculatedSchedule,
      plannerDateTimeSlots,
      canCreatePlans,
      toast,
      initialDockData,
    }),
    [
      studentId,
      studentName,
      tenantId,
      selectedPlannerId,
      activePlanGroupId,
      allPlanGroups,
      plannerDailySchedules,
      plannerExclusions,
      plannerCalculatedSchedule,
      plannerDateTimeSlots,
      canCreatePlans,
      toast,
      initialDockData,
    ]
  );

  return (
    <AdminPlanBasicContext.Provider value={value}>
      {children}
    </AdminPlanBasicContext.Provider>
  );
}

export function useAdminPlanBasic() {
  const context = useContext(AdminPlanBasicContext);
  if (!context) {
    throw new Error("useAdminPlanBasic must be used within AdminPlanBasicProvider");
  }
  return context;
}
