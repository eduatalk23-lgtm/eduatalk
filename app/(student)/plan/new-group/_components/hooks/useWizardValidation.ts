
import { useState, useCallback } from "react";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { PlanValidator } from "@/lib/validation/planValidator";

// 오류 메시지와 필드 ID 매핑
const VALIDATION_FIELD_MAP: Record<string, string> = {
  "플랜 이름을 입력해주세요.": "plan_name",
  "플랜 목적을 선택해주세요.": "plan_purpose",
  "스케줄러 유형을 선택해주세요.": "scheduler_type",
  "학습 기간을 설정해주세요.": "period_start",
  "최소 1개 이상의 콘텐츠를 선택해주세요.": "content_selection",
};

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
      const errors: string[] = [];
      const warnings: string[] = [];
      const fieldErrorsMap = new Map<string, string>();

      // 템플릿 모드에서 학생 입력 허용 필드 확인 헬퍼
      const isStudentInputAllowed = (fieldName: string): boolean => {
        if (!isTemplateMode) return false;
        const lockedFields = wizardData.templateLockedFields?.step1 || {};
        const allowFieldName = `allow_student_${fieldName}` as keyof typeof lockedFields;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (lockedFields as any)[allowFieldName] === true;
      };

      if (step === 1) {
        // 템플릿 모드가 아닐 때만 이름 검증 (템플릿 모드에서는 항상 필요)
        if (!isTemplateMode) {
          if (!wizardData.name || wizardData.name.trim() === "") {
            const errorMsg = "플랜 이름을 입력해주세요.";
            errors.push(errorMsg);
            fieldErrorsMap.set("plan_name", errorMsg);
          }
        }

        // 플랜 목적: 학생 입력 허용이 아닐 때만 필수
        if (!isStudentInputAllowed("plan_purpose")) {
          if (!wizardData.plan_purpose) {
            const errorMsg = "플랜 목적을 선택해주세요.";
            errors.push(errorMsg);
            fieldErrorsMap.set("plan_purpose", errorMsg);
          }
        }

        // 스케줄러 유형: 학생 입력 허용이 아닐 때만 필수
        if (!isStudentInputAllowed("scheduler_type")) {
          if (!wizardData.scheduler_type) {
            const errorMsg = "스케줄러 유형을 선택해주세요.";
            errors.push(errorMsg);
            fieldErrorsMap.set("scheduler_type", errorMsg);
          }
        }

        // 학습 기간: 학생 입력 허용이 아닐 때만 필수
        if (!isStudentInputAllowed("period")) {
          if (!wizardData.period_start || !wizardData.period_end) {
            const errorMsg = "학습 기간을 설정해주세요.";
            errors.push(errorMsg);
            fieldErrorsMap.set("period_start", errorMsg);
          } else {
            const periodValidation = PlanValidator.validatePeriod(
              wizardData.period_start,
              wizardData.period_end
            );
            errors.push(...periodValidation.errors);
            warnings.push(...periodValidation.warnings);
            // 기간 검증 오류는 필드 ID 없이 추가 (복잡한 검증)
          }
        }
      }

      if (step === 2) {
        // 제외일과 학원 일정은 선택사항이므로 검증 불필요
      }

      if (step === 3) {
        // Step 3: 스케줄 미리보기 단계
        // 스케줄 미리보기는 확인만 하는 단계이므로 검증 불필요
      }

      if (step === 4) {
        // Step 4: 콘텐츠 선택 단계
        // 템플릿 모드에서는 콘텐츠 선택 검증 건너뛰기 (필수 교과 설정만 진행)
        if (!isTemplateMode) {
          // 최소 1개 이상의 콘텐츠 필요
          const totalContents =
            wizardData.student_contents.length +
            (wizardData.recommended_contents?.length || 0); // null safety
          if (totalContents === 0) {
            const errorMsg = "최소 1개 이상의 콘텐츠를 선택해주세요.";
            errors.push(errorMsg);
            fieldErrorsMap.set("content_selection", errorMsg);
          }
        }
      }

      setValidationErrors(errors);
      setValidationWarnings(warnings);
      setFieldErrors(fieldErrorsMap);
      return errors.length === 0;
    },
    [wizardData, isTemplateMode]
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
