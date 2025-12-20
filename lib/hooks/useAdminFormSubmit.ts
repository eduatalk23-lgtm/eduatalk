"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useToast } from "@/components/ui/ToastProvider";
import { validateFormData } from "@/lib/validation/schemas";

type UseAdminFormSubmitOptions<T> = {
  action: (formData: FormData) => Promise<void | { success: boolean; message?: string }>;
  schema: z.ZodSchema<T>;
  onSuccess?: (data: T) => void | Promise<void>;
  successMessage?: string;
  redirectPath?: string;
  onError?: (error: Error) => void;
};

type UseAdminFormSubmitReturn = {
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleSubmitWithFormData: (formData: FormData) => void;
  isPending: boolean;
};

/**
 * Admin 폼 제출 로직을 추상화한 커스텀 훅
 * 
 * @example
 * ```tsx
 * const { handleSubmit, isPending } = useAdminFormSubmit({
 *   action: addMasterBook,
 *   schema: masterBookSchema,
 *   successMessage: "교재가 성공적으로 등록되었습니다.",
 *   redirectPath: "/admin/master-books",
 * });
 * 
 * <form onSubmit={handleSubmit}>
 *   ...
 * </form>
 * ```
 */
export function useAdminFormSubmit<T>({
  action,
  schema,
  onSuccess,
  successMessage,
  redirectPath,
  onError,
}: UseAdminFormSubmitOptions<T>): UseAdminFormSubmitReturn {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  function handleSubmitWithFormData(formData: FormData) {
    // 클라이언트 사이드 검증
    const validation = validateFormData(formData, schema);
    if (!validation.success) {
      const firstError = validation.errors.errors[0];
      showError(firstError.message);
      return;
    }

    startTransition(async () => {
      try {
        const result = await action(formData);
        
        // 성공 메시지 표시
        if (successMessage) {
          showSuccess(successMessage);
        } else if (result && typeof result === "object" && "message" in result && result.message) {
          showSuccess(result.message);
        }

        // 성공 콜백 실행
        if (onSuccess) {
          await onSuccess(validation.data);
        }

        // 리다이렉트
        if (redirectPath) {
          router.push(redirectPath);
        }
      } catch (error) {
        console.error("폼 제출 실패:", error);
        const errorMessage =
          error instanceof Error ? error.message : "처리에 실패했습니다.";
        showError(errorMessage);
        
        // 에러 콜백 실행
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    handleSubmitWithFormData(formData);
  }

  return { handleSubmit, handleSubmitWithFormData, isPending };
}

