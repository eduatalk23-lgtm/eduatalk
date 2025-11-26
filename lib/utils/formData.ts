/**
 * FormData 파싱 유틸리티
 *
 * Server Actions에서 FormData를 파싱할 때 사용합니다.
 */

/**
 * FormData 값을 문자열로 변환 (빈 문자열 대체)
 */
export function parseFormString(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

/**
 * FormData 값을 문자열로 변환 (빈 값은 null 반환)
 */
export function parseFormStringOrNull(
  value: FormDataEntryValue | null
): string | null {
  const str = parseFormString(value);
  return str || null;
}

/**
 * FormData 값을 숫자로 변환
 */
export function parseFormNumber(value: FormDataEntryValue | null): number {
  const str = parseFormString(value);
  const num = Number(str);
  return isNaN(num) ? 0 : num;
}

/**
 * FormData 값을 숫자로 변환 (빈 값은 null 반환)
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
 */
export function parseFormBoolean(value: FormDataEntryValue | null): boolean {
  const str = parseFormString(value).toLowerCase();
  return str === "true" || str === "1" || str === "yes" || str === "on";
}

/**
 * FormData에서 여러 값을 추출 (체크박스 그룹 등)
 */
export function parseFormArray(formData: FormData, key: string): string[] {
  const values = formData.getAll(key);
  return values.map((v) => String(v).trim()).filter(Boolean);
}

/**
 * FormData를 일반 객체로 변환
 */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  formData.forEach((value, key) => {
    result[key] = String(value);
  });
  return result;
}

