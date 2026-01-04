"use client";

/**
 * AdminWizardStepContext - 단계 네비게이션 전용 Context
 *
 * Phase 2 성능 최적화: Context 분리
 * 네비게이션 상태만 구독하는 컴포넌트가 데이터/검증 상태 변경에 영향받지 않도록 분리
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/AdminWizardStepContext
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AdminWizardStepContextValue } from "./types";

export const AdminWizardStepContext = createContext<AdminWizardStepContextValue | null>(null);

/**
 * useAdminWizardStep Hook
 *
 * 네비게이션 상태만 필요한 컴포넌트에서 사용합니다.
 * 데이터나 검증 상태 변경에 영향받지 않습니다.
 */
export function useAdminWizardStep(): AdminWizardStepContextValue {
  const context = useContext(AdminWizardStepContext);
  if (!context) {
    throw new Error("useAdminWizardStep must be used within AdminWizardProvider");
  }
  return context;
}

/**
 * AdminWizardStepProvider Props
 */
export type AdminWizardStepProviderProps = {
  children: ReactNode;
  value: AdminWizardStepContextValue;
};

/**
 * AdminWizardStepProvider
 *
 * AdminWizardProvider 내부에서 사용되어 네비게이션 상태를 제공합니다.
 */
export function AdminWizardStepProvider({ children, value }: AdminWizardStepProviderProps) {
  // 값을 메모이제이션하여 불필요한 리렌더 방지
  const memoizedValue = useMemo(
    () => value,
    [
      value.currentStep,
      value.totalSteps,
      value.nextStep,
      value.prevStep,
      value.setStep,
      value.canGoNext,
      value.canGoPrev,
    ]
  );

  return (
    <AdminWizardStepContext.Provider value={memoizedValue}>
      {children}
    </AdminWizardStepContext.Provider>
  );
}
