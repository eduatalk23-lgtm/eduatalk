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
    // 에러 객체를 안전하게 직렬화
    const errorInfo: Record<string, unknown> = {};
    
    // 기본 속성 추출
    if (error.message) {
      errorInfo.message = error.message;
    }
    if (error.code) {
      errorInfo.code = error.code;
    }
    
    // 에러 객체의 모든 열거 가능한 속성 추출
    try {
      Object.keys(error).forEach((key) => {
        const value = (error as unknown as Record<string, unknown>)[key];
        // 순환 참조 방지 및 직렬화 가능한 값만 포함
        if (value !== null && typeof value !== "function" && typeof value !== "object") {
          errorInfo[key] = value;
        } else if (typeof value === "object" && value !== null) {
          try {
            // 객체인 경우 JSON 직렬화 시도
            JSON.stringify(value);
            errorInfo[key] = value;
          } catch {
            // 직렬화 불가능한 경우 문자열로 변환
            errorInfo[key] = String(value);
          }
        }
      });
    } catch (e) {
      // 속성 추출 실패 시 최소한의 정보라도 로깅
      errorInfo.errorString = String(error);
    }
    
    // PostgrestError의 표준 속성들 명시적으로 확인
    if ("details" in error && error.details) {
      errorInfo.details = error.details;
    }
    if ("hint" in error && error.hint) {
      errorInfo.hint = error.hint;
    }
    if ("statusCode" in error && (error as { statusCode?: unknown }).statusCode) {
      errorInfo.statusCode = (error as { statusCode?: unknown }).statusCode;
    }

    // 최소한의 정보가 있는지 확인
    if (Object.keys(errorInfo).length === 0) {
      errorInfo.errorString = String(error);
      errorInfo.errorType = typeof error;
      errorInfo.errorConstructor = error?.constructor?.name || "Unknown";
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

