/**
 * API Utilities Public API
 *
 * API 응답 표준화를 위한 타입과 헬퍼 함수들을 제공합니다.
 *
 * @example
 * import {
 *   apiSuccess,
 *   apiError,
 *   apiUnauthorized,
 *   handleApiError,
 * } from "@/lib/api";
 *
 * // 성공 응답
 * return apiSuccess(data);
 *
 * // 에러 응답
 * return apiError("NOT_FOUND", "리소스를 찾을 수 없습니다.");
 *
 * // 특정 에러 응답
 * return apiUnauthorized();
 *
 * // 예외 처리
 * try {
 *   // ...
 * } catch (error) {
 *   return handleApiError(error, "[api/users]");
 * }
 */

// Types
export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiError,
  ApiErrorCode,
  ApiMeta,
  PaginationMeta,
} from "./types";

// Type Guards
export { isApiSuccess, isApiError, ERROR_STATUS_MAP } from "./types";

// Response Helpers
export {
  // Success
  apiSuccess,
  apiSuccessList,
  apiCreated,
  apiNoContent,
  // Error
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiValidationError,
  apiNotFound,
  apiConflict,
  apiDuplicateEntry,
  apiRateLimited,
  apiInternalError,
  apiDatabaseError,
  apiBusinessError,
  // Handler
  handleApiError,
} from "./response";

