/**
 * 서버 액션의 표준 응답 타입
 * 
 * @template T - 성공 시 반환할 데이터 타입 (기본값: void)
 * 
 * @example
 * ```typescript
 * // 데이터 없이 성공/실패만 반환
 * type CreateResponse = ActionResponse;
 * 
 * // 데이터와 함께 반환
 * type GetResponse = ActionResponse<{ id: string; name: string }>;
 * 
 * // 에러와 검증 에러 포함
 * type UpdateResponse = ActionResponse<{ id: string }>;
 * ```
 */
export type ActionResponse<T = void> = 
  | {
      success: true;
      data?: T;
      message?: string;
    }
  | {
      success: false;
      error?: string;
      validationErrors?: Record<string, string[]>;
      fieldErrors?: Record<string, string[]>; // validationErrors의 alias (Zod 검증 에러 등)
      message?: string;
    };

/**
 * ActionResponse를 생성하는 헬퍼 함수들
 */
export const createSuccessResponse = <T = void>(
  data?: T,
  message?: string
): ActionResponse<T> => ({
  success: true,
  data,
  message,
});

export const createErrorResponse = <T = void>(
  error: string,
  validationErrors?: Record<string, string[]>,
  message?: string
): ActionResponse<T> => ({
  success: false,
  error,
  validationErrors,
  message: message || error,
});

/**
 * ActionResponse의 성공 여부를 타입 가드로 확인
 */
export function isSuccessResponse<T>(
  response: ActionResponse<T>
): response is { success: true; data?: T; message?: string } {
  return response.success === true;
}

/**
 * ActionResponse의 실패 여부를 타입 가드로 확인
 */
export function isErrorResponse(
  response: ActionResponse
): response is {
  success: false;
  error?: string;
  validationErrors?: Record<string, string[]>;
  message?: string;
} {
  return response.success === false;
}

