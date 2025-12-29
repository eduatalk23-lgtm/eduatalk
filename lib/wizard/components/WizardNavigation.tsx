"use client";

/**
 * WizardNavigation - 통합 위저드 네비게이션
 *
 * 이전/다음 버튼 및 단축키 네비게이션을 제공하는 컴포넌트
 *
 * @module lib/wizard/components/WizardNavigation
 */

import { memo, useCallback, useEffect } from "react";
import { cn } from "@/lib/cn";

// ============================================
// 타입
// ============================================

export interface WizardNavigationProps {
  /** 이전 단계로 이동 가능 여부 */
  canGoPrev: boolean;
  /** 다음 단계로 이동 가능 여부 */
  canGoNext: boolean;
  /** 이전 버튼 클릭 핸들러 */
  onPrev: () => void;
  /** 다음 버튼 클릭 핸들러 */
  onNext: () => void;
  /** 제출 핸들러 (마지막 단계에서 사용) */
  onSubmit?: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 제출 중 상태 */
  isSubmitting?: boolean;
  /** 마지막 단계 여부 */
  isLastStep?: boolean;
  /** 이전 버튼 레이블 */
  prevLabel?: string;
  /** 다음 버튼 레이블 */
  nextLabel?: string;
  /** 제출 버튼 레이블 */
  submitLabel?: string;
  /** 키보드 네비게이션 활성화 */
  enableKeyboardNav?: boolean;
  /** 추가 클래스명 */
  className?: string;
  /** 전체 너비 버튼 (모바일용) */
  fullWidth?: boolean;
}

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * WizardNavigation
 *
 * 위저드 이전/다음 네비게이션 버튼
 */
export const WizardNavigation = memo(function WizardNavigation({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onSubmit,
  isLoading = false,
  isSubmitting = false,
  isLastStep = false,
  prevLabel = "이전",
  nextLabel = "다음",
  submitLabel = "완료",
  enableKeyboardNav = true,
  className,
  fullWidth = false,
}: WizardNavigationProps) {
  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enableKeyboardNav) return;
      if (isLoading || isSubmitting) return;

      // Ctrl/Cmd + Enter: 다음 단계 또는 제출
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (isLastStep && onSubmit) {
          onSubmit();
        } else if (canGoNext) {
          onNext();
        }
        return;
      }

      // Ctrl/Cmd + Backspace: 이전 단계
      if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
        e.preventDefault();
        if (canGoPrev) {
          onPrev();
        }
        return;
      }
    },
    [
      enableKeyboardNav,
      isLoading,
      isSubmitting,
      isLastStep,
      canGoPrev,
      canGoNext,
      onPrev,
      onNext,
      onSubmit,
    ]
  );

  useEffect(() => {
    if (enableKeyboardNav) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [enableKeyboardNav, handleKeyDown]);

  const handleNextOrSubmit = () => {
    if (isLastStep && onSubmit) {
      onSubmit();
    } else {
      onNext();
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 pt-6",
        fullWidth ? "flex-col sm:flex-row" : "justify-end",
        className
      )}
      role="navigation"
      aria-label="위저드 네비게이션"
    >
      {/* 이전 버튼 */}
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev || isLoading || isSubmitting}
        className={cn(
          "rounded-lg px-6 py-2.5 text-sm font-medium motion-safe:transition-colors",
          "border border-gray-300 bg-white text-gray-700",
          "hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
          "min-h-[44px]", // 모바일 터치 타겟 최소 크기
          fullWidth && "w-full sm:w-auto"
        )}
        aria-label={`${prevLabel} (Ctrl+Backspace)`}
      >
        <span className="flex items-center justify-center gap-2">
          <ChevronLeftIcon className="h-4 w-4" />
          {prevLabel}
        </span>
      </button>

      {/* 다음/제출 버튼 */}
      <button
        type="button"
        onClick={handleNextOrSubmit}
        disabled={
          (isLastStep ? false : !canGoNext) || isLoading || isSubmitting
        }
        className={cn(
          "rounded-lg px-6 py-2.5 text-sm font-medium text-white motion-safe:transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "min-h-[44px]", // 모바일 터치 타겟 최소 크기
          isLastStep
            ? "bg-green-600 hover:bg-green-700 focus-visible:ring-green-500 dark:bg-green-500 dark:hover:bg-green-600"
            : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600",
          fullWidth && "w-full sm:w-auto"
        )}
        aria-label={`${isLastStep ? submitLabel : nextLabel} (Ctrl+Enter)`}
      >
        <span className="flex items-center justify-center gap-2">
          {isLoading || isSubmitting ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              {isSubmitting ? "처리 중..." : "로딩 중..."}
            </>
          ) : (
            <>
              {isLastStep ? submitLabel : nextLabel}
              {!isLastStep && <ChevronRightIcon className="h-4 w-4" />}
            </>
          )}
        </span>
      </button>

      {/* 키보드 단축키 힌트 (스크린 리더용) */}
      <span className="sr-only">
        키보드 단축키: Ctrl+Enter로 다음 단계, Ctrl+Backspace로 이전 단계
      </span>
    </div>
  );
});

// ============================================
// 아이콘 컴포넌트
// ============================================

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("motion-safe:animate-spin", className)}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================
// 키보드 힌트 컴포넌트
// ============================================

export interface KeyboardHintsProps {
  /** 힌트 표시 여부 */
  visible?: boolean;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * KeyboardHints
 *
 * 키보드 단축키 힌트 표시
 * 모바일에서는 숨김 (터치 기기에서는 키보드 단축키 불필요)
 */
export function KeyboardHints({ visible = true, className }: KeyboardHintsProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        // 모바일에서는 숨기고 md 이상에서만 표시
        "hidden md:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400",
        className
      )}
      aria-hidden="true"
    >
      <span className="flex items-center gap-1">
        <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-700">
          Ctrl
        </kbd>
        <span>+</span>
        <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-700">
          Enter
        </kbd>
        <span className="ml-1">다음</span>
      </span>
      <span className="flex items-center gap-1">
        <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-700">
          Ctrl
        </kbd>
        <span>+</span>
        <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-700">
          ⌫
        </kbd>
        <span className="ml-1">이전</span>
      </span>
    </div>
  );
}
