"use client";

import { Component, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 에러 로깅
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // 개발 환경에서만 상세 에러 정보 표시
    if (process.env.NODE_ENV === "development") {
      console.error("Error details:", errorInfo);
    }

    // onError 콜백 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="text-sm font-semibold text-red-800">오류가 발생했습니다</h3>
              <p className="text-sm text-red-700">
                페이지를 불러오는 중 문제가 발생했습니다. 페이지를 새로고침하거나 다시 시도해주세요.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="flex flex-col gap-2">
                  <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800">
                    개발자 정보 (개발 모드에서만 표시)
                  </summary>
                  <pre className="overflow-auto rounded bg-red-100 p-2 text-xs text-red-900">
                    {this.state.error.toString()}
                    {this.state.error.stack && `\n\n${this.state.error.stack}`}
                  </pre>
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

