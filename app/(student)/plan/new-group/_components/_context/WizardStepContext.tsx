"use client";

/**
 * WizardStepContext - 단계 네비게이션 전용 Context
 *
 * Phase 2 성능 최적화: Context 분리
 * 네비게이션 상태만 구독하는 컴포넌트가 데이터/검증 상태 변경에 영향받지 않도록 분리
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WizardStep } from "../PlanGroupWizard";

/**
 * WizardStepContext 값 타입
 */
export type WizardStepContextValue = {
  /** 현재 단계 */
  currentStep: WizardStep;
  /** 다음 단계로 이동 */
  nextStep: () => void;
  /** 이전 단계로 이동 */
  prevStep: () => void;
  /** 특정 단계로 이동 */
  setStep: (step: WizardStep) => void;
};

export const WizardStepContext = createContext<WizardStepContextValue | null>(null);

/**
 * useWizardStep Hook
 *
 * 네비게이션 상태만 필요한 컴포넌트에서 사용합니다.
 * 데이터나 검증 상태 변경에 영향받지 않습니다.
 */
export function useWizardStep(): WizardStepContextValue {
  const context = useContext(WizardStepContext);
  if (!context) {
    throw new Error("useWizardStep must be used within PlanWizardProvider");
  }
  return context;
}

/**
 * WizardStepProvider Props
 */
export type WizardStepProviderProps = {
  children: ReactNode;
  value: WizardStepContextValue;
};

/**
 * WizardStepProvider
 *
 * PlanWizardProvider 내부에서 사용되어 네비게이션 상태를 제공합니다.
 */
export function WizardStepProvider({ children, value }: WizardStepProviderProps) {
  // 값을 메모이제이션하여 불필요한 리렌더 방지
  const memoizedValue = useMemo(
    () => value,
    [value.currentStep, value.nextStep, value.prevStep, value.setStep]
  );

  return (
    <WizardStepContext.Provider value={memoizedValue}>
      {children}
    </WizardStepContext.Provider>
  );
}
