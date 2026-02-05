"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { DailyScheduleInfo, PlannerPermission } from "@/lib/types/plan";
import type { TimeSlot } from "@/lib/types/plan-generation";
import type { PlanGroupSummary, PlannerExclusion } from "./AdminPlanContext";
import type { PrefetchedDockData, Planner } from "@/lib/domains/admin-plan/actions";
import {
  getPlannerPermission,
  canEditPlannerSettings,
  isOwnPlanner as checkIsOwnPlanner,
} from "@/lib/domains/admin-plan/utils/plannerPermission";

/** 뷰 모드 타입 */
export type ViewMode = "admin" | "student";

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
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode: ViewMode;
  /** Admin 모드인지 여부 (편의 getter) */
  isAdminMode: boolean;

  // ============================================
  // 권한 시스템 (Phase 5)
  // ============================================
  /** 현재 사용자 ID */
  currentUserId: string;
  /** 선택된 플래너 (권한 확인용) */
  selectedPlanner: Planner | null;
  /** 플래너 권한 (full | execute_only | view_only) */
  plannerPermission: PlannerPermission;
  /** 본인이 생성한 플래너인지 */
  isOwnPlanner: boolean;
  /** 설정 수정 가능 여부 (편의 getter) */
  canEditSettings: boolean;
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
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode?: ViewMode;
  /** 현재 사용자 ID (권한 확인용) */
  currentUserId?: string;
  /** 선택된 플래너 데이터 (권한 확인용) */
  selectedPlanner?: Planner | null;
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
  viewMode = "admin",
  currentUserId,
  selectedPlanner,
}: AdminPlanBasicProviderProps) {
  const toast = useToast();
  const canCreatePlans = !!selectedPlannerId;
  const isAdminMode = viewMode === "admin";

  // 권한 시스템 계산
  const plannerPermission = useMemo(
    () => getPlannerPermission(viewMode, selectedPlanner ?? null, currentUserId ?? null),
    [viewMode, selectedPlanner, currentUserId]
  );

  const isOwn = useMemo(
    () => checkIsOwnPlanner(selectedPlanner ?? null, currentUserId ?? null),
    [selectedPlanner, currentUserId]
  );

  const canEdit = useMemo(
    () => canEditPlannerSettings(plannerPermission),
    [plannerPermission]
  );

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
      viewMode,
      isAdminMode,
      // 권한 시스템
      currentUserId: currentUserId ?? "",
      selectedPlanner: selectedPlanner ?? null,
      plannerPermission,
      isOwnPlanner: isOwn,
      canEditSettings: canEdit,
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
      viewMode,
      isAdminMode,
      currentUserId,
      selectedPlanner,
      plannerPermission,
      isOwn,
      canEdit,
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
