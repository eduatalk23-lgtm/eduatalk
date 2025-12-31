/**
 * planValidation.ts - 위저드 단계별 유효성 검사 로직 중앙화
 *
 * Zod 스키마를 활용하여 타입 안전성과 유효성 검사를 동시에 관리합니다.
 * 각 Step별 검증 함수를 순수 함수로 제공하여 재사용성을 높입니다.
 */

import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
  validatePartialWizardDataSafe,
} from "@/lib/schemas/planWizardSchema";
import { WizardValidator } from "@/lib/validation/wizardValidator";
import type { WizardData } from "@/lib/schemas/planWizardSchema";
import type { WizardStep } from "../PlanGroupWizard";
import { z } from "zod";
import {
  STEP1_MESSAGES,
  STEP4_MESSAGES,
  translateZodError,
} from "@/lib/validation/wizardErrorMessages";

/**
 * 검증 결과 타입
 */
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fieldErrors: Map<string, string>;
};

/**
 * Step별 Zod 스키마 매핑
 */
const STEP_SCHEMAS: Record<WizardStep, z.ZodTypeAny> = {
  1: step1Schema,
  2: step2Schema,
  3: step3Schema,
  4: step4Schema,
  5: step5Schema,
  6: step6Schema,
  7: step7Schema,
};

/**
 * Step 1: 기본 정보 검증
 * 
 * @param wizardData 위저드 데이터
 * @param isTemplateMode 템플릿 모드 여부
 * @param isCampMode 캠프 모드 여부
 * @returns 검증 결과
 */
export function validateStep1(
  wizardData: WizardData,
  isTemplateMode: boolean,
  isCampMode: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors = new Map<string, string>();

  // Zod 스키마로 기본 검증
  const zodValidation = validatePartialWizardDataSafe(wizardData);
  if (!zodValidation.success) {
    zodValidation.error.errors.forEach((err) => {
      const path = err.path.join(".");
      // Step 1 관련 필드만 처리
      const step1Fields = ["name", "plan_purpose", "scheduler_type", "period_start", "period_end", "block_set_id"];
      if (step1Fields.some((field) => path.startsWith(field))) {
        const fieldName = path === "name" ? "plan_name" : path;
        const friendlyMessage = translateZodError(path, err.message);
        errors.push(friendlyMessage);
        fieldErrors.set(fieldName, friendlyMessage);
      }
    });
  }

  // WizardValidator로 비즈니스 로직 검증
  const wizardValidation = WizardValidator.validateStep(1, wizardData);
  if (!wizardValidation.valid) {
    errors.push(...wizardValidation.errors);
    warnings.push(...wizardValidation.warnings);
  }

  // 템플릿 모드가 아닐 때만 이름 검증
  if (!isTemplateMode) {
    if (!wizardData.name || wizardData.name.trim() === "") {
      errors.push(STEP1_MESSAGES.NAME_REQUIRED);
      fieldErrors.set("plan_name", STEP1_MESSAGES.NAME_REQUIRED);
    }
  }

  // 캠프 모드가 아닐 때만 기간 검증
  if (!isCampMode) {
    if (!wizardData.period_start || !wizardData.period_end) {
      errors.push(STEP1_MESSAGES.PERIOD_REQUIRED);
      fieldErrors.set("period_start", STEP1_MESSAGES.PERIOD_REQUIRED);
    } else {
      // 날짜 순서 검증
      const start = new Date(wizardData.period_start);
      const end = new Date(wizardData.period_end);
      if (start > end) {
        errors.push(STEP1_MESSAGES.PERIOD_INVALID);
        fieldErrors.set("period_end", STEP1_MESSAGES.PERIOD_INVALID);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)], // 중복 제거
    warnings: [...new Set(warnings)],
    fieldErrors,
  };
}

/**
 * Step 2: 시간 설정 검증
 * 
 * @param wizardData 위저드 데이터
 * @param isTemplateMode 템플릿 모드 여부
 * @returns 검증 결과
 */
export function validateStep2(
  wizardData: WizardData,
  isTemplateMode: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors = new Map<string, string>();

  // Zod 스키마로 기본 검증
  const zodValidation = validatePartialWizardDataSafe(wizardData);
  if (!zodValidation.success) {
    zodValidation.error.errors.forEach((err) => {
      const path = err.path.join(".");
      // Step 2 관련 필드만 처리
      const step2Fields = ["exclusions", "academy_schedules", "time_settings"];
      if (step2Fields.some((field) => path.startsWith(field))) {
        const friendlyMessage = translateZodError(path, err.message);
        errors.push(friendlyMessage);
        fieldErrors.set(path, friendlyMessage);
      }
    });
  }

  // WizardValidator로 비즈니스 로직 검증
  const wizardValidation = WizardValidator.validateStep(2, wizardData);
  if (!wizardValidation.valid) {
    errors.push(...wizardValidation.errors);
    warnings.push(...wizardValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    fieldErrors,
  };
}

/**
 * Step 3: 스케줄 미리보기 검증
 * 
 * @param wizardData 위저드 데이터
 * @returns 검증 결과
 */
export function validateStep3(wizardData: WizardData): ValidationResult {
  // Step 3는 읽기 전용 단계이므로 검증 없음
  return {
    isValid: true,
    errors: [],
    warnings: [],
    fieldErrors: new Map(),
  };
}

/**
 * Step 4: 콘텐츠 선택 검증
 * 
 * @param wizardData 위저드 데이터
 * @param isTemplateMode 템플릿 모드 여부
 * @returns 검증 결과
 */
export function validateStep4(
  wizardData: WizardData,
  isTemplateMode: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors = new Map<string, string>();

  // 템플릿 모드에서는 콘텐츠 선택 검증 건너뛰기
  if (isTemplateMode) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      fieldErrors: new Map(),
    };
  }

  // Zod 스키마로 기본 검증
  const zodValidation = validatePartialWizardDataSafe(wizardData);
  if (!zodValidation.success) {
    zodValidation.error.errors.forEach((err) => {
      const path = err.path.join(".");
      // Step 4 관련 필드만 처리
      const step4Fields = ["student_contents", "recommended_contents"];
      if (step4Fields.some((field) => path.startsWith(field))) {
        const friendlyMessage = translateZodError(path, err.message);
        errors.push(friendlyMessage);
        fieldErrors.set(path, friendlyMessage);
      }
    });
  }

  // WizardValidator로 비즈니스 로직 검증
  const wizardValidation = WizardValidator.validateStep(4, wizardData);
  if (!wizardValidation.valid) {
    errors.push(...wizardValidation.errors);
    warnings.push(...wizardValidation.warnings);
  }

  // 최소 1개 이상의 콘텐츠 필요
  const totalContents =
    wizardData.student_contents.length +
    (wizardData.recommended_contents?.length || 0);

  if (totalContents === 0) {
    errors.push(STEP4_MESSAGES.CONTENT_REQUIRED);
    fieldErrors.set("content_selection", STEP4_MESSAGES.CONTENT_REQUIRED);
  }

  // 최대 9개 제한
  if (totalContents > 9) {
    errors.push(STEP4_MESSAGES.CONTENT_LIMIT_EXCEEDED);
    fieldErrors.set("content_selection", STEP4_MESSAGES.CONTENT_LIMIT_EXCEEDED);
  }

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    fieldErrors,
  };
}

/**
 * Step 5: 학습범위 점검 검증
 * 
 * @param wizardData 위저드 데이터
 * @returns 검증 결과
 */
export function validateStep5(wizardData: WizardData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors = new Map<string, string>();

  // WizardValidator로 비즈니스 로직 검증
  const wizardValidation = WizardValidator.validateStep(5, wizardData);
  if (!wizardValidation.valid) {
    errors.push(...wizardValidation.errors);
    warnings.push(...wizardValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    fieldErrors,
  };
}

/**
 * Step 6: 최종 확인 검증
 * 
 * @param wizardData 위저드 데이터
 * @returns 검증 결과
 */
export function validateStep6(wizardData: WizardData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors = new Map<string, string>();

  // WizardValidator로 비즈니스 로직 검증
  const wizardValidation = WizardValidator.validateStep(6, wizardData);
  if (!wizardValidation.valid) {
    errors.push(...wizardValidation.errors);
    warnings.push(...wizardValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    fieldErrors,
  };
}

/**
 * Step 7: 스케줄 결과 검증
 * 
 * @param wizardData 위저드 데이터
 * @returns 검증 결과
 */
export function validateStep7(wizardData: WizardData): ValidationResult {
  // Step 7는 결과 표시 단계이므로 검증 없음
  return {
    isValid: true,
    errors: [],
    warnings: [],
    fieldErrors: new Map(),
  };
}

/**
 * 통합 Step 검증 함수
 * 
 * @param step 검증할 단계
 * @param wizardData 위저드 데이터
 * @param isTemplateMode 템플릿 모드 여부
 * @param isCampMode 캠프 모드 여부
 * @returns 검증 결과
 */
export function validateStep(
  step: WizardStep,
  wizardData: WizardData,
  isTemplateMode: boolean,
  isCampMode: boolean
): ValidationResult {
  switch (step) {
    case 1:
      return validateStep1(wizardData, isTemplateMode, isCampMode);
    case 2:
      return validateStep2(wizardData, isTemplateMode);
    case 3:
      return validateStep3(wizardData);
    case 4:
      return validateStep4(wizardData, isTemplateMode);
    case 5:
      return validateStep5(wizardData);
    case 6:
      return validateStep6(wizardData);
    case 7:
      return validateStep7(wizardData);
    default:
      return {
        isValid: true,
        errors: [],
        warnings: [],
        fieldErrors: new Map(),
      };
  }
}

