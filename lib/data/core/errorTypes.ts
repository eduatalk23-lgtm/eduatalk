/**
 * 구조화된 에러 타입 정의
 * 
 * 데이터 페칭 함수에서 일관된 에러 처리를 위한 타입 정의
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { ErrorCodeCheckers, POSTGRES_ERROR_CODES, POSTGREST_ERROR_CODES } from "@/lib/constants/errorCodes";

/**
 * 에러 심각도 레벨
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * 에러 카테고리
 */
export type ErrorCategory =
  | "database"
  | "authentication"
  | "authorization"
  | "validation"
  | "network"
  | "unknown";

/**
 * 구조화된 에러 정보
 */
export interface StructuredError {
  /**
   * 에러 메시지
   */
  message: string;
  /**
   * 에러 코드 (PostgreSQL 또는 PostgREST)
   */
  code: string | null;
  /**
   * 에러 카테고리
   */
  category: ErrorCategory;
  /**
   * 에러 심각도
   */
  severity: ErrorSeverity;
  /**
   * 원본 에러 객체
   */
  originalError: PostgrestError | Error | unknown;
  /**
   * 에러 상세 정보
   */
  details?: unknown;
  /**
   * 에러 힌트
   */
  hint?: string | null;
  /**
   * HTTP 상태 코드 (있는 경우)
   */
  statusCode?: number;
  /**
   * 컨텍스트 정보 (파일명, 함수명 등)
   */
  context?: string;
  /**
   * 타임스탬프
   */
  timestamp: string;
}

/**
 * 에러 코드를 카테고리로 매핑
 */
function mapErrorCodeToCategory(code: string | null): ErrorCategory {
  if (!code) return "unknown";

  // PostgreSQL 에러 코드
  if (code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) return "database";
  if (code === POSTGRES_ERROR_CODES.UNDEFINED_TABLE) return "database";
  if (code === POSTGRES_ERROR_CODES.UNIQUE_VIOLATION) return "validation";
  if (code === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION) return "validation";
  if (code === POSTGRES_ERROR_CODES.NOT_NULL_VIOLATION) return "validation";
  if (code === POSTGRES_ERROR_CODES.CHECK_VIOLATION) return "validation";

  // PostgREST 에러 코드
  if (code === POSTGREST_ERROR_CODES.NO_ROWS_RETURNED) return "database";
  if (code === POSTGREST_ERROR_CODES.NO_CONTENT) return "database";
  if (code === POSTGREST_ERROR_CODES.TABLE_VIEW_NOT_FOUND) return "database";

  // HTTP 상태 코드 기반
  if (code.startsWith("4")) {
    if (code.startsWith("401")) return "authentication";
    if (code.startsWith("403")) return "authorization";
    return "validation";
  }
  if (code.startsWith("5")) return "network";

  return "unknown";
}

/**
 * 에러 코드를 심각도로 매핑
 */
function mapErrorCodeToSeverity(code: string | null): ErrorSeverity {
  if (!code) return "medium";

  // 무시할 수 있는 에러 (low)
  if (code === POSTGREST_ERROR_CODES.NO_ROWS_RETURNED) return "low";
  if (code === POSTGREST_ERROR_CODES.NO_CONTENT) return "low";

  // 데이터베이스 스키마 관련 (medium)
  if (code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) return "medium";
  if (code === POSTGRES_ERROR_CODES.UNDEFINED_TABLE) return "medium";
  if (code === POSTGREST_ERROR_CODES.TABLE_VIEW_NOT_FOUND) return "medium";

  // 검증 에러 (medium)
  if (code === POSTGRES_ERROR_CODES.UNIQUE_VIOLATION) return "medium";
  if (code === POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION) return "medium";
  if (code === POSTGRES_ERROR_CODES.NOT_NULL_VIOLATION) return "medium";
  if (code === POSTGRES_ERROR_CODES.CHECK_VIOLATION) return "medium";

  // 인증/인가 에러 (high)
  if (code.startsWith("401") || code.startsWith("403")) return "high";

  // 네트워크 에러 (high)
  if (code.startsWith("5")) return "high";

  return "medium";
}

/**
 * PostgrestError를 구조화된 에러로 변환
 */
export function structureError(
  error: PostgrestError | Error | unknown,
  context?: string
): StructuredError {
  const timestamp = new Date().toISOString();

  // PostgrestError인 경우
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const postgrestError = error as PostgrestError;
    const code = postgrestError.code || null;
    const message = postgrestError.message || "Unknown error";
    const category = mapErrorCodeToCategory(code);
    const severity = mapErrorCodeToSeverity(code);

    return {
      message,
      code,
      category,
      severity,
      originalError: postgrestError,
      details: "details" in postgrestError ? postgrestError.details : undefined,
      hint: "hint" in postgrestError ? postgrestError.hint : undefined,
      statusCode: "statusCode" in postgrestError ? (postgrestError as { statusCode?: number }).statusCode : undefined,
      context,
      timestamp,
    };
  }

  // 일반 Error인 경우
  if (error instanceof Error) {
    return {
      message: error.message || "Unknown error",
      code: null,
      category: "unknown",
      severity: "medium",
      originalError: error,
      context,
      timestamp,
    };
  }

  // 알 수 없는 에러
  return {
    message: String(error) || "Unknown error",
    code: null,
    category: "unknown",
    severity: "medium",
    originalError: error,
    context,
    timestamp,
  };
}

/**
 * 에러가 무시 가능한지 확인
 */
export function isIgnorableError(error: StructuredError): boolean {
  return error.severity === "low" || error.code === POSTGREST_ERROR_CODES.NO_ROWS_RETURNED;
}

/**
 * 에러가 복구 가능한지 확인 (fallback 가능)
 */
export function isRecoverableError(error: StructuredError): boolean {
  return (
    error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN ||
    error.code === POSTGRES_ERROR_CODES.UNDEFINED_TABLE ||
    error.code === POSTGREST_ERROR_CODES.TABLE_VIEW_NOT_FOUND
  );
}

/**
 * 에러가 재시도 가능한지 확인
 */
export function isRetryableError(error: StructuredError): boolean {
  return (
    error.category === "network" ||
    error.code?.startsWith("5") === true ||
    error.severity === "high"
  );
}

