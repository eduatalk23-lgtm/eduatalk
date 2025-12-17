/**
 * 공통 에러 처리 유틸리티
 * 데이터 페칭 함수에서 일관된 에러 처리를 위한 헬퍼 함수들
 */

import type { PostgrestError } from "@supabase/supabase-js";
import {
  structureError,
  isIgnorableError,
  isRecoverableError,
  isRetryableError,
  type StructuredError,
} from "./errorTypes";

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

import { POSTGREST_ERROR_CODES } from "@/lib/constants/errorCodes";

/**
 * 기본 무시할 에러 코드
 */
const DEFAULT_IGNORE_ERROR_CODES = [POSTGREST_ERROR_CODES.NO_ROWS_RETURNED];

/**
 * 에러를 안전하게 처리하고 로깅
 * 
 * @param error - PostgrestError 또는 null
 * @param options - 에러 처리 옵션
 * @returns 에러가 처리되었는지 여부 (무시 가능한 에러는 false)
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

  // 구조화된 에러로 변환
  const structuredError = structureError(error, context);

  // 무시할 에러 코드인 경우
  if (ignoreErrorCodes.includes(error.code || "") || isIgnorableError(structuredError)) {
    return false; // 에러가 아니므로 처리할 필요 없음
  }

  // 에러 로깅
  if (logError) {
    logStructuredError(structuredError);
  }

  return true; // 에러가 있음
}

/**
 * 구조화된 에러를 로깅
 */
export function logStructuredError(error: StructuredError): void {
  const logLevel = getLogLevel(error.severity);
  const logMessage = `${error.context || "[data]"} 쿼리 에러 [${error.category}/${error.severity}]:`;
  const logData = {
    message: error.message,
    code: error.code,
    category: error.category,
    severity: error.severity,
    details: error.details,
    hint: error.hint,
    statusCode: error.statusCode,
    timestamp: error.timestamp,
  };

  // 심각도에 따라 다른 로그 레벨 사용
  if (logLevel === "error") {
    console.error(logMessage, logData);
  } else if (logLevel === "warn") {
    console.warn(logMessage, logData);
  } else {
    console.info(logMessage, logData);
  }
}

/**
 * 심각도에 따른 로그 레벨 결정
 */
function getLogLevel(severity: StructuredError["severity"]): "error" | "warn" | "info" {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warn";
    case "low":
      return "info";
    default:
      return "warn";
  }
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

import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

/**
 * 42703 에러 코드 확인 (컬럼이 존재하지 않을 때)
 * 
 * @deprecated ErrorCodeCheckers.isColumnNotFound 사용 권장
 */
export function isColumnNotFoundError(error: PostgrestError | null): boolean {
  return ErrorCodeCheckers.isColumnNotFound(error);
}

/**
 * 에러를 구조화하여 반환
 * 
 * @param error - 에러 객체
 * @param context - 컨텍스트 정보
 * @returns 구조화된 에러
 */
export function getStructuredError(
  error: PostgrestError | Error | unknown,
  context?: string
): StructuredError {
  return structureError(error, context);
}

/**
 * 에러가 무시 가능한지 확인
 */
export function canIgnoreError(error: PostgrestError | null, context?: string): boolean {
  if (!error) return true;
  const structured = structureError(error, context);
  return isIgnorableError(structured);
}

/**
 * 에러가 복구 가능한지 확인 (fallback 가능)
 */
export function canRecoverFromError(error: PostgrestError | null, context?: string): boolean {
  if (!error) return false;
  const structured = structureError(error, context);
  return isRecoverableError(structured);
}

/**
 * 에러가 재시도 가능한지 확인
 */
export function canRetryError(error: PostgrestError | null, context?: string): boolean {
  if (!error) return false;
  const structured = structureError(error, context);
  return isRetryableError(structured);
}

