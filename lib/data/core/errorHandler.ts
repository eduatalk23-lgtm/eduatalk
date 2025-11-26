/**
 * 공통 에러 처리 유틸리티
 * 데이터 페칭 함수에서 일관된 에러 처리를 위한 헬퍼 함수들
 */

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Supabase 에러 타입
 */
export type SupabaseError = PostgrestError;

/**
 * 에러 처리 옵션
 */
export type ErrorHandlingOptions = {
  /**
   * 에러 로깅 여부
   * @default true
   */
  logError?: boolean;
  /**
   * 에러 로깅 시 사용할 컨텍스트 (파일명, 함수명 등)
   */
  context?: string;
  /**
   * 에러 발생 시 반환할 기본값
   */
  defaultValue?: unknown;
  /**
   * 무시할 에러 코드 목록 (예: PGRST116 - no rows returned)
   */
  ignoreErrorCodes?: string[];
};

/**
 * 기본 무시할 에러 코드
 */
const DEFAULT_IGNORE_ERROR_CODES = ["PGRST116"];

/**
 * 에러를 안전하게 처리하고 로깅
 */
export function handleQueryError(
  error: PostgrestError | null,
  options: ErrorHandlingOptions = {}
): boolean {
  if (!error) {
    return false;
  }

  const {
    logError = true,
    context = "[data]",
    ignoreErrorCodes = DEFAULT_IGNORE_ERROR_CODES,
  } = options;

  // 무시할 에러 코드인 경우
  if (ignoreErrorCodes.includes(error.code || "")) {
    return false; // 에러가 아니므로 처리할 필요 없음
  }

  // 에러 로깅
  if (logError) {
    const errorInfo: Record<string, unknown> = {
      message: error.message || String(error),
      code: error.code || "UNKNOWN",
    };

    // 에러 객체의 다른 속성들도 추출
    if ("details" in error) {
      errorInfo.details = (error as { details?: unknown }).details;
    }
    if ("hint" in error) {
      errorInfo.hint = (error as { hint?: unknown }).hint;
    }
    if ("statusCode" in error) {
      errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
    }

    console.error(`${context} 쿼리 에러:`, errorInfo);
  }

  return true; // 에러가 있음
}

/**
 * 에러가 발생했는지 확인 (무시할 에러 코드 제외)
 */
export function isError(
  error: PostgrestError | null,
  ignoreErrorCodes: string[] = DEFAULT_IGNORE_ERROR_CODES
): boolean {
  if (!error) {
    return false;
  }

  return !ignoreErrorCodes.includes(error.code || "");
}

/**
 * 42703 에러 코드 확인 (컬럼이 존재하지 않을 때)
 */
export function isColumnNotFoundError(error: PostgrestError | null): boolean {
  return error?.code === "42703";
}

