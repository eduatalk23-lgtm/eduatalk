/**
 * 에러 처리 유틸리티 함수
 *
 * Supabase 및 애플리케이션 에러를 안전하게 처리하는 유틸리티 함수
 * 일관된 에러 메시지 패턴을 제공합니다.
 */

import { isPostgrestError } from "@/lib/types/errors";

// ============================================================================
// 에러 타입 정의
// ============================================================================

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "DATABASE_ERROR"
  | "TIMEOUT"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNKNOWN";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  originalError?: unknown;
  context?: Record<string, unknown>;
}

// ============================================================================
// 에러 메시지 매핑
// ============================================================================

/**
 * 에러 코드별 기본 사용자 메시지
 */
const errorMessages: Record<ErrorCode, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  FORBIDDEN: "접근 권한이 없습니다.",
  NOT_FOUND: "요청한 항목을 찾을 수 없습니다.",
  VALIDATION_ERROR: "입력 정보를 확인해주세요.",
  NETWORK_ERROR: "네트워크 연결을 확인해주세요.",
  SERVER_ERROR: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  DATABASE_ERROR: "데이터베이스 오류가 발생했습니다.",
  TIMEOUT: "요청 시간이 초과되었습니다. 다시 시도해주세요.",
  CONFLICT: "충돌이 발생했습니다. 페이지를 새로고침해주세요.",
  RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  UNKNOWN: "오류가 발생했습니다. 다시 시도해주세요.",
};

/**
 * HTTP 상태 코드에서 에러 코드로 변환
 */
function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    case 500:
    case 502:
    case 503:
    case 504:
      return "SERVER_ERROR";
    default:
      return "UNKNOWN";
  }
}

// ============================================================================
// 에러 생성 함수
// ============================================================================

/**
 * AppError 객체 생성
 */
export function createAppError(
  code: ErrorCode,
  options?: {
    message?: string;
    userMessage?: string;
    severity?: ErrorSeverity;
    originalError?: unknown;
    context?: Record<string, unknown>;
  }
): AppError {
  const defaultSeverity: Record<ErrorCode, ErrorSeverity> = {
    UNAUTHORIZED: "warning",
    FORBIDDEN: "warning",
    NOT_FOUND: "info",
    VALIDATION_ERROR: "warning",
    NETWORK_ERROR: "error",
    SERVER_ERROR: "error",
    DATABASE_ERROR: "error",
    TIMEOUT: "warning",
    CONFLICT: "warning",
    RATE_LIMITED: "warning",
    UNKNOWN: "error",
  };

  return {
    code,
    message: options?.message || errorMessages[code],
    userMessage: options?.userMessage || errorMessages[code],
    severity: options?.severity || defaultSeverity[code],
    originalError: options?.originalError,
    context: options?.context,
  };
}

/**
 * unknown 에러를 AppError로 변환
 */
export function normalizeError(error: unknown): AppError {
  // 이미 AppError인 경우
  if (isAppError(error)) {
    return error;
  }

  // PostgrestError (Supabase) 인 경우
  if (isPostgrestError(error)) {
    return createAppError("DATABASE_ERROR", {
      originalError: error,
      message: error.message,
      userMessage: error.message || errorMessages.DATABASE_ERROR,
      context: { code: error.code, details: error.details },
    });
  }

  // Error 인스턴스인 경우
  if (error instanceof Error) {
    // Fetch API 에러
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return createAppError("NETWORK_ERROR", {
        originalError: error,
        message: error.message,
      });
    }

    // Abort 에러 (타임아웃)
    if (error.name === "AbortError") {
      return createAppError("TIMEOUT", {
        originalError: error,
        message: error.message,
      });
    }

    // 일반 Error
    return createAppError("UNKNOWN", {
      originalError: error,
      message: error.message,
    });
  }

  // HTTP Response 에러 (fetch response)
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const response = error as { status: number; statusText?: string };
    const code = httpStatusToErrorCode(response.status);
    return createAppError(code, {
      originalError: error,
      message: response.statusText,
      context: { status: response.status },
    });
  }

  // 문자열 에러
  if (typeof error === "string") {
    return createAppError("UNKNOWN", {
      message: error,
      userMessage: error,
    });
  }

  // 기타
  return createAppError("UNKNOWN", {
    originalError: error,
  });
}

/**
 * AppError 타입 가드
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "userMessage" in error &&
    "severity" in error
  );
}

// ============================================================================
// 에러 표시 헬퍼
// ============================================================================

/**
 * Toast로 에러 표시 (토스트 함수 주입)
 */
export function showErrorToast(
  error: unknown,
  toastFn: (message: string, variant: "error" | "warning" | "info") => void
): void {
  const appError = normalizeError(error);

  const variantMap: Record<ErrorSeverity, "error" | "warning" | "info"> = {
    critical: "error",
    error: "error",
    warning: "warning",
    info: "info",
  };

  toastFn(appError.userMessage, variantMap[appError.severity]);
}

/**
 * 에러 로깅 (개발/프로덕션 환경 구분)
 */
export function logAppError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const appError = normalizeError(error);

  if (process.env.NODE_ENV === "development") {
    console.error("[AppError]", {
      ...appError,
      context: { ...appError.context, ...context },
    });
  } else {
    // 프로덕션에서는 에러 추적 서비스로 전송 가능
    console.error(`[${appError.code}] ${appError.message}`);
  }
}

// ============================================================================
// 비동기 에러 처리 래퍼
// ============================================================================

/**
 * 비동기 함수 에러 처리 래퍼
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: AppError) => void;
    fallback?: T;
    rethrow?: boolean;
  }
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const appError = normalizeError(error);
    logAppError(appError);
    options?.onError?.(appError);

    if (options?.rethrow) {
      throw appError;
    }

    return options?.fallback;
  }
}

/**
 * Server Action 결과 타입
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: AppError };

/**
 * Server Action 래퍼
 */
export async function safeAction<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const appError = normalizeError(error);
    logAppError(appError);
    return { success: false, error: appError };
  }
}

// ============================================================================
// 도메인별 에러 메시지
// ============================================================================

/**
 * 도메인별 커스텀 에러 메시지
 */
export const domainErrorMessages = {
  auth: {
    invalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
    sessionExpired: "세션이 만료되었습니다. 다시 로그인해주세요.",
    emailAlreadyExists: "이미 등록된 이메일입니다.",
    weakPassword: "비밀번호가 너무 약합니다. 8자 이상 입력해주세요.",
  },
  plan: {
    createFailed: "플랜 생성에 실패했습니다.",
    updateFailed: "플랜 수정에 실패했습니다.",
    deleteFailed: "플랜 삭제에 실패했습니다.",
    conflictingSchedule: "해당 시간에 이미 다른 플랜이 있습니다.",
    pastDateNotAllowed: "과거 날짜에는 플랜을 생성할 수 없습니다.",
  },
  content: {
    loadFailed: "콘텐츠를 불러오는데 실패했습니다.",
    notFound: "요청한 콘텐츠를 찾을 수 없습니다.",
    uploadFailed: "파일 업로드에 실패했습니다.",
  },
  score: {
    saveFailed: "점수 저장에 실패했습니다.",
    invalidScore: "올바른 점수를 입력해주세요.",
  },
  student: {
    loadFailed: "학생 정보를 불러오는데 실패했습니다.",
    updateFailed: "학생 정보 수정에 실패했습니다.",
    notFound: "학생을 찾을 수 없습니다.",
  },
} as const;

/**
 * Supabase 에러를 안전하게 처리
 * 
 * @param error - 처리할 에러 객체
 * @returns 에러 메시지 문자열
 */
export function handleSupabaseError(error: unknown): string {
  if (isPostgrestError(error)) {
    // PostgrestError의 경우 상세 정보 반환
    return error.message || "데이터베이스 오류가 발생했습니다.";
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * 에러에서 상세 정보 추출
 * 
 * @param error - 처리할 에러 객체
 * @returns 에러 상세 정보 객체
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  code?: string;
  details?: unknown;
  hint?: string | null;
} {
  if (isPostgrestError(error)) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint ?? null,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }
  
  return {
    message: "알 수 없는 오류가 발생했습니다.",
  };
}

