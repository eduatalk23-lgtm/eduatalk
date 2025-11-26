/**
 * API 응답 표준 타입 정의
 *
 * 모든 API 응답은 이 형식을 따릅니다.
 *
 * @example
 * // 성공 응답
 * {
 *   success: true,
 *   data: { id: "1", name: "John" }
 * }
 *
 * // 목록 성공 응답 (페이지네이션)
 * {
 *   success: true,
 *   data: [{ id: "1" }, { id: "2" }],
 *   meta: {
 *     pagination: {
 *       page: 1,
 *       pageSize: 10,
 *       totalCount: 100,
 *       totalPages: 10
 *     }
 *   }
 * }
 *
 * // 에러 응답
 * {
 *   success: false,
 *   error: {
 *     code: "UNAUTHORIZED",
 *     message: "로그인이 필요합니다."
 *   }
 * }
 */

// ============================================
// 기본 응답 타입
// ============================================

/**
 * 성공 응답 타입
 */
export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
};

/**
 * 에러 응답 타입
 */
export type ApiErrorResponse = {
  success: false;
  error: ApiError;
};

/**
 * API 응답 타입 (성공 또는 에러)
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// 메타 정보 타입
// ============================================

/**
 * API 메타 정보
 */
export type ApiMeta = {
  pagination?: PaginationMeta;
  timestamp?: string;
  requestId?: string;
};

/**
 * 페이지네이션 메타 정보
 */
export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

// ============================================
// 에러 타입
// ============================================

/**
 * API 에러 정보
 */
export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * API 에러 코드
 */
export type ApiErrorCode =
  // 인증/권한 관련
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  // 요청 관련
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  // 서버 관련
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "DATABASE_ERROR"
  // 비즈니스 로직 관련
  | "BUSINESS_ERROR"
  | "DUPLICATE_ENTRY"
  | "INVALID_OPERATION";

// ============================================
// HTTP 상태 코드 매핑
// ============================================

/**
 * 에러 코드별 HTTP 상태 코드
 */
export const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SESSION_EXPIRED: 401,
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  DATABASE_ERROR: 500,
  BUSINESS_ERROR: 422,
  DUPLICATE_ENTRY: 409,
  INVALID_OPERATION: 422,
};

// ============================================
// 타입 가드
// ============================================

/**
 * 응답이 성공인지 확인
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * 응답이 에러인지 확인
 */
export function isApiError<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
  return response.success === false;
}

