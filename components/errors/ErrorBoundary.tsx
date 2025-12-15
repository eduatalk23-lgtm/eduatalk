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
        <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="text-sm font-semibold text-red-800">
                오류가 발생했습니다
              </h3>
              <p className="text-sm text-red-700">
                페이지를 불러오는 중 문제가 발생했습니다. 페이지를 새로고침하거나
                다시 시도해주세요.
              </p>
              {isDevelopment && error && (
                <details className="flex flex-col gap-2">
                  <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800">
                    개발자 정보 (개발 모드에서만 표시)
                  </summary>
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-xs font-semibold text-red-700 mb-1">
                        에러 메시지:
                      </div>
                      <pre className="overflow-auto rounded bg-red-100 p-2 text-xs text-red-900 whitespace-pre-wrap break-words">
                        {error.toString()}
                      </pre>
                    </div>
                    {error.stack && (
                      <div>
                        <div className="text-xs font-semibold text-red-700 mb-1">
                          스택 트레이스:
                        </div>
                        <pre className="overflow-auto rounded bg-red-100 p-2 text-xs text-red-900 whitespace-pre-wrap break-words max-h-60">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                    {errorInfo && errorInfo.componentStack && (
                      <div>
                        <div className="text-xs font-semibold text-red-700 mb-1">
                          컴포넌트 스택:
                        </div>
                        <pre className="overflow-auto rounded bg-red-100 p-2 text-xs text-red-900 whitespace-pre-wrap break-words max-h-60">
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
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  다시 시도
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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

