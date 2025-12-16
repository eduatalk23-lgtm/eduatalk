/**
 * FormData 파싱 유틸리티 함수
 * FormData에서 값을 안전하게 추출하는 헬퍼 함수들
 * 
 * @deprecated formData.ts의 기능이 통합되었습니다.
 * 이 파일이 단일 FormData 파싱 유틸리티입니다.
 */

/**
 * FormData에서 문자열 값을 안전하게 추출
 * @param formData FormData 객체
 * @param key 필드 키
 * @param defaultValue 기본값 (기본: null)
 * @returns 문자열 값 또는 null
 */
export function getFormString(
  formData: FormData,
  key: string,
  defaultValue: string | null = null
): string | null {
  const value = formData.get(key)?.toString();
  return value && value.trim() !== "" ? value.trim() : defaultValue;
}

/**
 * FormData에서 숫자 값을 안전하게 추출
 * @param formData FormData 객체
 * @param key 필드 키
 * @param defaultValue 기본값 (기본: null)
 * @returns 숫자 값 또는 null
 */
export function getFormInt(
  formData: FormData,
  key: string,
  defaultValue: number | null = null
): number | null {
  const value = formData.get(key)?.toString();
  if (!value || value.trim() === "") return defaultValue;
  const parsed = parseInt(value.trim(), 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * FormData에서 숫자 값을 안전하게 추출 (검증 옵션 포함)
 * - 빈 문자열이나 null은 null 반환
 * - 숫자로 변환 불가능한 경우 null 반환
 * - NaN 체크 포함
 * - 범위 검증 지원 (min, max)
 * - 필수 필드 검증 지원 (required)
 * 
 * @param formData FormData 객체
 * @param key 필드 이름
 * @param options 옵션 (min, max, required)
 * @returns 숫자 값 또는 null
 * @throws Error 필수 필드가 비어있거나, 범위를 벗어난 경우
 */
export function getNumberFromFormData(
  formData: FormData,
  key: string,
  options?: {
    min?: number;
    max?: number;
    required?: boolean;
  }
): number | null {
  const value = formData.get(key);
  
  // null 또는 빈 문자열 처리
  if (value === null || value === "") {
    if (options?.required) {
      throw new Error(`${key}는 필수입니다.`);
    }
    return null;
  }
  
  // 문자열로 변환 및 공백 제거
  const stringValue = String(value).trim();
  if (stringValue === "") {
    if (options?.required) {
      throw new Error(`${key}는 필수입니다.`);
    }
    return null;
  }
  
  // 숫자 변환
  const numValue = Number(stringValue);
  
  // NaN 체크
  if (isNaN(numValue)) {
    if (options?.required) {
      throw new Error(`${key}는 숫자여야 합니다.`);
    }
    return null;
  }
  
  // 범위 검증
  if (options?.min !== undefined && numValue < options.min) {
    throw new Error(`${key}는 ${options.min} 이상이어야 합니다.`);
  }
  
  if (options?.max !== undefined && numValue > options.max) {
    throw new Error(`${key}는 ${options.max} 이하여야 합니다.`);
  }
  
  return numValue;
}

/**
 * FormData에서 부동소수점 숫자 값을 안전하게 추출
 * @param formData FormData 객체
 * @param key 필드 키
 * @param defaultValue 기본값 (기본: null)
 * @returns 숫자 값 또는 null
 */
export function getFormFloat(
  formData: FormData,
  key: string,
  defaultValue: number | null = null
): number | null {
  const value = formData.get(key)?.toString();
  if (!value || value.trim() === "") return defaultValue;
  const parsed = parseFloat(value.trim());
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * FormData에서 UUID 값을 안전하게 추출 (빈 문자열 체크 포함)
 * @param formData FormData 객체
 * @param key 필드 키
 * @param defaultValue 기본값 (기본: null)
 * @returns UUID 문자열 또는 null
 */
export function getFormUuid(
  formData: FormData,
  key: string,
  defaultValue: string | null = null
): string | null {
  const value = formData.get(key)?.toString();
  return value && value.trim() !== "" ? value.trim() : defaultValue;
}

/**
 * FormData에서 불리언 값을 안전하게 추출
 * @param formData FormData 객체
 * @param key 필드 키
 * @param defaultValue 기본값 (기본: null)
 * @returns 불리언 값 또는 null
 */
export function getFormBoolean(
  formData: FormData,
  key: string,
  defaultValue: boolean | null = null
): boolean | null {
  const value = formData.get(key)?.toString();
  if (!value || value.trim() === "") return defaultValue;
  const str = value.trim().toLowerCase();
  return str === "true" || str === "1" || str === "yes" || str === "on";
}

/**
 * FormData에서 날짜 값을 안전하게 추출
 * @param formData FormData 객체
 * @param key 필드 키
 * @param defaultValue 기본값 (기본: null)
 * @returns 날짜 문자열 또는 null
 */
export function getFormDate(
  formData: FormData,
  key: string,
  defaultValue: string | null = null
): string | null {
  const value = formData.get(key)?.toString();
  return value && value.trim() !== "" ? value.trim() : defaultValue;
}

/**
 * FormData에서 배열 값을 추출 (getAll 사용)
 * @param formData FormData 객체
 * @param key 필드 키
 * @returns 문자열 배열
 */
export function getFormArray(
  formData: FormData,
  key: string
): string[] {
  return formData.getAll(key).filter(Boolean).map((v) => v.toString().trim());
}

/**
 * FormData에서 태그 문자열을 파싱하여 배열로 반환
 * @param formData FormData 객체
 * @param key 필드 키
 * @returns 태그 배열 또는 null
 */
export function getFormTags(
  formData: FormData,
  key: string
): string[] | null {
  const value = formData.get(key)?.toString();
  if (!value || value.trim() === "") return null;
  return value.split(",").map((t: string) => t.trim()).filter(Boolean);
}

// ============================================
// formData.ts에서 통합된 함수들 (하위 호환성 유지)
// ============================================

/**
 * FormData 값을 문자열로 변환 (빈 문자열 대체)
 * @deprecated getFormString을 사용하세요
 */
export function parseFormString(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

/**
 * FormData 값을 문자열로 변환 (빈 값은 null 반환)
 * @deprecated getFormString을 사용하세요
 */
export function parseFormStringOrNull(
  value: FormDataEntryValue | null
): string | null {
  const str = parseFormString(value);
  return str || null;
}

/**
 * FormData 값을 숫자로 변환
 * @deprecated getFormInt을 사용하세요
 */
export function parseFormNumber(value: FormDataEntryValue | null): number {
  const str = parseFormString(value);
  const num = Number(str);
  return isNaN(num) ? 0 : num;
}

/**
 * FormData 값을 숫자로 변환 (빈 값은 null 반환)
 * @deprecated getFormInt을 사용하세요
 */
export function parseFormNumberOrNull(
  value: FormDataEntryValue | null
): number | null {
  const str = parseFormString(value);
  if (!str) return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

/**
 * FormData 값을 불리언으로 변환
 * @deprecated getFormBoolean을 사용하세요
 */
export function parseFormBoolean(value: FormDataEntryValue | null): boolean {
  const str = parseFormString(value).toLowerCase();
  return str === "true" || str === "1" || str === "yes" || str === "on";
}

/**
 * FormData에서 여러 값을 추출 (체크박스 그룹 등)
 * @deprecated getFormArray를 사용하세요
 */
export function parseFormArray(formData: FormData, key: string): string[] {
  return getFormArray(formData, key);
}

/**
 * FormData를 일반 객체로 변환
 * @deprecated lib/validation/schemas.ts의 formDataToObject를 사용하세요.
 * 이 함수는 제거되었습니다.
 */

