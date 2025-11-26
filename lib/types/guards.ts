/**
 * 타입 가드 함수
 * 런타임 타입 검증을 위한 유틸리티
 */

/**
 * 문자열이 유효한 UUID인지 확인
 */
export function isUUID(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * 값이 null이 아닌 객체인지 확인
 */
export function isNonNullObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 값이 문자열 배열인지 확인
 */
export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * 값이 숫자 배열인지 확인
 */
export function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "number")
  );
}

/**
 * 값이 유효한 날짜 문자열인지 확인 (YYYY-MM-DD 형식)
 */
export function isDateString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * 값이 유효한 이메일인지 확인
 */
export function isEmail(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * 값이 유효한 역할(role)인지 확인
 */
export function isRole(
  value: unknown
): value is "superadmin" | "admin" | "teacher" | "student" | "parent" {
  if (typeof value !== "string") {
    return false;
  }
  const validRoles = ["superadmin", "admin", "teacher", "student", "parent"];
  return validRoles.includes(value);
}

/**
 * 값이 유효한 플랜 상태인지 확인
 */
export function isPlanStatus(
  value: unknown
): value is "draft" | "saved" | "active" | "completed" | "archived" {
  if (typeof value !== "string") {
    return false;
  }
  const validStatuses = ["draft", "saved", "active", "completed", "archived"];
  return validStatuses.includes(value);
}

/**
 * 값이 유효한 콘텐츠 타입인지 확인
 */
export function isContentType(
  value: unknown
): value is "book" | "lecture" | "custom" {
  if (typeof value !== "string") {
    return false;
  }
  const validTypes = ["book", "lecture", "custom"];
  return validTypes.includes(value);
}

