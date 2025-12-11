
import { useState, useCallback } from "react";
import { WizardData, WizardStep } from "../PlanGroupWizard";
import { PlanValidator } from "@/lib/validation/planValidator";

type UseWizardValidationProps = {
  wizardData: WizardData;
  isTemplateMode: boolean;
};

type UseWizardValidationReturn = {
  validationErrors: string[];
  validationWarnings: string[];
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

  const clearValidationState = useCallback(() => {
    setValidationErrors([]);
    setValidationWarnings([]);
  }, []);

  const validateStep = useCallback(
    (step: WizardStep): boolean => {
      const errors: string[] = [];
      const warnings: string[] = [];

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
            errors.push("플랜 이름을 입력해주세요.");
          }
        }

        // 플랜 목적: 학생 입력 허용이 아닐 때만 필수
        if (!isStudentInputAllowed("plan_purpose")) {
          if (!wizardData.plan_purpose) {
            errors.push("플랜 목적을 선택해주세요.");
          }
        }

        // 스케줄러 유형: 학생 입력 허용이 아닐 때만 필수
        if (!isStudentInputAllowed("scheduler_type")) {
          if (!wizardData.scheduler_type) {
            errors.push("스케줄러 유형을 선택해주세요.");
          }
        }

        // 학습 기간: 학생 입력 허용이 아닐 때만 필수
        if (!isStudentInputAllowed("period")) {
          if (!wizardData.period_start || !wizardData.period_end) {
            errors.push("학습 기간을 설정해주세요.");
          } else {
            const periodValidation = PlanValidator.validatePeriod(
              wizardData.period_start,
              wizardData.period_end
            );
            errors.push(...periodValidation.errors);
            warnings.push(...periodValidation.warnings);
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
            errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
          }
        }
      }

      setValidationErrors(errors);
      setValidationWarnings(warnings);
      return errors.length === 0;
    },
    [wizardData, isTemplateMode]
  );

  return {
    validationErrors,
    validationWarnings,
    setValidationErrors,
    setValidationWarnings,
    validateStep,
    clearValidationState,
  };
}
