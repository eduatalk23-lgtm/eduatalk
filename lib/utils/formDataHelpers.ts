/**
 * FormData 파싱 유틸리티 함수
 * FormData에서 값을 안전하게 추출하는 헬퍼 함수들
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

