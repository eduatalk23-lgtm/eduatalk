/**
 * 서버 액션 표준 핸들러 유틸리티
 * 
 * 비동기 함수를 ActionResponse로 래핑하여 일관된 에러 처리를 제공합니다.
 */

import { z } from "zod";
import { AppError, ErrorCode, normalizeError, logError } from "@/lib/errors";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";

/**
 * Zod 에러를 fieldErrors 형식으로 변환
 */
function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  
  error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  });
  
  return fieldErrors;
}

/**
 * 에러를 ActionResponse로 변환
 */
function errorToActionResponse(error: unknown): ActionResponse {
  // Zod 에러 처리
  if (error instanceof z.ZodError) {
    const fieldErrors = formatZodErrors(error);
    const firstError = error.issues[0];
    return createErrorResponse(
      firstError?.message || "입력값 검증에 실패했습니다.",
      fieldErrors
    );
  }

  // AppError 처리
  if (error instanceof AppError) {
    // Next.js의 redirect()와 notFound()는 특별한 에러를 throw하므로 재throw
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

    // 200 상태 코드는 정보성 메시지로 처리 (부분 성공 등)
    if (error.statusCode === 200) {
      // 정보성 메시지는 성공으로 처리하되 메시지 포함
      const message = error.message.replace(/^INFO:\s*/, "");
      return createSuccessResponse(undefined, message);
    }

    // 에러 로깅
    logError(error, { function: "withActionResponse" });

    // 사용자에게 보여줄 수 있는 에러
    if (error.isUserFacing) {
      return createErrorResponse(error.message);
    }

    // isUserFacing이 false인 경우
    const errorMessage = process.env.NODE_ENV === "development"
      ? `작업을 완료하는 중 오류가 발생했습니다: ${error.message}`
      : "작업을 완료하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    
    return createErrorResponse(errorMessage);
  }

  // 일반 Error 처리
  const normalizedError = normalizeError(error);
  
  // Next.js의 redirect()와 notFound()는 특별한 에러를 throw하므로 재throw
  if (
    normalizedError &&
    typeof normalizedError === "object" &&
    "digest" in normalizedError &&
    typeof (normalizedError as { digest: string }).digest === "string"
  ) {
    const digest = (normalizedError as { digest: string }).digest;
    if (
      digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_NOT_FOUND")
    ) {
      throw normalizedError;
    }
  }

  // 200 상태 코드는 정보성 메시지로 처리
  if (normalizedError.statusCode === 200) {
    const message = normalizedError.message.replace(/^INFO:\s*/, "");
    return createSuccessResponse(undefined, message);
  }

  // 에러 로깅
  logError(normalizedError, { function: "withActionResponse" });

  // 사용자에게 보여줄 수 있는 에러
  if (normalizedError.isUserFacing) {
    return createErrorResponse(normalizedError.message);
  }

  // 일반 에러
  const errorMessage = process.env.NODE_ENV === "development"
    ? `작업을 완료하는 중 오류가 발생했습니다: ${normalizedError.message}`
    : "작업을 완료하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  
  return createErrorResponse(errorMessage);
}

/**
 * 서버 액션을 ActionResponse로 래핑하는 유틸리티
 * 
 * @template T - 성공 시 반환할 데이터 타입
 * @template Args - 함수 인자 타입
 * 
 * @example
 * ```typescript
 * export const addBlock = withActionResponse(async (formData: FormData) => {
 *   // 비즈니스 로직
 *   return { blockId: "123" };
 * });
 * ```
 */
export function withActionResponse<T = void, Args extends any[] = any[]>(
  handler: (...args: Args) => Promise<T>
): (...args: Args) => Promise<ActionResponse<T>> {
  return async (...args: Args): Promise<ActionResponse<T>> => {
    try {
      const result = await handler(...args);
      return createSuccessResponse(result);
    } catch (error) {
      return errorToActionResponse(error);
    }
  };
}

/**
 * 메시지를 포함한 성공 응답을 반환하는 헬퍼
 */
export function withActionResponseWithMessage<T = void, Args extends any[] = any[]>(
  handler: (...args: Args) => Promise<{ data: T; message?: string }>
): (...args: Args) => Promise<ActionResponse<T>> {
  return async (...args: Args): Promise<ActionResponse<T>> => {
    try {
      const result = await handler(...args);
      return createSuccessResponse(result.data, result.message);
    } catch (error) {
      return errorToActionResponse(error);
    }
  };
}

