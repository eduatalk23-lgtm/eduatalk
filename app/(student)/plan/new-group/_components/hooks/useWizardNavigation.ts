/**
 * useWizardNavigation - 단계 이동 및 URL 동기화 훅
 * 
 * 위저드 단계 이동과 URL 상태 동기화를 담당합니다.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { WizardStep } from "../PlanGroupWizard";
import { canGoBack } from "../utils/modeUtils";

type UseWizardNavigationProps = {
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  draftGroupId: string | null;
  mode: {
    isCampMode: boolean;
    isTemplateMode: boolean;
    isAdminMode: boolean;
    isAdminContinueMode: boolean;
    isEditMode: boolean;
  };
};

type UseWizardNavigationReturn = {
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goPrev: () => void;
  canGoBack: () => boolean;
};

/**
 * useWizardNavigation 훅
 * 
 * 단계 이동 및 URL 동기화 로직을 제공합니다.
 * 
 * @param props 현재 단계 및 설정
 * @returns 단계 이동 함수들
 */
export function useWizardNavigation({
  currentStep,
  setCurrentStep,
  draftGroupId,
  mode,
}: UseWizardNavigationProps): UseWizardNavigationReturn {
  const router = useRouter();

  /**
   * 특정 단계로 이동
   * 
   * @param step 이동할 단계
   */
  const goToStep = useCallback(
    (step: WizardStep) => {
      setCurrentStep(step);
      // URL 동기화 (필요시)
      // 예: router.push(`/plan/new-group?step=${step}`, { scroll: false });
    },
    [setCurrentStep]
  );

  /**
   * 다음 단계로 이동
   */
  const goNext = useCallback(() => {
    if (currentStep < 7) {
      setCurrentStep((currentStep + 1) as WizardStep);
    }
  }, [currentStep, setCurrentStep]);

  /**
   * 이전 단계로 이동
   */
  const goPrev = useCallback(() => {
    if (canGoBack(currentStep, mode)) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  }, [currentStep, setCurrentStep, mode]);

  /**
   * 이전 단계로 이동 가능한지 확인
   * 
   * @returns 이동 가능 여부
   */
  const canGoBackFn = useCallback(() => {
    return canGoBack(currentStep, mode);
  }, [currentStep, mode]);

  return {
    goToStep,
    goNext,
    goPrev,
    canGoBack: canGoBackFn,
  };
}

