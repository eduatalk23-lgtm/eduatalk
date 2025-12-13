
import { useState, useCallback } from "react";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { validateStep as validateStepUtil } from "../utils/validationUtils";

// 필드 ID별 오류 메시지 맵 타입
export type FieldErrors = Map<string, string>;

// Step별 필드 순서 정의 (화면에 표시되는 순서)
const FIELD_ORDER_BY_STEP: Record<WizardStep, string[]> = {
  1: ["plan_name", "plan_purpose", "period_start", "scheduler_type"],
  2: [],
  3: [],
  4: ["content_selection"],
  5: [],
  6: [],
  7: [],
};

/**
 * 첫 번째 오류 필드 ID를 반환 (화면 순서 기준)
 */
export function getFirstErrorFieldId(
  fieldErrors: FieldErrors,
  step: WizardStep
): string | undefined {
  if (fieldErrors.size === 0) return undefined;

  const fieldOrder = FIELD_ORDER_BY_STEP[step];
  if (!fieldOrder || fieldOrder.length === 0) {
    // 필드 순서가 정의되지 않은 경우 Map의 첫 번째 키 반환
    return Array.from(fieldErrors.keys())[0];
  }

  // 화면 순서에 따라 첫 번째 오류 필드 찾기
  for (const fieldId of fieldOrder) {
    if (fieldErrors.has(fieldId)) {
      return fieldId;
    }
  }

  // 순서에 없는 필드인 경우 Map의 첫 번째 키 반환
  return Array.from(fieldErrors.keys())[0];
}

type UseWizardValidationProps = {
  wizardData: WizardData;
  isTemplateMode: boolean;
  isCampMode?: boolean;
};

type UseWizardValidationReturn = {
  validationErrors: string[];
  validationWarnings: string[];
  fieldErrors: FieldErrors;
  setValidationErrors: (errors: string[]) => void;
  setValidationWarnings: (warnings: string[]) => void;
  validateStep: (step: WizardStep) => boolean;
  clearValidationState: () => void;
};

export function useWizardValidation({
  wizardData,
  isTemplateMode,
  isCampMode = false,
}: UseWizardValidationProps): UseWizardValidationReturn {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(new Map());

  const clearValidationState = useCallback(() => {
    setValidationErrors([]);
    setValidationWarnings([]);
    setFieldErrors(new Map());
  }, []);

  const validateStep = useCallback(
    (step: WizardStep): boolean => {
      // 공통 검증 함수 사용
      const result = validateStepUtil(
        wizardData,
        step,
        isTemplateMode,
        isCampMode
      );

      setValidationErrors(result.errors);
      setValidationWarnings(result.warnings);
      setFieldErrors(result.fieldErrors);
      return result.isValid;
    },
    [wizardData, isTemplateMode, isCampMode]
  );

  return {
    validationErrors,
    validationWarnings,
    fieldErrors,
    setValidationErrors,
    setValidationWarnings,
    validateStep,
    clearValidationState,
  };
}
