"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { logError } from "@/lib/errors/handler";
import { ErrorState } from "@/components/ui/ErrorState";

interface GlobalErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary
 * 
 * 애플리케이션 전역에서 발생하는 예상치 못한 에러를 처리합니다.
 * - 에러 로깅 통합
 * - 사용자 친화적인 에러 UI 표시
 * - 개발 환경에서 상세 에러 정보 표시
 */
export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 로깅
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: "GlobalErrorBoundary",
    });

    // errorInfo 저장 (개발 환경에서 표시용)
    this.setState({
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo } = this.state;
      const isDevelopment = process.env.NODE_ENV === "development";

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
          <div className="w-full max-w-2xl">
            <ErrorState
              title="예상치 못한 오류가 발생했습니다"
              message="애플리케이션에서 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요."
              onRetry={this.handleReset}
              retryLabel="다시 시도"
              actionHref="/dashboard"
              actionLabel="대시보드로 이동"
            />

            {isDevelopment && error && (
              <div className="mt-6 rounded-lg border border-error-200 bg-error-50 dark:bg-error-900/30 p-4">
                <details className="flex flex-col gap-2">
                  <summary className="cursor-pointer text-body-2-bold text-error-800 dark:text-error-200 hover:text-error-900 dark:hover:text-error-100">
                    개발자 정보 (개발 모드에서만 표시)
                  </summary>
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-body-2 font-semibold text-error-700 dark:text-error-300 mb-1">
                        에러 메시지:
                      </div>
                      <pre className="overflow-auto rounded bg-error-100 dark:bg-error-900/50 p-2 text-body-2 text-error-900 dark:text-error-100 whitespace-pre-wrap break-words">
                        {error.toString()}
                      </pre>
                    </div>
                    {error.stack && (
                      <div>
                        <div className="text-body-2 font-semibold text-error-700 dark:text-error-300 mb-1">
                          스택 트레이스:
                        </div>
                        <pre className="overflow-auto rounded bg-error-100 dark:bg-error-900/50 p-2 text-body-2 text-error-900 dark:text-error-100 whitespace-pre-wrap break-words max-h-60">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                    {errorInfo && errorInfo.componentStack && (
                      <div>
                        <div className="text-body-2 font-semibold text-error-700 dark:text-error-300 mb-1">
                          컴포넌트 스택:
                        </div>
                        <pre className="overflow-auto rounded bg-error-100 dark:bg-error-900/50 p-2 text-body-2 text-error-900 dark:text-error-100 whitespace-pre-wrap break-words max-h-60">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

