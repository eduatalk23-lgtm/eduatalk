"use client";

/**
 * AdminPlanContext - 통합 Context Provider
 *
 * 5개의 분리된 Context를 조합하여 제공합니다:
 * 1. BasicContext - 정적 정보 (studentId, tenantId, planner data)
 * 2. FilterContext - 필터 상태 (date, group, contentType)
 * 3. ModalContext - 모달 표시 상태 (22개 모달)
 * 4. ModalDataContext - 모달 데이터 (선택된 플랜 등)
 * 5. ActionsContext - 액션 핸들러 (handleOpenEdit 등)
 *
 * 성능 최적화:
 * - 모달 열기 → ModalContext만 변경 → Dock 컴포넌트 리렌더링 없음
 * - 날짜 변경 → FilterContext만 변경 → 모달 컴포넌트 리렌더링 없음
 *
 * 사용법:
 * - 기존 API: useAdminPlan() - 모든 값 제공 (하위 호환)
 * - 최적화 API: useAdminPlanBasic(), useAdminPlanFilter(), useAdminPlanModal() 등
 */

import { type ReactNode } from "react";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import type { TimeSlot } from "@/lib/types/plan-generation";
import type { PrefetchedDockData, Planner } from "@/lib/domains/admin-plan/actions";

// Split contexts
import {
  AdminPlanBasicProvider,
  useAdminPlanBasic,
  type AdminPlanBasicContextValue,
  type ViewMode,
} from "./AdminPlanBasicContext";
import {
  AdminPlanFilterProvider,
  useAdminPlanFilter,
  type AdminPlanFilterContextValue,
  type ContentTypeFilter,
} from "./AdminPlanFilterContext";
import {
  AdminPlanModalProvider,
  useAdminPlanModal,
  type AdminPlanModalContextValue,
} from "./AdminPlanModalContext";
import {
  AdminPlanModalDataProvider,
  useAdminPlanModalData,
  type AdminPlanModalDataContextValue,
} from "./AdminPlanModalDataContext";
import {
  AdminPlanActionsProvider,
  useAdminPlanActions,
  type AdminPlanActionsContextValue,
} from "./AdminPlanActionsContext";

// Re-export types
export type { ContentTypeFilter, ViewMode };

// 플랜 그룹 요약 정보 타입
export interface PlanGroupSummary {
  id: string;
  name: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  planPurpose: string | null;
}

// 플래너 제외일 타입
export interface PlannerExclusion {
  exclusionDate: string;
  exclusionType: string;
  reason?: string | null;
}

// 기존 통합 Context 값 타입 (하위 호환용)
export type AdminPlanContextValue = AdminPlanBasicContextValue &
  AdminPlanFilterContextValue &
  AdminPlanModalContextValue &
  AdminPlanModalDataContextValue &
  AdminPlanActionsContextValue;

// Provider Props
interface AdminPlanProviderProps {
  children: ReactNode;
  studentId: string;
  studentName: string;
  tenantId: string;
  initialDate: string;
  activePlanGroupId: string | null;
  allPlanGroups?: PlanGroupSummary[];
  selectedPlannerId?: string;
  plannerDailySchedules?: DailyScheduleInfo[][];
  plannerExclusions?: PlannerExclusion[];
  plannerCalculatedSchedule?: DailyScheduleInfo[];
  plannerDateTimeSlots?: Record<string, TimeSlot[]>;
  /** SSR 프리페치된 Dock 데이터 */
  initialDockData?: PrefetchedDockData;
  /** 뷰 모드 (admin: 관리자, student: 학생) */
  viewMode?: ViewMode;
  /** 현재 사용자 ID (권한 확인용) */
  currentUserId?: string;
  /** 선택된 플래너 데이터 (권한 확인용) */
  selectedPlanner?: Planner | null;
}

/**
 * 통합 Provider - 5개의 분리된 Provider를 중첩
 */
export function AdminPlanProvider({
  children,
  studentId,
  studentName,
  tenantId,
  initialDate,
  activePlanGroupId,
  allPlanGroups = [],
  selectedPlannerId,
  plannerDailySchedules,
  plannerExclusions,
  plannerCalculatedSchedule,
  plannerDateTimeSlots,
  initialDockData,
  viewMode = "admin",
  currentUserId,
  selectedPlanner,
}: AdminPlanProviderProps) {
  return (
    <AdminPlanBasicProvider
      studentId={studentId}
      studentName={studentName}
      tenantId={tenantId}
      selectedPlannerId={selectedPlannerId}
      activePlanGroupId={activePlanGroupId}
      allPlanGroups={allPlanGroups}
      plannerDailySchedules={plannerDailySchedules}
      plannerExclusions={plannerExclusions}
      plannerCalculatedSchedule={plannerCalculatedSchedule}
      plannerDateTimeSlots={plannerDateTimeSlots}
      initialDockData={initialDockData}
      initialDate={initialDate}
      viewMode={viewMode}
      currentUserId={currentUserId}
      selectedPlanner={selectedPlanner}
    >
      <AdminPlanFilterProvider
        studentId={studentId}
        selectedPlannerId={selectedPlannerId}
        initialDate={initialDate}
        viewMode={viewMode}
      >
        <AdminPlanModalProvider>
          <AdminPlanModalDataProvider>
            <AdminPlanActionsProvider>
              {children}
            </AdminPlanActionsProvider>
          </AdminPlanModalDataProvider>
        </AdminPlanModalProvider>
      </AdminPlanFilterProvider>
    </AdminPlanBasicProvider>
  );
}

/**
 * 통합 Hook - 모든 Context 값을 하나로 합쳐서 반환 (하위 호환)
 *
 * @deprecated 성능 최적화를 위해 개별 훅 사용을 권장합니다:
 * - useAdminPlanBasic() - 정적 정보만 필요할 때
 * - useAdminPlanFilter() - 필터/날짜 상태만 필요할 때
 * - useAdminPlanModal() - 모달 표시 상태만 필요할 때
 * - useAdminPlanModalData() - 모달 데이터만 필요할 때
 * - useAdminPlanActions() - 액션 핸들러만 필요할 때
 */
export function useAdminPlan(): AdminPlanContextValue {
  const basic = useAdminPlanBasic();
  const filter = useAdminPlanFilter();
  const modal = useAdminPlanModal();
  const modalData = useAdminPlanModalData();
  const actions = useAdminPlanActions();

  return {
    ...basic,
    ...filter,
    ...modal,
    ...modalData,
    ...actions,
  };
}

// Re-export individual hooks for optimized access
export {
  useAdminPlanBasic,
  useAdminPlanFilter,
  useAdminPlanModal,
  useAdminPlanModalData,
  useAdminPlanActions,
};

// Re-export types
export type {
  AdminPlanBasicContextValue,
  AdminPlanFilterContextValue,
  AdminPlanModalContextValue,
  AdminPlanModalDataContextValue,
  AdminPlanActionsContextValue,
};
