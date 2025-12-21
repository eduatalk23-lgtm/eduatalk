"use client";

import { useActionState, useEffect } from "react";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";

type UseServerFormOptions<T> = {
  onSuccess?: (data?: T, message?: string) => void | Promise<void>;
  onError?: (error: string, fieldErrors?: Record<string, string[]>) => void | Promise<void>;
};

type UseServerFormReturn<T> = {
  action: (formData: FormData) => Promise<ActionResponse<T>>;
  state: ActionResponse<T> | null;
  isPending: boolean;
  fieldErrors: Record<string, string[]> | null;
  isSuccess: boolean;
  error: string | null;
  data: T | undefined;
};

/**
 * HTML Form 요소와 함께 작동하는 서버 액션 훅
 * 
 * @template T - 성공 시 반환할 데이터 타입
 * 
 * @example
 * ```tsx
 * const { action, state, isPending, fieldErrors } = useServerForm(
 *   createBlock,
 *   null,
 *   {
 *     onSuccess: (data) => {
 *       toast.success("블록이 생성되었습니다.");
 *       router.refresh();
 *     },
 *     onError: (error, fieldErrors) => {
 *       toast.error(error);
 *     },
 *   }
 * );
 * 
 * <form action={action}>
 *   <input name="name" />
 *   {fieldErrors?.name && <span>{fieldErrors.name[0]}</span>}
 *   <button type="submit" disabled={isPending}>
 *     {isPending ? "제출 중..." : "제출"}
 *   </button>
 * </form>
 * ```
 */
export function useServerForm<T = void>(
  serverAction: (formData: FormData) => Promise<ActionResponse<T>>,
  initialState: ActionResponse<T> | null = null,
  options?: UseServerFormOptions<T>
): UseServerFormReturn<T> {
  const [state, formAction, isPending] = useActionState(
    async (
      _prev: ActionResponse<T> | null,
      formData: FormData
    ): Promise<ActionResponse<T>> => {
      return await serverAction(formData);
    },
    initialState
  );

  // 상태에서 필드 추출
  const fieldErrors = state && isErrorResponse(state)
    ? (state.fieldErrors || state.validationErrors || null)
    : null;

  const error = state && isErrorResponse(state)
    ? (state.error || state.message || null)
    : null;

  const data = state && isSuccessResponse(state)
    ? state.data
    : undefined;

  const isSuccess = state ? isSuccessResponse(state) : false;

  // 성공/에러 콜백 실행
  useEffect(() => {
    if (!state) return;

    if (isSuccessResponse(state)) {
      if (options?.onSuccess) {
        options.onSuccess(state.data, state.message);
      }
    } else if (isErrorResponse(state)) {
      if (options?.onError) {
        const errorMessage = state.error || state.message || "처리에 실패했습니다.";
        options.onError(errorMessage, state.fieldErrors || state.validationErrors);
      }
    }
  }, [state, options]);

  return {
    action: formAction,
    state,
    isPending,
    fieldErrors,
    isSuccess,
    error,
    data,
  };
}

