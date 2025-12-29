/**
 * 위저드 검증 유틸리티
 *
 * 공통 검증 함수와 검증 빌더를 제공합니다.
 *
 * @module lib/wizard/validation
 */

import type {
  ValidationResult,
  FieldError,
  UnifiedWizardData,
  FullWizardData,
  QuickWizardData,
  ContentAddWizardData,
} from "./types";

// ============================================
// 타입
// ============================================

export type ValidatorFn<T = unknown> = (value: T, fieldName: string) => FieldError | null;

export type DataValidatorFn<T extends UnifiedWizardData> = (
  data: T
) => ValidationResult;

// ============================================
// 기본 검증 함수
// ============================================

/**
 * 필수 필드 검증
 */
export function validateRequired(
  value: unknown,
  fieldName: string,
  message?: string
): FieldError | null {
  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    return {
      field: fieldName,
      message: message || `${fieldName}은(는) 필수입니다`,
      severity: "error",
    };
  }
  return null;
}

/**
 * 날짜 범위 검증
 */
export function validateDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  fieldName: string = "dateRange"
): FieldError | null {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      field: fieldName,
      message: "유효하지 않은 날짜 형식입니다",
      severity: "error",
    };
  }

  if (start > end) {
    return {
      field: fieldName,
      message: "종료일이 시작일보다 빠릅니다",
      severity: "error",
    };
  }

  return null;
}

/**
 * 최소 길이 검증
 */
export function validateMinLength(
  value: string | unknown[] | null | undefined,
  minLength: number,
  fieldName: string,
  message?: string
): FieldError | null {
  if (value === null || value === undefined) return null;

  const length = typeof value === "string" ? value.trim().length : value.length;

  if (length < minLength) {
    return {
      field: fieldName,
      message: message || `최소 ${minLength}자 이상 입력해주세요`,
      severity: "error",
    };
  }
  return null;
}

/**
 * 최대 길이 검증
 */
export function validateMaxLength(
  value: string | unknown[] | null | undefined,
  maxLength: number,
  fieldName: string,
  message?: string
): FieldError | null {
  if (value === null || value === undefined) return null;

  const length = typeof value === "string" ? value.length : value.length;

  if (length > maxLength) {
    return {
      field: fieldName,
      message: message || `최대 ${maxLength}자까지 입력 가능합니다`,
      severity: "error",
    };
  }
  return null;
}

/**
 * 숫자 범위 검증
 */
export function validateNumberRange(
  value: number | null | undefined,
  min: number,
  max: number,
  fieldName: string,
  message?: string
): FieldError | null {
  if (value === null || value === undefined) return null;

  if (value < min || value > max) {
    return {
      field: fieldName,
      message: message || `${min}에서 ${max} 사이의 값을 입력해주세요`,
      severity: "error",
    };
  }
  return null;
}

/**
 * 이메일 검증
 */
export function validateEmail(
  value: string | null | undefined,
  fieldName: string = "email"
): FieldError | null {
  if (!value) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return {
      field: fieldName,
      message: "유효한 이메일 주소를 입력해주세요",
      severity: "error",
    };
  }
  return null;
}

/**
 * 시간 형식 검증 (HH:mm)
 */
export function validateTimeFormat(
  value: string | null | undefined,
  fieldName: string = "time"
): FieldError | null {
  if (!value) return null;

  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(value)) {
    return {
      field: fieldName,
      message: "유효한 시간 형식(HH:mm)을 입력해주세요",
      severity: "error",
    };
  }
  return null;
}

// ============================================
// 검증 빌더
// ============================================

/**
 * 검증기 생성
 */
export function createValidator<T extends UnifiedWizardData>(
  validations: Array<(data: T) => FieldError | null>
): DataValidatorFn<T> {
  return (data: T): ValidationResult => {
    const errors: FieldError[] = [];
    const warnings: FieldError[] = [];

    for (const validate of validations) {
      const error = validate(data);
      if (error) {
        if (error.severity === "warning") {
          warnings.push(error);
        } else {
          errors.push(error);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  };
}

/**
 * 여러 검증기 결합
 */
export function combineValidators<T extends UnifiedWizardData>(
  ...validators: Array<DataValidatorFn<T>>
): DataValidatorFn<T> {
  return (data: T): ValidationResult => {
    const allErrors: FieldError[] = [];
    const allWarnings: FieldError[] = [];

    for (const validator of validators) {
      const result = validator(data);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  };
}

// ============================================
// 단계별 검증기 팩토리
// ============================================

/**
 * Full 모드 단계별 검증기 생성
 */
export function createFullModeValidators(): Record<string, DataValidatorFn<FullWizardData>> {
  return {
    "basic-info": createValidator<FullWizardData>([
      (data) => validateRequired(data.basicInfo?.name, "name", "플랜 이름을 입력해주세요"),
      (data) => validateRequired(data.basicInfo?.planPurpose, "planPurpose", "학습 목적을 선택해주세요"),
      (data) => validateRequired(data.basicInfo?.periodStart, "periodStart", "시작일을 선택해주세요"),
      (data) => validateRequired(data.basicInfo?.periodEnd, "periodEnd", "종료일을 선택해주세요"),
      (data) => validateDateRange(
        data.basicInfo?.periodStart,
        data.basicInfo?.periodEnd,
        "period"
      ),
    ]),
    "schedule-settings": createValidator<FullWizardData>([]),
    "schedule-preview": createValidator<FullWizardData>([]),
    "content-selection": createValidator<FullWizardData>([
      (data) => {
        if (!data.contents?.studentContents?.length) {
          return {
            field: "studentContents",
            message: "최소 1개 이상의 콘텐츠를 선택해주세요",
            severity: "error" as const,
          };
        }
        return null;
      },
    ]),
    "recommended-content": createValidator<FullWizardData>([]),
    "final-review": createValidator<FullWizardData>([]),
    "result": createValidator<FullWizardData>([]),
  };
}

/**
 * Quick 모드 단계별 검증기 생성
 */
export function createQuickModeValidators(): Record<string, DataValidatorFn<QuickWizardData>> {
  return {
    "content-selection": createValidator<QuickWizardData>([
      (data) => {
        if (!data.content) {
          return {
            field: "content",
            message: "콘텐츠를 선택해주세요",
            severity: "error" as const,
          };
        }
        return null;
      },
      (data) => validateRequired(data.content?.title, "title", "제목을 입력해주세요"),
    ]),
    schedule: createValidator<QuickWizardData>([
      (data) => validateRequired(data.schedule?.planDate, "planDate", "날짜를 선택해주세요"),
    ]),
    confirmation: createValidator<QuickWizardData>([]),
  };
}

/**
 * ContentAdd 모드 단계별 검증기 생성
 */
export function createContentAddModeValidators(): Record<string, DataValidatorFn<ContentAddWizardData>> {
  return {
    "content-selection": createValidator<ContentAddWizardData>([
      (data) => {
        if (!data.content) {
          return {
            field: "content",
            message: "콘텐츠를 선택해주세요",
            severity: "error" as const,
          };
        }
        return null;
      },
    ]),
    "range-setting": createValidator<ContentAddWizardData>([
      (data) => {
        if (!data.range) {
          return {
            field: "range",
            message: "범위를 설정해주세요",
            severity: "error" as const,
          };
        }
        return null;
      },
      (data) => {
        if (data.range && data.range.start >= data.range.end) {
          return {
            field: "range",
            message: "종료 범위가 시작보다 커야 합니다",
            severity: "error" as const,
          };
        }
        return null;
      },
    ]),
    "study-type": createValidator<ContentAddWizardData>([
      (data) => {
        if (!data.studyType) {
          return {
            field: "studyType",
            message: "학습 유형을 선택해주세요",
            severity: "error" as const,
          };
        }
        return null;
      },
    ]),
    preview: createValidator<ContentAddWizardData>([]),
  };
}
