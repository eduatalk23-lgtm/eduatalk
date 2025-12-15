/**
 * usePlanValidator - Step별 유효성 검사 훅
 * 
 * 각 Step별 유효성 검사를 담당합니다.
 * 향후 Zod Schema를 활용한 검증으로 확장 가능하도록 구조화되어 있습니다.
 */

import { useCallback } from "react";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { validateStep as validateStepUtil } from "../utils/validationUtils";
import { validatePeriod } from "../utils/validationUtils";

type UsePlanValidatorProps = {
  wizardData: WizardData;
  currentStep: WizardStep;
  isTemplateMode: boolean;
  isCampMode?: boolean;
};

type UsePlanValidatorReturn = {
  validateStep: (step: WizardStep) => boolean;
  validatePeriod: () => { isValid: boolean; error?: string };
  validateCurrentStep: () => boolean;
};

/**
 * usePlanValidator 훅
 * 
 * Step별 유효성 검사를 제공합니다.
 * 
 * @param props 위저드 데이터 및 설정
 * @returns 검증 함수들
 */
export function usePlanValidator({
  wizardData,
  currentStep,
  isTemplateMode,
  isCampMode = false,
}: UsePlanValidatorProps): UsePlanValidatorReturn {
  /**
   * 특정 Step 검증
   * 
   * @param step 검증할 Step
   * @returns 검증 통과 여부
   */
  const validateStep = useCallback(
    (step: WizardStep): boolean => {
      const result = validateStepUtil(
        wizardData,
        step,
        isTemplateMode,
        isCampMode
      );
      return result.isValid;
    },
    [wizardData, isTemplateMode, isCampMode]
  );

  /**
   * 기간 검증
   * 
   * @returns 검증 결과
   */
  const validatePeriodFn = useCallback(() => {
    return validatePeriod(wizardData, isCampMode);
  }, [wizardData, isCampMode]);

  /**
   * 현재 Step 검증
   * 
   * @returns 검증 통과 여부
   */
  const validateCurrentStep = useCallback(() => {
    return validateStep(currentStep);
  }, [validateStep, currentStep]);

  return {
    validateStep,
    validatePeriod: validatePeriodFn,
    validateCurrentStep,
  };
}

