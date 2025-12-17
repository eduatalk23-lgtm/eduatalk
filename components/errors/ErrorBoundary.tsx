"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { AlertCircle } from "lucide-react";
import { logError } from "@/lib/errors/handler";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 재사용 가능한 ErrorBoundary 컴포넌트
 * 
 * 로컬 컴포넌트에서 발생하는 에러를 처리합니다.
 * - 에러 로깅 통합
 * - 사용자 친화적인 에러 UI 표시
 * - 개발 환경에서 상세 에러 정보 표시
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 로깅
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: "ErrorBoundary",
    });

    // errorInfo 저장 (개발 환경에서 표시용)
    this.setState({
      errorInfo,
    });

    // onError 콜백 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
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
        <div className="flex flex-col gap-4 rounded-lg border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/30 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-error-600 dark:text-error-400 flex-shrink-0" />
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="text-body-2-bold text-error-800 dark:text-error-100">
                오류가 발생했습니다
              </h3>
              <p className="text-body-2 text-error-700 dark:text-error-300">
                페이지를 불러오는 중 문제가 발생했습니다. 페이지를 새로고침하거나
                다시 시도해주세요.
              </p>
              {isDevelopment && error && (
                <details className="flex flex-col gap-2">
                  <summary className="cursor-pointer text-body-2 text-error-600 dark:text-error-400 hover:text-error-800 dark:hover:text-error-200">
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
              )}
              <div className="flex gap-2">
                <button
                  onClick={this.handleReset}
                  className="rounded-lg bg-error-600 px-4 py-2 text-body-2 font-medium text-white transition-base hover:bg-error-700 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2"
                >
                  다시 시도
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg border border-error-300 dark:border-error-700 bg-white dark:bg-secondary-900 px-4 py-2 text-body-2 font-medium text-error-700 dark:text-error-300 transition-base hover:bg-error-50 dark:hover:bg-error-900/20 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2"
                >
                  페이지 새로고침
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

