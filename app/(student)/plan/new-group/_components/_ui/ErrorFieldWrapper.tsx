"use client";

/**
 * UX-1: 에러 필드 래퍼 컴포넌트
 *
 * 에러가 있는 필드를 시각적으로 강조하고,
 * 에러 메시지를 표시합니다.
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import { getFieldDataAttribute } from "../utils/errorFieldUtils";

export type ErrorFieldWrapperProps = {
  /** 필드 ID (에러 맵의 키와 일치해야 함) */
  fieldId: string;
  /** 에러 여부 */
  hasError: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 자식 요소 */
  children: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
  /** 에러 메시지 표시 여부 */
  showErrorMessage?: boolean;
};

function ErrorFieldWrapperComponent({
  fieldId,
  hasError,
  errorMessage,
  children,
  className,
  showErrorMessage = true,
}: ErrorFieldWrapperProps) {
  return (
    <div
      {...getFieldDataAttribute(fieldId)}
      className={cn(
        "relative transition-all duration-200",
        hasError && "rounded-md ring-2 ring-error-500/30",
        className
      )}
    >
      {children}
      {hasError && showErrorMessage && errorMessage && (
        <p className="mt-1.5 flex items-center gap-1 text-caption-1 text-error-600">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}

export const ErrorFieldWrapper = memo(ErrorFieldWrapperComponent);
export default ErrorFieldWrapper;
