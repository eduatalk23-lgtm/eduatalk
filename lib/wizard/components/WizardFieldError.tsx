"use client";

/**
 * WizardFieldError - 통합 위저드 필드 에러
 *
 * 폼 필드 에러 표시를 위한 컴포넌트
 * 에러 복구 UI, 자동 수정 제안, 필드 이동 기능 포함
 *
 * @module lib/wizard/components/WizardFieldError
 */

import { memo, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { FieldError } from "../types";

// ============================================
// 단일 필드 에러
// ============================================

export interface WizardFieldErrorProps {
  /** 에러 메시지 */
  error?: string | FieldError;
  /** 접근성 ID */
  id?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * WizardFieldError
 *
 * 필드 오류 메시지 표시를 위한 재사용 가능한 컴포넌트
 */
export function WizardFieldError({ error, id, className }: WizardFieldErrorProps) {
  if (!error) return null;

  const message = typeof error === "string" ? error : error.message;
  const severity = typeof error === "object" ? error.severity : "error";

  return (
    <p
      id={id}
      className={cn(
        "mt-1 text-xs",
        severity === "error" && "text-red-600 dark:text-red-400",
        severity === "warning" && "text-yellow-600 dark:text-yellow-400",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

// ============================================
// 에러 목록
// ============================================

export interface WizardErrorListProps {
  /** 에러 목록 */
  errors: FieldError[];
  /** 제목 */
  title?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * WizardErrorList
 *
 * 여러 에러를 목록으로 표시
 */
export function WizardErrorList({
  errors,
  title = "다음 항목을 확인해주세요:",
  className,
}: WizardErrorListProps) {
  if (errors.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <p className="mb-2 text-sm font-medium text-red-800 dark:text-red-200">
        {title}
      </p>
      <ul className="list-inside list-disc space-y-1 text-sm text-red-700 dark:text-red-300">
        {errors.map((error, index) => (
          <li key={`${error.field}-${index}`}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// 경고 목록
// ============================================

export interface WizardWarningListProps {
  /** 경고 목록 */
  warnings: FieldError[];
  /** 제목 */
  title?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * WizardWarningList
 *
 * 여러 경고를 목록으로 표시
 */
export function WizardWarningList({
  warnings,
  title = "참고 사항:",
  className,
}: WizardWarningListProps) {
  if (warnings.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20",
        className
      )}
      role="status"
    >
      <p className="mb-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
        {title}
      </p>
      <ul className="list-inside list-disc space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
        {warnings.map((warning, index) => (
          <li key={`${warning.field}-${index}`}>{warning.message}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// 필드 래퍼
// ============================================

export interface FieldWrapperProps {
  /** 자식 요소 */
  children: React.ReactNode;
  /** 레이블 */
  label: string;
  /** 필수 여부 */
  required?: boolean;
  /** 에러 */
  error?: string | FieldError;
  /** 설명 */
  description?: string;
  /** 필드 ID */
  htmlFor?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * FieldWrapper
 *
 * 레이블, 에러, 설명을 포함하는 필드 래퍼
 */
export function FieldWrapper({
  children,
  label,
  required = false,
  error,
  description,
  htmlFor,
  className,
}: FieldWrapperProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const descId = htmlFor ? `${htmlFor}-desc` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-label="필수">
            *
          </span>
        )}
      </label>

      {description && (
        <p
          id={descId}
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {description}
        </p>
      )}

      {children}

      <WizardFieldError error={error} id={errorId} />
    </div>
  );
}

// ============================================
// 인라인 에러 배지
// ============================================

export interface ErrorBadgeProps {
  /** 에러 수 */
  count: number;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * ErrorBadge
 *
 * 에러 수를 표시하는 배지
 */
export function ErrorBadge({ count, className }: ErrorBadgeProps) {
  if (count === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300",
        className
      )}
      aria-label={`${count}개의 오류`}
    >
      {count}
    </span>
  );
}

// ============================================
// 향상된 필드 에러 (수정 제안 포함)
// ============================================

export interface EnhancedFieldErrorProps {
  /** 에러 메시지 */
  error?: string | FieldError;
  /** 해결 방법 힌트 */
  suggestion?: string;
  /** 자동 수정 핸들러 */
  onFix?: () => void;
  /** 수정 버튼 레이블 */
  fixLabel?: string;
  /** 접근성 ID */
  id?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * EnhancedFieldError
 *
 * 수정 제안과 자동 수정 기능을 포함하는 향상된 필드 에러
 */
export const EnhancedFieldError = memo(function EnhancedFieldError({
  error,
  suggestion,
  onFix,
  fixLabel = "수정하기",
  id,
  className,
}: EnhancedFieldErrorProps) {
  if (!error) return null;

  const message = typeof error === "string" ? error : error.message;
  const severity = typeof error === "object" ? error.severity : "error";

  return (
    <div
      id={id}
      className={cn(
        "mt-2 rounded-lg p-3",
        severity === "error" && "bg-red-50 dark:bg-red-900/20",
        severity === "warning" && "bg-yellow-50 dark:bg-yellow-900/20",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {/* 에러 아이콘 */}
        <div
          className={cn(
            "mt-0.5 flex-shrink-0",
            severity === "error" && "text-red-500 dark:text-red-400",
            severity === "warning" && "text-yellow-500 dark:text-yellow-400"
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="flex-1">
          {/* 에러 메시지 */}
          <p
            className={cn(
              "text-sm font-medium",
              severity === "error" && "text-red-800 dark:text-red-200",
              severity === "warning" && "text-yellow-800 dark:text-yellow-200"
            )}
          >
            {message}
          </p>

          {/* 해결 제안 */}
          {suggestion && (
            <p
              className={cn(
                "mt-1 text-xs",
                severity === "error" && "text-red-600 dark:text-red-300",
                severity === "warning" && "text-yellow-600 dark:text-yellow-300"
              )}
            >
              💡 {suggestion}
            </p>
          )}

          {/* 수정 버튼 */}
          {onFix && (
            <button
              type="button"
              onClick={onFix}
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium motion-safe:transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-h-[32px]",
                severity === "error" &&
                  "bg-red-100 text-red-700 hover:bg-red-200 focus-visible:ring-red-500 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700",
                severity === "warning" &&
                  "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 focus-visible:ring-yellow-500 dark:bg-yellow-800 dark:text-yellow-200 dark:hover:bg-yellow-700"
              )}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {fixLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ============================================
// 클릭 가능한 에러 목록 (필드 이동 기능)
// ============================================

export interface ActionableErrorListProps {
  /** 에러 목록 */
  errors: FieldError[];
  /** 필드 클릭 핸들러 */
  onFieldClick?: (fieldId: string) => void;
  /** 제목 */
  title?: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * ActionableErrorList
 *
 * 필드 이동 기능이 있는 클릭 가능한 에러 목록
 */
export const ActionableErrorList = memo(function ActionableErrorList({
  errors,
  onFieldClick,
  title = "다음 항목을 확인해주세요:",
  className,
}: ActionableErrorListProps) {
  const handleFieldClick = useCallback(
    (fieldId: string) => {
      if (!onFieldClick) {
        // 기본 동작: 해당 필드로 스크롤하고 포커스
        const element = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          const focusable = element.querySelector<HTMLElement>(
            "input, select, textarea, button"
          );
          if (focusable) {
            setTimeout(() => focusable.focus(), 300);
          }
        }
        return;
      }
      onFieldClick(fieldId);
    },
    [onFieldClick]
  );

  if (errors.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-5 w-5 text-red-500 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm font-semibold text-red-800 dark:text-red-200">
          {title}
        </p>
      </div>

      <ul className="space-y-2">
        {errors.map((error, index) => (
          <li key={`${error.field}-${index}`}>
            <button
              type="button"
              onClick={() => handleFieldClick(error.field)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm motion-safe:transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:hover:bg-red-800/50 min-h-[36px]"
            >
              <span className="flex-1 text-red-700 dark:text-red-300">
                {error.message}
              </span>
              <svg
                className="h-4 w-4 flex-shrink-0 text-red-400 opacity-0 motion-safe:transition-opacity group-hover:opacity-100 dark:text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-red-600 dark:text-red-400">
        항목을 클릭하면 해당 필드로 이동합니다.
      </p>
    </div>
  );
});

// ============================================
// 성공 메시지
// ============================================

export interface SuccessMessageProps {
  /** 메시지 */
  message: string;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * SuccessMessage
 *
 * 성공 메시지 표시
 */
export function SuccessMessage({ message, className }: SuccessMessageProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20",
        className
      )}
      role="status"
    >
      <svg
        className="h-5 w-5 flex-shrink-0 text-green-500 dark:text-green-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-sm font-medium text-green-700 dark:text-green-300">
        {message}
      </p>
    </div>
  );
}
