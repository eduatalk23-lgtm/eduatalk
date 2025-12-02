import { NextResponse } from "next/server";
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiError,
  ApiErrorCode,
  ApiMeta,
  PaginationMeta,
} from "./types";
import { ERROR_STATUS_MAP } from "./types";

// ============================================
// 성공 응답 헬퍼
// ============================================

/**
 * 성공 응답 생성
 *
 * @example
 * return apiSuccess({ id: "1", name: "John" });
 * // { success: true, data: { id: "1", name: "John" } }
 */
export function apiSuccess<T>(data: T, meta?: ApiMeta): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response);
}

/**
 * 목록 성공 응답 생성 (페이지네이션 포함)
 *
 * @example
 * return apiSuccessList(items, { page: 1, pageSize: 10, totalCount: 100 });
 */
export function apiSuccessList<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
  }
): NextResponse<ApiSuccessResponse<T[]>> {
  const totalPages = Math.ceil(pagination.totalCount / pagination.pageSize);

  const paginationMeta: PaginationMeta = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount: pagination.totalCount,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPreviousPage: pagination.page > 1,
  };

  return apiSuccess(data, { pagination: paginationMeta });
}

/**
 * 생성 성공 응답 (201)
 */
export function apiCreated<T>(data: T): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  return NextResponse.json(response, { status: 201 });
}

/**
 * 빈 성공 응답 (204 No Content 대신 200 사용)
 */
export function apiNoContent(): NextResponse<ApiSuccessResponse<null>> {
  return apiSuccess(null);
}

// ============================================
// 에러 응답 헬퍼
// ============================================

/**
 * 에러 응답 생성
 *
 * @example
 * return apiError("UNAUTHORIZED", "로그인이 필요합니다.");
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  const error: ApiError = {
    code,
    message,
  };

  if (details) {
    error.details = details;
  }

  const response: ApiErrorResponse = {
    success: false,
    error,
  };

  return NextResponse.json(response, { status: ERROR_STATUS_MAP[code] });
}

// ============================================
// 특정 에러 응답 헬퍼
// ============================================

/**
 * 401 Unauthorized
 */
export function apiUnauthorized(message = "로그인이 필요합니다.") {
  return apiError("UNAUTHORIZED", message);
}

/**
 * 403 Forbidden
 */
export function apiForbidden(message = "권한이 없습니다.") {
  return apiError("FORBIDDEN", message);
}

/**
 * 400 Bad Request
 */
export function apiBadRequest(message: string, details?: Record<string, unknown>) {
  return apiError("BAD_REQUEST", message, details);
}

/**
 * 400 Validation Error
 */
export function apiValidationError(
  message: string,
  errors?: Record<string, string[]>
) {
  return apiError("VALIDATION_ERROR", message, errors ? { errors } : undefined);
}

/**
 * 404 Not Found
 */
export function apiNotFound(message = "리소스를 찾을 수 없습니다.") {
  return apiError("NOT_FOUND", message);
}

/**
 * 409 Conflict
 */
export function apiConflict(message: string) {
  return apiError("CONFLICT", message);
}

/**
 * 409 Duplicate Entry
 */
export function apiDuplicateEntry(message = "이미 존재하는 항목입니다.") {
  return apiError("DUPLICATE_ENTRY", message);
}

/**
 * 429 Rate Limited
 */
export function apiRateLimited(message = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.") {
  return apiError("RATE_LIMITED", message);
}

/**
 * 500 Internal Error
 */
export function apiInternalError(message = "서버 오류가 발생했습니다.") {
  return apiError("INTERNAL_ERROR", message);
}

/**
 * 500 Database Error
 */
export function apiDatabaseError(message = "데이터베이스 오류가 발생했습니다.") {
  return apiError("DATABASE_ERROR", message);
}

/**
 * 422 Business Error
 */
export function apiBusinessError(message: string, details?: Record<string, unknown>) {
  return apiError("BUSINESS_ERROR", message, details);
}

// ============================================
// 에러 핸들러
// ============================================

/**
 * 예외를 API 에러 응답으로 변환
 *
 * @example
 * try {
 *   // ...
 * } catch (error) {
 *   return handleApiError(error, "[api/users] 사용자 조회 실패");
 * }
 */
export function handleApiError(
  error: unknown,
  logPrefix?: string
): NextResponse<ApiErrorResponse> {
  if (logPrefix) {
    console.error(logPrefix, error);
  }

  // Supabase 에러 처리
  if (isSupabaseError(error)) {
    const supabaseError = error as SupabaseError;

    // 특정 에러 코드 처리
    if (supabaseError.code === "23505") {
      return apiDuplicateEntry("이미 존재하는 데이터입니다.");
    }

    if (supabaseError.code === "42501") {
      return apiForbidden("접근 권한이 없습니다.");
    }

    // PGRST116: 결과가 0개 행일 때 (single() 사용 시)
    if (supabaseError.code === "PGRST116") {
      return apiNotFound("요청한 리소스를 찾을 수 없습니다.");
    }

    return apiDatabaseError(supabaseError.message || "데이터베이스 오류가 발생했습니다.");
  }

  // 일반 Error 객체
  if (error instanceof Error) {
    return apiInternalError(error.message);
  }

  // 알 수 없는 에러
  return apiInternalError("알 수 없는 오류가 발생했습니다.");
}

// ============================================
// 유틸리티
// ============================================

type SupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "message" in error)
  );
}

