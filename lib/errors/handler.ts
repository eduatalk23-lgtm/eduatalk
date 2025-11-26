/**
 * 애플리케이션 에러 처리 표준화
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
}

export class AppError extends Error {
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
 * 에러 로깅 (향후 에러 트래킹 서비스 통합 가능)
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo: Record<string, unknown> = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
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
  }

  // 개발 환경에서는 console.error 사용
  if (process.env.NODE_ENV === "development") {
    console.error("[Error]", errorInfo);
  } else {
    // 프로덕션에서는 에러 트래킹 서비스로 전송
    // 예: Sentry, LogRocket 등
    console.error("[Error]", JSON.stringify(errorInfo, null, 2));
  }
}

/**
 * 에러를 AppError로 변환
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
    }
    
    return new AppError(
      error.message,
      ErrorCode.INTERNAL_ERROR,
      500,
      false
    );
  }

  return new AppError(
    "알 수 없는 오류가 발생했습니다.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}

/**
 * 서버 액션에서 사용할 에러 핸들러 래퍼
 */
export function withErrorHandling<
  TArgs extends readonly unknown[],
  TReturn
>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Next.js 15의 redirect()와 notFound()는 특별한 에러를 throw하므로 재throw
      // Next.js는 digest 속성에 "NEXT_REDIRECT" 또는 "NEXT_NOT_FOUND"를 포함합니다
      if (
        error &&
        typeof error === "object" &&
        "digest" in error &&
        typeof (error as { digest: string }).digest === "string"
      ) {
        const digest = (error as { digest: string }).digest;
        if (
          digest.startsWith("NEXT_REDIRECT") ||
          digest.startsWith("NEXT_NOT_FOUND")
        ) {
          throw error;
        }
      }
      
      const normalizedError = normalizeError(error);
      
      // 200 상태 코드는 정보성 메시지로 처리 (부분 성공 등)
      if (normalizedError.statusCode === 200) {
        // 로그는 남기지 않고 그대로 전달 (정보성 메시지)
        throw normalizedError;
      }
      
      logError(normalizedError, { function: fn.name, args });
      
      // 사용자에게 보여줄 수 있는 에러만 throw
      if (normalizedError.isUserFacing) {
        throw normalizedError;
      }
      
      // 개발 환경에서는 실제 에러 메시지 포함
      const errorMessage = process.env.NODE_ENV === "development"
        ? `작업을 완료하는 중 오류가 발생했습니다: ${normalizedError.message}`
        : "작업을 완료하는 중 오류가 발생했습니다.";
      
      // 그 외에는 일반적인 에러 메시지
      throw new AppError(
        errorMessage,
        ErrorCode.INTERNAL_ERROR,
        500,
        true
      );
    }
  };
}

