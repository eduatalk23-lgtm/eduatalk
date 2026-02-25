"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { DailyScheduleInfo, CalendarPermission } from "@/lib/types/plan";
import type { TimeSlot } from "@/lib/types/plan-generation";
import type { PlanGroupSummary, CalendarSettingsExclusion } from "./AdminPlanContext";
import type { PrefetchedDockData } from "@/lib/domains/admin-plan/actions";
import type { CalendarSettings } from "@/lib/domains/admin-plan/types";
import {
  getCalendarPermission,
  canEditCalendarSettings,
  isOwnCalendar as checkIsOwnCalendar,
} from "@/lib/domains/admin-plan/utils/calendarPermission";

/** 뷰 모드 타입 */
export type ViewMode = "admin" | "student" | "personal";

/**
 * Basic Context - 거의 변하지 않는 정적 정보
 *
 * 포함: studentId, tenantId, calendar 데이터 등
 * 변경 빈도: 매우 낮음 (페이지 로드 시 1회)
 */
export interface AdminPlanBasicContextValue {
  studentId: string;
  studentName: string;
  tenantId: string;
  /** Calendar-First: 선택된 캘린더 ID (URL에서 직접 전달) */
  selectedCalendarId: string | null;
  activePlanGroupId: string | null;
  allPlanGroups: PlanGroupSummary[];
  calendarDailySchedules?: DailyScheduleInfo[][];
  calendarExclusions?: CalendarSettingsExclusion[];
  calendarCalculatedSchedule?: DailyScheduleInfo[];
  calendarDateTimeSlots?: Record<string, TimeSlot[]>;
  canCreatePlans: boolean;
  toast: ReturnType<typeof useToast>;
  /** SSR 프리페치된 Dock 데이터 */
  initialDockData?: PrefetchedDockData;
  /** SSR 프리페치 시점의 초기 날짜 */
  initialDate: string;
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode: ViewMode;
  /** Admin 모드인지 여부 (편의 getter) */
  isAdminMode: boolean;

  // ============================================
  // 권한 시스템 (Phase 5)
  // ============================================
  /** 현재 사용자 ID */
  currentUserId: string;
  /** 선택된 캘린더 설정 (권한 확인용) */
  selectedCalendarSettings: CalendarSettings | null;
  /** 캘린더 권한 (full | execute_only | view_only) */
  calendarPermission: CalendarPermission;
  /** 본인이 생성한 캘린더인지 */
  isOwnCalendar: boolean;
  /** 설정 수정 가능 여부 (편의 getter) */
  canEditSettings: boolean;
}

const AdminPlanBasicContext = createContext<AdminPlanBasicContextValue | null>(null);

interface AdminPlanBasicProviderProps {
  children: ReactNode;
  studentId: string;
  studentName: string;
  tenantId: string;
  /** Calendar-First: URL에서 직접 전달받은 calendarId */
  calendarId: string | null;
  activePlanGroupId: string | null;
  allPlanGroups: PlanGroupSummary[];
  calendarDailySchedules?: DailyScheduleInfo[][];
  calendarExclusions?: CalendarSettingsExclusion[];
  calendarCalculatedSchedule?: DailyScheduleInfo[];
  calendarDateTimeSlots?: Record<string, TimeSlot[]>;
  initialDockData?: PrefetchedDockData;
  /** SSR 프리페치 시점의 초기 날짜 */
  initialDate: string;
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode?: ViewMode;
  /** 현재 사용자 ID (권한 확인용) */
  currentUserId?: string;
  /** 선택된 캘린더 설정 데이터 (권한 확인용) */
  selectedCalendarSettings?: CalendarSettings | null;
}

export function AdminPlanBasicProvider({
  children,
  studentId,
  studentName,
  tenantId,
  calendarId,
  activePlanGroupId,
  allPlanGroups,
  calendarDailySchedules,
  calendarExclusions,
  calendarCalculatedSchedule,
  calendarDateTimeSlots,
  initialDockData,
  initialDate,
  viewMode = "admin",
  currentUserId,
  selectedCalendarSettings,
}: AdminPlanBasicProviderProps) {
  const toast = useToast();
  const selectedCalendarId = calendarId;
  const canCreatePlans = !!selectedCalendarId;
  const isAdminMode = viewMode !== "student";

  // 권한 시스템 계산
  const calendarPermission = useMemo(
    () => getCalendarPermission(viewMode, selectedCalendarSettings ?? null, currentUserId ?? null),
    [viewMode, selectedCalendarSettings, currentUserId]
  );

  const isOwn = useMemo(
    () => checkIsOwnCalendar(selectedCalendarSettings ?? null, currentUserId ?? null),
    [selectedCalendarSettings, currentUserId]
  );

  const canEdit = useMemo(
    () => canEditCalendarSettings(calendarPermission),
    [calendarPermission]
  );

  const value = useMemo<AdminPlanBasicContextValue>(
    () => ({
      studentId,
      studentName,
      tenantId,
      selectedCalendarId,
      activePlanGroupId,
      allPlanGroups,
      calendarDailySchedules,
      calendarExclusions,
      calendarCalculatedSchedule,
      calendarDateTimeSlots,
      canCreatePlans,
      toast,
      initialDockData,
      initialDate,
      viewMode,
      isAdminMode,
      // 권한 시스템
      currentUserId: currentUserId ?? "",
      selectedCalendarSettings: selectedCalendarSettings ?? null,
      calendarPermission,
      isOwnCalendar: isOwn,
      canEditSettings: canEdit,
    }),
    [
      studentId,
      studentName,
      tenantId,
      selectedCalendarId,
      activePlanGroupId,
      allPlanGroups,
      calendarDailySchedules,
      calendarExclusions,
      calendarCalculatedSchedule,
      calendarDateTimeSlots,
      canCreatePlans,
      toast,
      initialDockData,
      initialDate,
      viewMode,
      isAdminMode,
      currentUserId,
      selectedCalendarSettings,
      calendarPermission,
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
