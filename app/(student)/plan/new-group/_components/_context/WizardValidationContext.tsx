"use client";

/**
 * WizardValidationContext - 검증 상태 전용 Context
 *
 * Phase 2 성능 최적화: Context 분리
 * 검증 상태만 구독하는 컴포넌트가 데이터/네비게이션 상태 변경에 영향받지 않도록 분리
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * WizardValidationContext 값 타입
 */
export type WizardValidationContextValue = {
  /** 전역 검증 에러 목록 */
  validationErrors: string[];
  /** 전역 검증 경고 목록 */
  validationWarnings: string[];
  /** 필드별 에러 맵 */
  fieldErrors: Map<string, string>;
  /** 전역 에러 설정 */
  setErrors: (errors: string[]) => void;
  /** 전역 경고 설정 */
  setWarnings: (warnings: string[]) => void;
  /** 단일 필드 에러 설정 */
  setFieldError: (field: string, error: string) => void;
  /** 여러 필드 에러 설정 */
  setFieldErrors: (errors: Map<string, string>) => void;
  /** 단일 필드 에러 삭제 */
  clearFieldError: (field: string) => void;
  /** 모든 검증 상태 초기화 */
  clearValidation: () => void;
  /** 첫 번째 에러 필드로 스크롤 */
  scrollToFirstError: () => void;
  /** 첫 번째 에러 필드 반환 */
  getFirstErrorField: () => string | null;
  /** 에러 존재 여부 (빠른 체크용) */
  hasErrors: boolean;
  /** 경고 존재 여부 (빠른 체크용) */
  hasWarnings: boolean;
};

export const WizardValidationContext = createContext<WizardValidationContextValue | null>(null);

/**
 * useWizardValidation Hook
 *
 * 검증 상태만 필요한 컴포넌트에서 사용합니다.
 * 데이터나 네비게이션 상태 변경에 영향받지 않습니다.
 */
export function useWizardValidation(): WizardValidationContextValue {
  const context = useContext(WizardValidationContext);
  if (!context) {
    throw new Error("useWizardValidation must be used within PlanWizardProvider");
  }
  return context;
}

/**
 * WizardValidationProvider Props
 */
export type WizardValidationProviderProps = {
  children: ReactNode;
  value: WizardValidationContextValue;
};

/**
 * WizardValidationProvider
 *
 * PlanWizardProvider 내부에서 사용되어 검증 상태를 제공합니다.
 */
export function WizardValidationProvider({ children, value }: WizardValidationProviderProps) {
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
      value.scrollToFirstError,
      value.getFirstErrorField,
      value.hasErrors,
      value.hasWarnings,
    ]
  );

  return (
    <WizardValidationContext.Provider value={memoizedValue}>
      {children}
    </WizardValidationContext.Provider>
  );
}
