"use client";

/**
 * AdminWizardValidationContext - 검증 상태 전용 Context
 *
 * Phase 2 성능 최적화: Context 분리
 * 검증 상태만 구독하는 컴포넌트가 데이터/네비게이션 상태 변경에 영향받지 않도록 분리
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/_context/AdminWizardValidationContext
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AdminWizardValidationContextValue } from "./types";

export const AdminWizardValidationContext = createContext<AdminWizardValidationContextValue | null>(null);

/**
 * useAdminWizardValidation Hook
 *
 * 검증 상태만 필요한 컴포넌트에서 사용합니다.
 * 데이터나 네비게이션 상태 변경에 영향받지 않습니다.
 */
export function useAdminWizardValidation(): AdminWizardValidationContextValue {
  const context = useContext(AdminWizardValidationContext);
  if (!context) {
    throw new Error("useAdminWizardValidation must be used within AdminWizardProvider");
  }
  return context;
}

/**
 * AdminWizardValidationProvider Props
 */
export type AdminWizardValidationProviderProps = {
  children: ReactNode;
  value: AdminWizardValidationContextValue;
};

/**
 * AdminWizardValidationProvider
 *
 * AdminWizardProvider 내부에서 사용되어 검증 상태를 제공합니다.
 */
export function AdminWizardValidationProvider({ children, value }: AdminWizardValidationProviderProps) {
  // 값을 메모이제이션하여 불필요한 리렌더 방지
  const memoizedValue = useMemo(
    () => value,
    [
      value.validationErrors,
      value.validationWarnings,
      value.fieldErrors,
      value.setErrors,
      value.setWarnings,
      value.setFieldError,
      value.setFieldErrors,
      value.clearFieldError,
      value.clearValidation,
      value.hasErrors,
      value.hasWarnings,
    ]
  );

  return (
    <AdminWizardValidationContext.Provider value={memoizedValue}>
      {children}
    </AdminWizardValidationContext.Provider>
  );
}
