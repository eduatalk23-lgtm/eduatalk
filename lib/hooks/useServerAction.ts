"use client";

import { useTransition, useState, useCallback } from "react";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

type UseServerActionOptions<T> = {
  onSuccess?: (data?: T, message?: string) => void | Promise<void>;
  onError?: (error: string, fieldErrors?: Record<string, string[]>) => void | Promise<void>;
};

type UseServerActionReturn<T, Args extends any[]> = {
  execute: (...args: Args) => Promise<void>;
  isPending: boolean;
  data: T | undefined;
  error: string | null;
  fieldErrors: Record<string, string[]> | null;
  isSuccess: boolean;
  reset: () => void;
};

/**
 * 서버 액션을 쉽고 안전하게 호출할 수 있는 커스텀 훅
 * 
 * @template T - 성공 시 반환할 데이터 타입
 * @template Args - 서버 액션 함수의 인자 타입 배열
 * 
 * @example
 * ```tsx
 * const { execute, isPending, data, error } = useServerAction(
 *   deleteScore,
 *   {
 *     onSuccess: (data) => {
 *       toast.success("성적이 삭제되었습니다.");
 *       router.refresh();
 *     },
 *     onError: (error) => {
 *       toast.error(error);
 *     },
 *   }
 * );
 * 
 * <button onClick={() => execute(scoreId)} disabled={isPending}>
 *   {isPending ? "삭제 중..." : "삭제"}
 * </button>
 * ```
 */
export function useServerAction<T = void, Args extends any[] = any[]>(
  action: (...args: Args) => Promise<ActionResponse<T>>,
  options?: UseServerActionOptions<T>
): UseServerActionReturn<T, Args> {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const execute = useCallback(
    async (...args: Args) => {
      // 상태 초기화
      setError(null);
      setFieldErrors(null);
      setIsSuccess(false);
      setData(undefined);

      startTransition(async () => {
        try {
          const result = await action(...args);

          if (isSuccessResponse(result)) {
            // 성공 처리
            setData(result.data);
            setIsSuccess(true);

            // 성공 콜백 실행
            if (options?.onSuccess) {
              await options.onSuccess(result.data, result.message);
            }
          } else if (isErrorResponse(result)) {
            // 에러 처리
            const errorMessage = result.error || result.message || "처리에 실패했습니다.";
            setError(errorMessage);
            setFieldErrors(result.fieldErrors || result.validationErrors || null);
            setIsSuccess(false);

            // 에러 콜백 실행
            if (options?.onError) {
              await options.onError(errorMessage, result.fieldErrors || result.validationErrors);
            }
          }
        } catch (err) {
          // 예상치 못한 에러 처리
          const errorMessage = err instanceof Error ? err.message : "예상치 못한 오류가 발생했습니다.";
          setError(errorMessage);
          setFieldErrors(null);
          setIsSuccess(false);

          // 에러 콜백 실행
          if (options?.onError) {
            await options.onError(errorMessage);
          }
        }
      });
    },
    [action, options]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setFieldErrors(null);
    setIsSuccess(false);
  }, []);

  return {
    execute,
    isPending,
    data,
    error,
    fieldErrors,
    isSuccess,
    reset,
  };
}

