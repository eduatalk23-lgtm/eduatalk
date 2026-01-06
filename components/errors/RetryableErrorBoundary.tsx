"use client";

/**
 * 자동 재시도 기능이 있는 에러 바운더리
 *
 * 네트워크 에러 시 자동 재시도 및 사용자 친화적인 에러 분류를 제공합니다.
 *
 * @module components/errors/RetryableErrorBoundary
 */

import { Component, ReactNode, ErrorInfo, createContext, useContext } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertCircle, WifiOff, RefreshCw, Home } from "lucide-react";
import { logError } from "@/lib/errors/handler";
import Link from "next/link";
import Button from "@/components/atoms/Button";

// ============================================
// 타입 정의
// ============================================

export type ErrorType = "network" | "auth" | "notFound" | "server" | "unknown";

export interface RetryableErrorBoundaryProps {
  children: ReactNode;
  /** 에러 발생 시 표시할 커스텀 UI */
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  /** 에러 발생 콜백 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 자동 재시도 활성화 (네트워크 복구 시) */
  autoRetryOnReconnect?: boolean;
  /** 홈으로 이동 버튼 표시 여부 */
  showHomeLink?: boolean;
  /** 홈 링크 URL */
  homeUrl?: string;
  /** 최대 자동 재시도 횟수 */
  maxAutoRetries?: number;
}

export interface ErrorFallbackProps {
  error: Error;
  errorType: ErrorType;
  resetError: () => void;
  isRetrying: boolean;
}

interface RetryableErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: ErrorType;
  autoRetryCount: number;
  isRetrying: boolean;
}

// ============================================
// 에러 타입 분류 유틸리티
// ============================================

function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // 네트워크 에러
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    name.includes("typeerror") && message.includes("failed")
  ) {
    return "network";
  }

  // 인증 에러
  if (
    message.includes("unauthorized") ||
    message.includes("unauthenticated") ||
    message.includes("auth") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return "auth";
  }

  // Not Found 에러
  if (message.includes("not found") || message.includes("404")) {
    return "notFound";
  }

  // 서버 에러
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("server error")
  ) {
    return "server";
  }

  return "unknown";
}

function getErrorConfig(errorType: ErrorType) {
  switch (errorType) {
    case "network":
      return {
        icon: WifiOff,
        title: "네트워크 연결 오류",
        description: "인터넷 연결을 확인해주세요. 연결이 복구되면 자동으로 다시 시도합니다.",
        color: "warning" as const,
      };
    case "auth":
      return {
        icon: AlertCircle,
        title: "인증 오류",
        description: "로그인이 필요하거나 권한이 없습니다. 다시 로그인해주세요.",
        color: "error" as const,
      };
    case "notFound":
      return {
        icon: AlertCircle,
        title: "페이지를 찾을 수 없습니다",
        description: "요청하신 페이지가 존재하지 않거나 이동되었습니다.",
        color: "secondary" as const,
      };
    case "server":
      return {
        icon: AlertCircle,
        title: "서버 오류",
        description: "서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        color: "error" as const,
      };
    default:
      return {
        icon: AlertCircle,
        title: "오류가 발생했습니다",
        description: "문제가 지속되면 관리자에게 문의해주세요.",
        color: "error" as const,
      };
  }
}

// ============================================
// Reset Context (for nested components)
// ============================================

const ErrorResetContext = createContext<(() => void) | null>(null);

export function useErrorReset() {
  return useContext(ErrorResetContext);
}

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * 자동 재시도 기능이 있는 에러 바운더리
 *
 * @example
 * ```tsx
 * <RetryableErrorBoundary
 *   autoRetryOnReconnect
 *   showHomeLink
 *   onError={(error) => trackError(error)}
 * >
 *   <MyComponent />
 * </RetryableErrorBoundary>
 * ```
 */
export class RetryableErrorBoundary extends Component<
  RetryableErrorBoundaryProps,
  RetryableErrorBoundaryState
> {
  private networkHandler: (() => void) | null = null;

  constructor(props: RetryableErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: "unknown",
      autoRetryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RetryableErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorType: classifyError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 로깅
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: "RetryableErrorBoundary",
      errorType: classifyError(error),
    });

    this.setState({ errorInfo });

    // onError 콜백
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 네트워크 에러 시 자동 재시도 설정
    if (
      this.props.autoRetryOnReconnect !== false &&
      classifyError(error) === "network"
    ) {
      this.setupNetworkRetry();
    }
  }

  componentWillUnmount() {
    this.cleanupNetworkRetry();
  }

  setupNetworkRetry = () => {
    if (typeof window === "undefined") return;

    this.networkHandler = () => {
      const maxRetries = this.props.maxAutoRetries ?? 3;
      if (this.state.autoRetryCount < maxRetries) {
        this.setState({ isRetrying: true });
        setTimeout(() => {
          this.handleReset();
          this.setState((prev) => ({
            autoRetryCount: prev.autoRetryCount + 1,
            isRetrying: false,
          }));
        }, 1000);
      }
    };

    window.addEventListener("online", this.networkHandler);
  };

  cleanupNetworkRetry = () => {
    if (this.networkHandler && typeof window !== "undefined") {
      window.removeEventListener("online", this.networkHandler);
    }
  };

  handleReset = () => {
    this.cleanupNetworkRetry();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: "unknown",
      isRetrying: false,
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorType, isRetrying } = this.state;
      const {
        fallback,
        showHomeLink = true,
        homeUrl = "/dashboard",
      } = this.props;

      // 커스텀 fallback 렌더링
      if (fallback) {
        if (typeof fallback === "function") {
          return fallback({
            error: error!,
            errorType,
            resetError: this.handleReset,
            isRetrying,
          });
        }
        return fallback;
      }

      // 기본 UI
      const config = getErrorConfig(errorType);
      const IconComponent = config.icon;
      const isDevelopment = process.env.NODE_ENV === "development";

      const colorClasses = {
        error: {
          border: "border-error-200 dark:border-error-800",
          bg: "bg-error-50 dark:bg-error-900/30",
          icon: "text-error-600 dark:text-error-400",
          title: "text-error-800 dark:text-error-100",
          text: "text-error-700 dark:text-error-300",
        },
        warning: {
          border: "border-warning-200 dark:border-warning-800",
          bg: "bg-warning-50 dark:bg-warning-900/30",
          icon: "text-warning-600 dark:text-warning-400",
          title: "text-warning-800 dark:text-warning-100",
          text: "text-warning-700 dark:text-warning-300",
        },
        secondary: {
          border: "border-secondary-200 dark:border-secondary-700",
          bg: "bg-secondary-50 dark:bg-secondary-900/30",
          icon: "text-secondary-600 dark:text-secondary-400",
          title: "text-secondary-800 dark:text-secondary-100",
          text: "text-secondary-700 dark:text-secondary-300",
        },
      };

      const colors = colorClasses[config.color];

      return (
        <ErrorResetContext.Provider value={this.handleReset}>
          <div
            className={`flex flex-col gap-4 rounded-lg border ${colors.border} ${colors.bg} p-6`}
          >
            <div className="flex items-start gap-3">
              <IconComponent
                className={`h-6 w-6 ${colors.icon} flex-shrink-0`}
              />
              <div className="flex flex-1 flex-col gap-2">
                <h3 className={`text-body-1 ${colors.title}`}>
                  {config.title}
                </h3>
                <p className={`text-body-2 ${colors.text}`}>
                  {config.description}
                </p>

                {isRetrying && (
                  <div className="flex items-center gap-2 text-body-2 text-primary-600 dark:text-primary-400">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>재연결 시도 중...</span>
                  </div>
                )}

                {isDevelopment && error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-body-2 text-secondary-600 dark:text-secondary-400 hover:text-secondary-800">
                      개발자 정보
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-secondary-100 dark:bg-secondary-800 p-2 text-caption text-secondary-900 dark:text-secondary-100 whitespace-pre-wrap break-words max-h-40">
                      {error.toString()}
                      {error.stack && `\n\n${error.stack}`}
                    </pre>
                  </details>
                )}

                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={this.handleReset}
                    disabled={isRetrying}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    다시 시도
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    페이지 새로고침
                  </Button>

                  {showHomeLink && (
                    <Link href={homeUrl}>
                      <Button variant="ghost" size="sm">
                        <Home className="h-4 w-4 mr-1" />
                        홈으로
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ErrorResetContext.Provider>
      );
    }

    return (
      <ErrorResetContext.Provider value={this.handleReset}>
        {this.props.children}
      </ErrorResetContext.Provider>
    );
  }
}

// ============================================
// React Query 통합 래퍼
// ============================================

/**
 * React Query와 통합된 에러 바운더리
 *
 * QueryErrorResetBoundary와 RetryableErrorBoundary를 함께 사용합니다.
 */
export function QueryRetryableErrorBoundary({
  children,
  ...props
}: RetryableErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <RetryableErrorBoundary
          {...props}
          onError={(error, errorInfo) => {
            props.onError?.(error, errorInfo);
          }}
          fallback={({ error, errorType, resetError, isRetrying }) => {
            const combinedReset = () => {
              reset();
              resetError();
            };

            if (props.fallback) {
              if (typeof props.fallback === "function") {
                return props.fallback({
                  error,
                  errorType,
                  resetError: combinedReset,
                  isRetrying,
                });
              }
              return props.fallback;
            }

            // 기본 UI는 RetryableErrorBoundary의 것을 사용
            return null;
          }}
        >
          {children}
        </RetryableErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

export default RetryableErrorBoundary;
