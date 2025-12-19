import type { SupabaseErrorLike } from "./rateLimitHandler";

/**
 * 인증 에러 분석 결과
 */
export interface AuthErrorInfo {
  /** Refresh token 에러 여부 (재시도 불가능) */
  isRefreshTokenError: boolean;
  /** 사용자를 찾을 수 없는 에러 여부 */
  isUserNotFound: boolean;
  /** 세션이 누락된 에러 여부 */
  isSessionMissing: boolean;
  /** 에러를 로깅해야 하는지 여부 */
  shouldLog: boolean;
  /** 에러 객체 (로깅용) */
  error: SupabaseErrorLike | null;
}

/**
 * 인증 에러 분석 및 처리 정보 반환
 * 
 * @param error 분석할 에러 객체
 * @returns 에러 분석 결과
 */
export function analyzeAuthError(error: unknown): AuthErrorInfo {
  if (!error || typeof error !== "object") {
    return {
      isRefreshTokenError: false,
      isUserNotFound: false,
      isSessionMissing: false,
      shouldLog: true,
      error: null,
    };
  }

  const err = error as SupabaseErrorLike;
  const errorMessage = err.message?.toLowerCase() || "";
  const errorCode = err.code?.toLowerCase() || "";
  const errorName = err.name?.toLowerCase() || "";

  // Refresh token 에러 체크
  const isRefreshTokenError =
    errorMessage.includes("refresh token") ||
    errorMessage.includes("refresh_token") ||
    errorMessage.includes("session") ||
    errorCode === "refresh_token_not_found";

  // User not found 에러 체크
  const isUserNotFound =
    errorCode === "user_not_found" ||
    errorMessage.includes("user from sub claim") ||
    errorMessage.includes("user from sub claim in jwt does not exist") ||
    (err.status === 403 && errorMessage.includes("does not exist"));

  // Session missing 에러 체크
  const isSessionMissing =
    errorMessage.includes("session") ||
    errorMessage.includes("refresh token") ||
    errorMessage.includes("refresh_token") ||
    errorName === "authsessionmissingerror" ||
    (errorName === "authapierror" &&
      (errorMessage.includes("refresh token not found") ||
        errorMessage.includes("invalid refresh token") ||
        errorMessage.includes("refresh token expired")));

  // Refresh token 에러나 User not found는 조용히 처리 (로깅 불필요)
  const shouldLog = !isRefreshTokenError && !isUserNotFound;

  return {
    isRefreshTokenError,
    isUserNotFound,
    isSessionMissing,
    shouldLog,
    error: err,
  };
}

/**
 * 에러 로깅 헬퍼 함수
 * 
 * @param context 로깅 컨텍스트 (예: "[auth] getCurrentUser")
 * @param errorInfo 에러 분석 결과
 * @param additionalInfo 추가 로깅 정보
 */
export function logAuthError(
  context: string,
  errorInfo: AuthErrorInfo,
  additionalInfo?: Record<string, unknown>
): void {
  if (!errorInfo.shouldLog || !errorInfo.error) {
    return;
  }

  const errorDetails = {
    message: errorInfo.error.message,
    status: errorInfo.error.status,
    code: errorInfo.error.code,
    name: errorInfo.error.name,
    ...additionalInfo,
  };

  console.error(`${context} 실패`, errorDetails);
}

