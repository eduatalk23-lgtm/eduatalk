"use client";

/**
 * WizardDataContext - 데이터 상태 전용 Context
 *
 * Phase 2 성능 최적화: Context 분리
 * 데이터 상태만 구독하는 컴포넌트가 네비게이션/검증 상태 변경에 영향받지 않도록 분리
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WizardData } from "../PlanGroupWizard";

/**
 * WizardDataContext 값 타입
 */
export type WizardDataContextValue = {
  /** 현재 위저드 데이터 */
  wizardData: WizardData;
  /** 초기 위저드 데이터 (변경 감지용) */
  initialWizardData: WizardData;
  /** 임시 저장된 그룹 ID */
  draftGroupId: string | null;
  /** 데이터 변경 여부 */
  isDirty: boolean;
  /** 제출 중 여부 */
  isSubmitting: boolean;
  /** 데이터 업데이트 함수 */
  updateData: (updates: Partial<WizardData>) => void;
  /** 함수형 데이터 업데이트 */
  updateDataFn: (fn: (prev: WizardData) => Partial<WizardData>) => void;
  /** 임시 저장 ID 설정 */
  setDraftId: (id: string | null) => void;
  /** 제출 상태 설정 */
  setSubmitting: (isSubmitting: boolean) => void;
  /** Dirty 상태 리셋 */
  resetDirtyState: () => void;
};

export const WizardDataContext = createContext<WizardDataContextValue | null>(null);

/**
 * useWizardData Hook
 *
 * 데이터 상태만 필요한 컴포넌트에서 사용합니다.
 * 네비게이션이나 검증 상태 변경에 영향받지 않습니다.
 */
export function useWizardData(): WizardDataContextValue {
  const context = useContext(WizardDataContext);
  if (!context) {
    throw new Error("useWizardData must be used within PlanWizardProvider");
  }
  return context;
}

/**
 * WizardDataProvider Props
 */
export type WizardDataProviderProps = {
  children: ReactNode;
  value: WizardDataContextValue;
};

/**
 * WizardDataProvider
 *
 * PlanWizardProvider 내부에서 사용되어 데이터 상태를 제공합니다.
 */
export function WizardDataProvider({ children, value }: WizardDataProviderProps) {
  // 값을 메모이제이션하여 불필요한 리렌더 방지
  const memoizedValue = useMemo(
    () => value,
    [
      value.wizardData,
      value.initialWizardData,
      value.draftGroupId,
      value.isDirty,
      value.isSubmitting,
      value.updateData,
      value.updateDataFn,
      value.setDraftId,
      value.setSubmitting,
      value.resetDirtyState,
    ]
  );

  return (
    <WizardDataContext.Provider value={memoizedValue}>
      {children}
    </WizardDataContext.Provider>
  );
}
