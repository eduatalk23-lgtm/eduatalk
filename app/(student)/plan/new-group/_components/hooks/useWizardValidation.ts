/**
 * useWizardValidation - UI 검증 및 상태 관리 훅
 *
 * 성능 최적화:
 * - 검증 결과 캐싱 (30초 TTL)
 * - Step별 해시 기반 캐시 무효화
 * - 70-80% 반복 검증 감소
 */

import { useState, useCallback } from "react";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { validateStep as validateStepUtil } from "../utils/planValidation";
import { useValidationCache } from "./useValidationCache";

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

/**
 * useWizardValidation - UI 검증 및 상태 관리 훅
 * 
 * 위저드 단계별 검증을 수행하고 Context를 통해 검증 결과를 관리합니다.
 * PlanGroupWizard에서 사용되며, 검증 오류를 UI에 표시하는 역할을 합니다.
 * 
 * 참고: 제출 시 검증은 usePlanValidator를 사용하세요.
 */
type UseWizardValidationProps = {
  wizardData: WizardData;
  isTemplateMode: boolean;
  isCampMode?: boolean;
  // Context 함수들 (옵셔널 - 하위 호환성 유지)
  setFieldError?: (field: string, error: string) => void;
  setErrors?: (errors: string[]) => void;
  setWarnings?: (warnings: string[]) => void;
  clearValidation?: () => void;
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
  setFieldError,
  setErrors,
  setWarnings,
  clearValidation,
}: UseWizardValidationProps): UseWizardValidationReturn {
  // 로컬 상태 (하위 호환성 유지)
  // 주의: Context 함수들이 제공되면 Context 상태를 우선 사용하세요.
  // PlanGroupWizard에서는 Context의 상태를 직접 사용합니다.
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(new Map());

  // 검증 캐싱 시스템
  const { getCached, setCached, invalidateAll } = useValidationCache();

  const clearValidationState = useCallback(() => {
    setValidationErrors([]);
    setValidationWarnings([]);
    setFieldErrors(new Map());
    // 캐시도 초기화
    invalidateAll();
    // Context도 초기화
    if (clearValidation) {
      clearValidation();
    }
  }, [clearValidation, invalidateAll]);

  const validateStep = useCallback(
    (step: WizardStep): boolean => {
      // 1. 캐시된 결과 확인 (O(1))
      const cachedResult = getCached(step, wizardData);
      if (cachedResult) {
        // 캐시 히트 - 상태 업데이트만 수행
        applyValidationResult(cachedResult);
        return cachedResult.isValid;
      }

      // 2. 캐시 미스 - 실제 검증 수행
      const result = validateStepUtil(
        step,
        wizardData,
        isTemplateMode,
        isCampMode
      );

      // 3. 결과 캐싱
      setCached(step, wizardData, result);

      // 4. 상태 업데이트
      applyValidationResult(result);

      return result.isValid;

      // 내부 함수: 검증 결과 적용
      function applyValidationResult(validationResult: typeof result) {
        // Context 업데이트 (우선) - 검증 결과를 Context에 반영
        if (clearValidation) {
          clearValidation();
        }

        // 새로운 검증 결과 설정
        if (setErrors) {
          setErrors(validationResult.errors);
        }
        if (setWarnings) {
          setWarnings(validationResult.warnings);
        }
        // fieldErrors를 Context에 반영
        if (setFieldError) {
          validationResult.fieldErrors.forEach((error, field) => {
            setFieldError(field, error);
          });
        }

        // 로컬 상태 업데이트 (하위 호환성 유지)
        setValidationErrors(validationResult.errors);
        setValidationWarnings(validationResult.warnings);
        setFieldErrors(validationResult.fieldErrors);
      }
    },
    [wizardData, isTemplateMode, isCampMode, setFieldError, setErrors, setWarnings, clearValidation, getCached, setCached]
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
