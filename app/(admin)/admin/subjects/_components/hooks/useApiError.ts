"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { handleSupabaseError } from "@/lib/utils/errorHandling";

/**
 * API 에러 처리를 표준화한 커스텀 훅
 * 
 * @example
 * ```tsx
 * const { handleError } = useApiError();
 * 
 * try {
 *   await someAction();
 * } catch (error) {
 *   handleError(error, "데이터 조회 실패");
 * }
 * ```
 */
export function useApiError() {
  const toast = useToast();

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const errorMessage = handleSupabaseError(error);
      const logPrefix = context ? `[${context}]` : "[API Error]";
      
      console.error(`${logPrefix}`, error);
      toast.showError(errorMessage);
      
      return errorMessage;
    },
    [toast]
  );

  return { handleError };
}

