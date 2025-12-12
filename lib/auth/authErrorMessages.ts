/**
 * Supabase 인증 에러 메시지 매핑 유틸리티
 * 
 * Supabase 인증 에러를 사용자 친화적인 한국어 메시지로 변환합니다.
 */

type AuthError = {
  message?: string | null;
  status?: number | null;
  code?: string | null;
  name?: string | null;
};

/**
 * Supabase 인증 에러를 사용자 친화적인 메시지로 변환
 * 
 * @param error - Supabase 인증 에러 객체
 * @returns 사용자에게 표시할 에러 메시지
 */
export function getAuthErrorMessage(error: AuthError | null | undefined): string {
  if (!error) {
    return "인증 처리 중 오류가 발생했습니다.";
  }

  const errorMessage = error.message?.toLowerCase() || "";
  const errorCode = error.code?.toLowerCase() || "";
  const errorStatus = error.status;

  // 만료된 코드
  const expiredPatterns = [
    "expired",
    "만료",
    "expiration",
    "timeout",
    "timed out",
    "invalid code",
    "code expired",
  ];
  if (expiredPatterns.some((pattern) => errorMessage.includes(pattern))) {
    return "인증 링크가 만료되었습니다. 새로운 인증 링크를 요청해주세요.";
  }

  // 이미 사용된 코드
  const alreadyUsedPatterns = [
    "already used",
    "이미 사용",
    "already redeemed",
    "already exchanged",
    "code already used",
  ];
  if (alreadyUsedPatterns.some((pattern) => errorMessage.includes(pattern))) {
    return "이미 사용된 인증 링크입니다.";
  }

  // 유효하지 않은 코드
  const invalidPatterns = [
    "invalid",
    "유효하지",
    "invalid code",
    "invalid token",
    "malformed",
    "잘못된",
    "code not found",
    "token not found",
  ];
  if (invalidPatterns.some((pattern) => errorMessage.includes(pattern))) {
    return "유효하지 않은 인증 링크입니다.";
  }

  // 네트워크/연결 오류
  const networkPatterns = [
    "network",
    "network error",
    "connection",
    "연결",
    "fetch",
    "failed to fetch",
    "timeout",
    "econnrefused",
    "enotfound",
  ];
  if (
    networkPatterns.some((pattern) => errorMessage.includes(pattern)) ||
    errorCode === "08000" ||
    errorCode === "08003" ||
    errorCode === "08006"
  ) {
    return "연결에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  // Rate limit 오류
  const rateLimitPatterns = [
    "rate limit",
    "too many requests",
    "429",
    "rate_limit",
  ];
  if (
    rateLimitPatterns.some((pattern) => errorMessage.includes(pattern)) ||
    errorStatus === 429
  ) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }

  // 권한 오류
  const forbiddenPatterns = [
    "forbidden",
    "권한",
    "unauthorized",
    "access denied",
    "permission",
  ];
  if (
    forbiddenPatterns.some((pattern) => errorMessage.includes(pattern)) ||
    errorStatus === 403 ||
    errorStatus === 401
  ) {
    return "인증 권한이 없습니다.";
  }

  // 서버 오류
  if (errorStatus && errorStatus >= 500) {
    return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  // 기본 메시지
  return "인증 처리 중 오류가 발생했습니다.";
}

/**
 * 인증 에러가 코드 없음 에러인지 확인
 * 
 * @param error - 에러 객체 또는 null
 * @returns 코드 없음 에러인지 여부
 */
export function isNoCodeError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  
  if (typeof error === "string") {
    return error.toLowerCase().includes("code") && error.toLowerCase().includes("missing");
  }
  
  return false;
}

