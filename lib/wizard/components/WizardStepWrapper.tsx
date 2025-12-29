"use client";

/**
 * WizardStepWrapper - 통합 위저드 단계 래퍼
 *
 * 각 위저드 단계를 감싸는 공통 래퍼 컴포넌트
 * 에러 경계, 로딩 상태, 애니메이션 등을 처리
 *
 * @module lib/wizard/components/WizardStepWrapper
 */

import { Component, type ReactNode, Suspense, memo } from "react";
import { cn } from "@/lib/cn";
import { WizardStepSkeleton } from "./WizardSkeleton";
import type { WizardStepDefinition } from "../types";

// ============================================
// 에러 경계
// ============================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  stepLabel?: string;
}

/**
 * StepErrorBoundary
 *
 * 단계별 에러를 캐치하는 에러 경계
 */
class StepErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[WizardStep] Error caught:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-900/20"
          role="alert"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-800/50">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
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
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
              {this.props.stepLabel || "단계"} 로딩 중 오류가 발생했습니다
            </h3>
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {this.state.error?.message || "알 수 없는 오류가 발생했습니다."}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white motion-safe:transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-500 dark:hover:bg-red-600 min-h-[44px]"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================
// 메인 컴포넌트
// ============================================

export interface WizardStepWrapperProps {
  /** 자식 컴포넌트 */
  children: ReactNode;
  /** 단계 정의 */
  step?: WizardStepDefinition;
  /** 로딩 중 표시할 스켈레톤 */
  skeleton?: ReactNode;
  /** 에러 발생 시 표시할 폴백 */
  errorFallback?: ReactNode;
  /** 에러 핸들러 */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** 애니메이션 활성화 */
  animate?: boolean;
  /** 추가 클래스명 */
  className?: string;
  /** 패딩 비활성화 */
  noPadding?: boolean;
}

/**
 * WizardStepWrapper
 *
 * 위저드 단계를 감싸는 공통 래퍼
 */
export const WizardStepWrapper = memo(function WizardStepWrapper({
  children,
  step,
  skeleton,
  errorFallback,
  onError,
  animate = true,
  className,
  noPadding = false,
}: WizardStepWrapperProps) {
  const defaultSkeleton = (
    <WizardStepSkeleton
      stepLabel={step?.label}
      lines={step?.id?.includes("content") ? 4 : 3}
    />
  );

  return (
    <StepErrorBoundary
      fallback={errorFallback}
      onError={onError}
      stepLabel={step?.label}
    >
      <Suspense fallback={skeleton || defaultSkeleton}>
        <div
          className={cn(
            !noPadding && "p-4 sm:p-6",
            animate && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300",
            className
          )}
          role="region"
          aria-label={step?.label ? `${step.label} 단계` : undefined}
        >
          {children}
        </div>
      </Suspense>
    </StepErrorBoundary>
  );
});

// ============================================
// 단계 헤더
// ============================================

export interface StepHeaderProps {
  /** 제목 */
  title: string;
  /** 설명 */
  description?: string;
  /** 아이콘 (ReactNode) */
  icon?: ReactNode;
  /** 단계 번호 */
  stepNumber?: number;
  /** 필수 표시 */
  required?: boolean;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * StepHeader
 *
 * 단계 제목 및 설명 헤더
 */
export function StepHeader({
  title,
  description,
  icon,
  stepNumber,
  required = false,
  className,
}: StepHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            {icon}
          </div>
        )}
        {stepNumber && !icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            {stepNumber}
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
            {required && (
              <span className="ml-1 text-red-500" aria-label="필수 단계">
                *
              </span>
            )}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// 단계 컨텐츠 섹션
// ============================================

export interface StepSectionProps {
  /** 자식 컴포넌트 */
  children: ReactNode;
  /** 섹션 제목 */
  title?: string;
  /** 섹션 설명 */
  description?: string;
  /** 접을 수 있음 */
  collapsible?: boolean;
  /** 초기 접힘 상태 */
  defaultCollapsed?: boolean;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * StepSection
 *
 * 단계 내 섹션 구분
 */
export function StepSection({
  children,
  title,
  description,
  className,
}: StepSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {title && (
        <div className="border-b border-gray-200 pb-2 dark:border-gray-700">
          <h3 className="text-base font-medium text-gray-800 dark:text-gray-200">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ============================================
// 단계 액션 영역
// ============================================

export interface StepActionsProps {
  /** 자식 요소 (버튼들) */
  children: ReactNode;
  /** 정렬 */
  align?: "left" | "center" | "right" | "between";
  /** 추가 클래스명 */
  className?: string;
}

/**
 * StepActions
 *
 * 단계 하단 액션 버튼 영역
 */
export function StepActions({
  children,
  align = "right",
  className,
}: StepActionsProps) {
  return (
    <div
      className={cn(
        "flex gap-3 pt-6",
        align === "left" && "justify-start",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        align === "between" && "justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

export { StepErrorBoundary };
