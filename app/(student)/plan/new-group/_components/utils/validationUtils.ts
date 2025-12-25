/**
 * 검증 관련 유틸리티 함수
 * 
 * 위저드 데이터 검증 로직을 통합 관리합니다.
 */

import { PlanValidator } from "@/lib/validation/planValidator";
import type { WizardData } from "../PlanGroupWizard";
import { canStudentInput as checkStudentInputAllowed } from "./fieldLockUtils";

/**
 * 기간 검증 결과 타입
 */
export type PeriodValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * 기간 검증 (공통 함수)
 * 
 * @param wizardData 위저드 데이터
 * @param isCampMode 캠프 모드 여부
 * @returns 검증 결과
 */
export function validatePeriod(
  wizardData: WizardData,
  isCampMode: boolean
): PeriodValidationResult {
  // 캠프 모드가 아닐 때만 검증
  if (isCampMode) {
    return { isValid: true };
  }

  // 템플릿 모드에서 학생 입력 허용이 아닐 때만 필수
  const lockedFields = wizardData.templateLockedFields?.step1;
  const canInputPeriod = checkStudentInputAllowed(
    "allow_student_period",
    lockedFields,
    true, // editable은 여기서는 체크하지 않음
    false // isCampMode는 이미 체크했으므로 false
  );

  if (!canInputPeriod) {
    if (!wizardData.period_start || !wizardData.period_end) {
      return {
        isValid: false,
        error: "기간 설정이 필요합니다. Step 1에서 학습 기간을 입력해주세요.",
      };
    }

    // PlanValidator를 사용한 추가 검증
    const periodValidation = PlanValidator.validatePeriod(
      wizardData.period_start,
      wizardData.period_end
    );

    if (periodValidation.errors.length > 0) {
      return {
        isValid: false,
        error: periodValidation.errors[0], // 첫 번째 에러만 반환
      };
    }
  }

  return { isValid: true };
}

/**
 * 필수 필드 검증
 * 
 * @param wizardData 위저드 데이터
 * @param isTemplateMode 템플릿 모드 여부
 * @returns 검증 결과
 */
export type RequiredFieldsValidationResult = {
  isValid: boolean;
  errors: string[];
  fieldErrors: Map<string, string>;
};

export function validateRequiredFields(
  wizardData: WizardData,
  isTemplateMode: boolean
): RequiredFieldsValidationResult {
  const errors: string[] = [];
  const fieldErrors = new Map<string, string>();

  // 템플릿 모드가 아닐 때만 이름 검증
  if (!isTemplateMode) {
    if (!wizardData.name || wizardData.name.trim() === "") {
      const errorMsg = "플랜 이름을 입력해주세요.";
      errors.push(errorMsg);
      fieldErrors.set("plan_name", errorMsg);
    }
  }

  // 플랜 목적 검증
  const lockedFields = wizardData.templateLockedFields?.step1;
  const canInputPlanPurpose = checkStudentInputAllowed(
    "allow_student_plan_purpose",
    lockedFields,
    true,
    false
  );

  if (!canInputPlanPurpose) {
    if (!wizardData.plan_purpose) {
      const errorMsg = "플랜 목적을 선택해주세요.";
      errors.push(errorMsg);
      fieldErrors.set("plan_purpose", errorMsg);
    }
  }

  // 스케줄러 유형 검증
  const canInputSchedulerType = checkStudentInputAllowed(
    "allow_student_scheduler_type",
    lockedFields,
    true,
    false
  );

  if (!canInputSchedulerType) {
    if (!wizardData.scheduler_type) {
      const errorMsg = "스케줄러 유형을 선택해주세요.";
      errors.push(errorMsg);
      fieldErrors.set("scheduler_type", errorMsg);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

/**
 * 콘텐츠 검증
 * 
 * @param wizardData 위저드 데이터
 * @param isTemplateMode 템플릿 모드 여부
 * @returns 검증 결과
 */
export type ContentValidationResult = {
  isValid: boolean;
  error?: string;
  fieldError?: string;
};

export function validateContents(
  wizardData: WizardData,
  isTemplateMode: boolean
): ContentValidationResult {
  // 템플릿 모드에서는 콘텐츠 선택 검증 건너뛰기
  if (isTemplateMode) {
    return { isValid: true };
  }

  const totalContents =
    wizardData.student_contents.length +
    (wizardData.recommended_contents?.length || 0);

  if (totalContents === 0) {
    return {
      isValid: false,
      error: "최소 1개 이상의 콘텐츠를 선택해주세요.",
      fieldError: "content_selection",
    };
  }

  return { isValid: true };
}
