/**
 * 애플리케이션 에러 처리 표준화
 *
 * 이 모듈은 애플리케이션 전반에서 사용되는 에러 처리 유틸리티를 제공합니다.
 *
 * @module lib/errors/handler
 *
 * @example
 * ```typescript
 * // Server Action에서 사용
 * export const myAction = withErrorHandling(async (data: FormData) => {
 *   const result = await doSomething(data);
 *   if (!result) {
 *     throw new AppError(
 *       '데이터를 찾을 수 없습니다.',
 *       ErrorCode.NOT_FOUND,
 *       404
 *     );
 *   }
 *   return result;
 * });
 * ```
 */

/**
 * 애플리케이션 에러 코드
 *
 * 각 에러 코드는 특정 유형의 오류를 나타내며,
 * 클라이언트에서 적절한 처리를 위해 사용됩니다.
 */
export enum ErrorCode {
  // 인증/인가 에러
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  
  // 입력 검증 에러
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  
  // 데이터베이스 에러
  DATABASE_ERROR = "DATABASE_ERROR",
  NOT_FOUND = "NOT_FOUND",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
  
  // 비즈니스 로직 에러
  BUSINESS_LOGIC_ERROR = "BUSINESS_LOGIC_ERROR",
  
  // 시스템 에러
  INTERNAL_ERROR = "INTERNAL_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

/**
 * 애플리케이션 표준 에러 클래스
 *
 * 모든 비즈니스 로직 에러는 이 클래스를 사용하여 일관된 형식으로 처리됩니다.
 *
 * @example
 * ```typescript
 * // 기본 사용
 * throw new AppError('접근 권한이 없습니다.', ErrorCode.FORBIDDEN, 403);
 *
 * // 상세 정보 포함
 * throw new AppError(
 *   '플랜 생성에 실패했습니다.',
 *   ErrorCode.BUSINESS_LOGIC_ERROR,
 *   400,
 *   true,
 *   { reason: 'insufficient_study_days', requiredDays: 5, availableDays: 3 }
 * );
 * ```
 */
export class AppError extends Error {
  /**
   * @param message - 사용자에게 표시할 에러 메시지
   * @param code - 에러 코드 (클라이언트에서 조건부 처리에 사용)
   * @param statusCode - HTTP 상태 코드 (기본값: 500)
   * @param isUserFacing - 사용자에게 직접 표시해도 안전한지 여부 (기본값: true)
   * @param details - 추가 컨텍스트 정보 (디버깅용)
   */
  constructor(
    message: string,
    public code: ErrorCode,
    public statusCode: number = 500,
    public isUserFacing: boolean = true,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";

    // Error의 stack trace를 올바르게 설정
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * 사용자에게 안전한 에러 메시지 반환
 *
 * 프로덕션 환경에서는 민감한 정보가 노출되지 않도록
 * 일반적인 메시지만 반환합니다.
 *
 * @param error - 처리할 에러 객체
 * @returns 사용자에게 표시할 수 있는 안전한 메시지
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   toast.error(getUserFacingMessage(error));
 * }
 * ```
 */
export function getUserFacingMessage(error: unknown): string {
  if (error instanceof AppError && error.isUserFacing) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // 프로덕션에서는 일반적인 메시지만 반환
    if (process.env.NODE_ENV === "production") {
      return "작업을 완료하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
    return error.message;
  }
  
  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * 민감 정보 필터링
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "authorization",
  "auth",
  "credential",
  "credentials",
];

/**
 * 객체에서 민감 정보를 필터링합니다.
 */
function filterSensitiveData(data: unknown, depth = 0): unknown {
  // 최대 깊이 제한 (무한 재귀 방지)
  if (depth > 10) {
    return "[Max depth reached]";
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => filterSensitiveData(item, depth + 1));
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    // 민감 필드 체크
    if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
      filtered[key] = "[FILTERED]";
    } else if (typeof value === "object" && value !== null) {
      filtered[key] = filterSensitiveData(value, depth + 1);
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * 에러 로깅
 *
 * 에러 정보를 구조화하여 로깅합니다.
 * 민감한 정보(비밀번호, 토큰 등)는 자동으로 필터링됩니다.
 *
 * @param error - 로깅할 에러 객체
 * @param context - 추가 컨텍스트 정보 (함수명, 인자 등)
 *
 * @example
 * ```typescript
 * try {
 *   await saveUser(userData);
 * } catch (error) {
 *   logError(error, {
 *     function: 'saveUser',
 *     userId: userData.id,
 *     // password 등 민감 필드는 자동 필터링됨
 *   });
 *   throw error;
 * }
 * ```
 *
 * @remarks
 * 향후 Sentry, LogRocket 등 에러 트래킹 서비스와 통합될 수 있습니다.
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  // 민감 정보 필터링
  const filteredContext = context ? filterSensitiveData(context) : undefined;
  
  const errorInfo: Record<string, unknown> = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: {
      ...(filteredContext as Record<string, unknown>),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    },
  };

  // AppError인 경우 추가 정보 포함
  if (error instanceof AppError) {
    errorInfo.code = error.code;
    errorInfo.statusCode = error.statusCode;
    errorInfo.isUserFacing = error.isUserFacing;
    errorInfo.name = error.name;
    if (error.details) {
      errorInfo.details = error.details;
    }
  } else if (error instanceof Error) {
    errorInfo.name = error.name;
    
    // Supabase 에러인 경우 추가 정보
    if ("code" in error) {
      errorInfo.supabaseCode = (error as { code: string }).code;
      errorInfo.supabaseDetails = (error as { details?: unknown }).details;
      errorInfo.supabaseHint = (error as { hint?: string }).hint;
    }
  }

  // 개발 환경에서는 console.error 사용
  if (process.env.NODE_ENV === "development") {
    console.error("[Error]", JSON.stringify(errorInfo, null, 2));
  } else {
    // 프로덕션에서는 에러 트래킹 서비스로 전송
    // 예: Sentry, LogRocket 등
    console.error("[Error]", JSON.stringify(errorInfo, null, 2));

    // NOTE: 에러 트래킹 서비스 통합 고려 (Sentry, LogRocket 등)
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }
}

/**
 * 에러를 AppError로 변환
 *
 * 다양한 형태의 에러를 일관된 AppError 형식으로 정규화합니다.
 * Supabase 에러 코드를 자동으로 인식하여 적절한 에러 코드와 메시지로 변환합니다.
 *
 * @param error - 정규화할 에러 (Error, AppError, 또는 기타)
 * @returns 정규화된 AppError 인스턴스
 *
 * @example
 * ```typescript
 * try {
 *   await supabase.from('users').insert(data);
 * } catch (error) {
 *   const appError = normalizeError(error);
 *   // Supabase 23505 에러 → ErrorCode.DUPLICATE_ENTRY로 변환됨
 *   console.log(appError.code); // 'DUPLICATE_ENTRY'
 * }
 * ```
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Supabase 에러 처리
    if ("code" in error) {
      const code = (error as { code: string }).code;
      
      // UNIQUE 제약 조건 위반
      if (code === "23505") {
        return new AppError(
          "이미 존재하는 데이터입니다.",
          ErrorCode.DUPLICATE_ENTRY,
          409,
          true
        );
      }
      
      // 외래 키 제약 조건 위반
      if (code === "23503") {
        return new AppError(
          "관련된 데이터를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      
      // NOT NULL 제약 조건 위반
      if (code === "23502") {
        return new AppError(
          "필수 입력값이 누락되었습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }

      // PGRST116: 결과가 0개 행일 때 (single() 사용 시)
      if (code === "PGRST116") {
        return new AppError(
          "요청한 데이터를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }

      // 권한 오류
      if (code === "42501") {
        return new AppError(
          "접근 권한이 없습니다.",
          ErrorCode.FORBIDDEN,
          403,
          true
        );
      }

      // 네트워크/연결 오류
      if (code === "08000" || code === "08003" || code === "08006") {
        return new AppError(
          "데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
          ErrorCode.DATABASE_ERROR,
          503,
          true
        );
      }
    }
    
    // 에러 메시지 기반 네트워크 에러 감지 (PostgREST gateway error 등)
    const errorMessageLower = error.message.toLowerCase();
    if (
      errorMessageLower.includes("network connection lost") ||
      errorMessageLower.includes("gateway error") ||
      errorMessageLower.includes("connection") ||
      errorMessageLower.includes("network") ||
      errorMessageLower.includes("fetch failed") ||
      errorMessageLower.includes("timeout")
    ) {
      return new AppError(
        "네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.",
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        503,
        true
      );
    }
    
    // 일반 Error는 사용자에게 보여줄 수 있는 메시지로 변환
    // 단, 프로덕션에서는 일반적인 메시지만 반환
    const errorMessage = error.message || "알 수 없는 오류가 발생했습니다.";
    
    return new AppError(
      errorMessage,
      ErrorCode.INTERNAL_ERROR,
      500,
      // 개발 환경에서는 실제 메시지 표시, 프로덕션에서는 일반 메시지
      process.env.NODE_ENV === "development"
    );
  }

  // Error가 아닌 값이 throw된 경우 (문자열, 숫자, 객체 등)
  // 개발 환경에서는 실제 값을 포함한 메시지 제공
  const errorMessage = process.env.NODE_ENV === "development"
    ? `알 수 없는 오류가 발생했습니다: ${JSON.stringify(error)}`
    : "알 수 없는 오류가 발생했습니다.";
  
  return new AppError(
    errorMessage,
    ErrorCode.INTERNAL_ERROR,
    500,
    // 개발 환경에서는 상세 정보를 포함하므로 isUserFacing을 true로 설정
    // 프로덕션에서는 일반 메시지만 표시
    process.env.NODE_ENV === "development"
  );
}

/**
 * 직렬화 가능한 에러 타입
 *
 * Next.js Server Action에서 클라이언트로 전달할 때 직렬화 가능한 형태로 에러 정보를 담습니다.
 * Error 객체는 직렬화 시 속성이 손실되므로, 이 타입을 사용하여 에러 정보를 보존합니다.
 */
export type SerializableError = {
  code: ErrorCode;
  message: string;
  statusCode: number;
  isUserFacing: boolean;
};

/**
 * Server Action 결과 타입
 *
 * 에러 발생 시 throw 대신 직렬화 가능한 에러 객체를 반환합니다.
 */
export type ActionResult<T> = T | { success: false; error: SerializableError };

/**
 * Next.js redirect/notFound 에러인지 확인
 */
function isNextJsRedirect(error: unknown): boolean {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest: string }).digest === "string"
  ) {
    const digest = (error as { digest: string }).digest;
    return (
      digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")
    );
  }
  return false;
}

/**
 * 에러 결과인지 확인하는 타입 가드
 *
 * Server Action에서 반환된 결과가 에러인지 확인합니다.
 *
 * @example
 * ```typescript
 * const result = await myServerAction(data);
 * if (isErrorResult(result)) {
 *   toast.error(result.error.message);
 *   return;
 * }
 * // result는 정상 반환 타입으로 추론됨
 * ```
 */
export function isErrorResult<T>(
  result: T | { success: false; error: SerializableError }
): result is { success: false; error: SerializableError } {
  return (
    result !== null &&
    typeof result === "object" &&
    "success" in result &&
    result.success === false &&
    "error" in result
  );
}

/**
 * 서버 액션용 에러 핸들러 래퍼
 *
 * 비동기 함수를 래핑하여 에러를 자동으로 처리합니다.
 * - 에러 정규화 및 로깅
 * - Next.js redirect()/notFound() 에러 전파
 * - 기본적으로 에러를 throw하고, returnErrorObject 옵션으로 에러 객체 반환 가능
 *
 * @typeParam TArgs - 함수 인자 타입 배열
 * @typeParam TReturn - 함수 반환 타입
 * @param fn - 래핑할 비동기 함수
 * @returns 에러 처리가 적용된 함수
 *
 * @example
 * ```typescript
 * // 기본 사용 (에러 throw)
 * export const myAction = withErrorHandling(async (data: FormData) => {
 *   // ...
 * });
 *
 * // 에러 객체 반환 모드 (클라이언트에서 안전한 처리 필요 시)
 * export const myActionSafe = withErrorHandlingSafe(async (data: FormData) => {
 *   // ...
 * });
 *
 * // 클라이언트에서 사용
 * const result = await myActionSafe(formData);
 * if (isErrorResult(result)) {
 *   toast.error(result.error.message);
 *   return;
 * }
 * ```
 */
export function withErrorHandling<TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Next.js 15의 redirect()와 notFound()는 특별한 에러를 throw하므로 재throw
      if (isNextJsRedirect(error)) {
        throw error;
      }

      const normalizedError = normalizeError(error);
      logError(normalizedError, { function: fn.name, args });
      throw normalizedError;
    }
  };
}

/**
 * 서버 액션용 안전한 에러 핸들러 래퍼
 *
 * withErrorHandling과 동일하지만, 에러 발생 시 throw 대신 직렬화 가능한 에러 객체를 반환합니다.
 * Next.js Server Action에서 에러가 직렬화될 때 속성이 손실되는 문제를 방지합니다.
 *
 * @typeParam TArgs - 함수 인자 타입 배열
 * @typeParam TReturn - 함수 반환 타입
 * @param fn - 래핑할 비동기 함수
 * @returns 에러 처리가 적용된 함수 (에러 시 에러 객체 반환)
 *
 * @example
 * ```typescript
 * // Server Action 정의
 * export const createPlanGroup = withErrorHandlingSafe(
 *   async (data: PlanGroupData) => {
 *     const result = await planService.create(data);
 *     if (!result.success) {
 *       throw new AppError(result.error, ErrorCode.BUSINESS_LOGIC_ERROR, 400);
 *     }
 *     revalidatePath('/plan');
 *     return result;
 *   }
 * );
 *
 * // 클라이언트에서 사용
 * const result = await createPlanGroup(formData);
 * if (isErrorResult(result)) {
 *   toast.error(result.error.message);
 *   return;
 * }
 * toast.success('플랜이 생성되었습니다.');
 * ```
 */
export function withErrorHandlingSafe<TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn | { success: false; error: SerializableError }> {
  return async (
    ...args: TArgs
  ): Promise<TReturn | { success: false; error: SerializableError }> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Next.js 15의 redirect()와 notFound()는 특별한 에러를 throw하므로 재throw
      if (isNextJsRedirect(error)) {
        throw error;
      }

      const normalizedError = normalizeError(error);

      // 200 상태 코드는 정보성 메시지로 처리 (부분 성공 등)
      if (normalizedError.statusCode === 200) {
        throw normalizedError;
      }

      logError(normalizedError, { function: fn.name, args });

      // 직렬화 가능한 에러 객체 생성
      const serializedError = {
        code: normalizedError.code,
        message: normalizedError.message,
        statusCode: normalizedError.statusCode,
        isUserFacing: normalizedError.isUserFacing,
      };

      // [DIAGNOSTIC] 에러 직렬화 디버깅 - 문제 해결 후 제거
      console.log("[withErrorHandlingSafe] Serializing error:", {
        code: serializedError.code,
        message: serializedError.message,
        statusCode: serializedError.statusCode,
        isUserFacing: serializedError.isUserFacing,
        fnName: fn.name,
      });

      // 직렬화 가능한 에러 객체 반환 (throw 대신)
      return {
        success: false as const,
        error: serializedError,
      };
    }
  };
}

