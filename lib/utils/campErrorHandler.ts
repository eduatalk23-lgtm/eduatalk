/**
 * 캠프 관련 에러 처리 유틸리티
 */

import type { Result } from "@/lib/types/camp";

/**
 * 에러를 문자열로 변환
 */
export function handleCampError(error: unknown, context: string): string {
  if (error instanceof Error) {
    console.error(`[${context}]`, error);
    return error.message;
  }
  const errorMessage = String(error);
  console.error(`[${context}]`, errorMessage);
  return errorMessage;
}

/**
 * 에러 처리를 포함한 비동기 함수 래퍼
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: handleCampError(error, context),
    };
  }
}

