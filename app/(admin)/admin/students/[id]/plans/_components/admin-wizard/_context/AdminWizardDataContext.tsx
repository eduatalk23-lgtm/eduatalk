"use client";

/**
 * AdminWizardDataContext - 데이터 상태 전용 Context
 *
 * Phase 2 성능 최적화: Context 분리
 * 데이터 상태만 구독하는 컴포넌트가 네비게이션/검증 상태 변경에 영향받지 않도록 분리
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/AdminWizardDataContext
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AdminWizardDataContextValue } from "./types";

export const AdminWizardDataContext = createContext<AdminWizardDataContextValue | null>(null);

/**
 * useAdminWizardData Hook
 *
 * 데이터 상태만 필요한 컴포넌트에서 사용합니다.
 * 네비게이션이나 검증 상태 변경에 영향받지 않습니다.
 */
export function useAdminWizardData(): AdminWizardDataContextValue {
  const context = useContext(AdminWizardDataContext);
  if (!context) {
    throw new Error("useAdminWizardData must be used within AdminWizardProvider");
  }
  return context;
}

/**
 * AdminWizardDataProvider Props
 */
export type AdminWizardDataProviderProps = {
  children: ReactNode;
  value: AdminWizardDataContextValue;
};

/**
 * AdminWizardDataProvider
 *
 * AdminWizardProvider 내부에서 사용되어 데이터 상태를 제공합니다.
 */
export function AdminWizardDataProvider({ children, value }: AdminWizardDataProviderProps) {
  // 값을 메모이제이션하여 불필요한 리렌더 방지
  const memoizedValue = useMemo(
    () => value,
    [
      value.wizardData,
      value.initialWizardData,
      value.draftGroupId,
      value.createdGroupId,
      value.isDirty,
      value.isSubmitting,
      value.error,
      value.updateData,
      value.updateDataFn,
      value.setDraftId,
      value.setCreatedGroupId,
      value.setSubmitting,
      value.setError,
      value.resetDirtyState,
      value.reset,
    ]
  );

  return (
    <AdminWizardDataContext.Provider value={memoizedValue}>
      {children}
    </AdminWizardDataContext.Provider>
  );
}
