"use client";

/**
 * C2 개선: 조치 가이드가 포함된 에러 표시 컴포넌트
 *
 * 에러 메시지와 함께 사용자가 취할 수 있는 조치 방법을 표시합니다.
 *
 * @module app/(student)/plan/new-group/_components/_ui/ErrorWithGuide
 */

import { memo, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  type PlanGroupErrorCode,
  ErrorActionGuides,
  ErrorUserMessages,
  PlanGroupErrorCodes,
} from "@/lib/errors/planGroupErrors";

export type ErrorWithGuideProps = {
  /** 에러 코드 (알 수 없는 경우 undefined) */
  errorCode?: PlanGroupErrorCode;
  /** 에러 메시지 (커스텀 메시지 또는 기본 메시지 오버라이드) */
  message?: string;
  /** 추가 클래스 */
  className?: string;
  /** 재시도 버튼 클릭 핸들러 */
  onRetry?: () => void;
  /** 닫기 버튼 클릭 핸들러 */
  onClose?: () => void;
  /** 컴팩트 모드 (조치 가이드 접기) */
  compact?: boolean;
  /** B3 개선: 현재 재시도 횟수 */
  retryCount?: number;
  /** B3 개선: 최대 재시도 횟수 */
  maxRetries?: number;
  /** B3 개선: 재시도 중 상태 */
  isRetrying?: boolean;
};

/**
 * 심각도에 따른 스타일
 */
const severityStyles = {
  info: {
    container: "border-blue-200 bg-blue-50",
    icon: "text-blue-500",
    title: "text-blue-800",
    text: "text-blue-700",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  warning: {
    container: "border-yellow-200 bg-yellow-50",
    icon: "text-yellow-500",
    title: "text-yellow-800",
    text: "text-yellow-700",
    button: "bg-yellow-600 hover:bg-yellow-700",
  },
  error: {
    container: "border-red-200 bg-red-50",
    icon: "text-red-500",
    title: "text-red-800",
    text: "text-red-700",
    button: "bg-red-600 hover:bg-red-700",
  },
  critical: {
    container: "border-red-300 bg-red-100",
    icon: "text-red-600",
    title: "text-red-900",
    text: "text-red-800",
    button: "bg-red-700 hover:bg-red-800",
  },
};

/**
 * 에러 아이콘
 */
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-5 w-5 flex-shrink-0", className)}
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
  );
}

/**
 * 정보 아이콘
 */
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-5 w-5 flex-shrink-0", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * 재시도 아이콘
 */
function RetryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

/**
 * 닫기 아이콘
 */
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function ErrorWithGuideComponent({
  errorCode = PlanGroupErrorCodes.UNKNOWN_ERROR,
  message,
  className,
  onRetry,
  onClose,
  compact = false,
  retryCount = 0,
  maxRetries = 3,
  isRetrying = false,
}: ErrorWithGuideProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const guide = useMemo(() => ErrorActionGuides[errorCode], [errorCode]);
  const defaultMessage = useMemo(() => ErrorUserMessages[errorCode], [errorCode]);
  const displayMessage = message || defaultMessage;
  const styles = severityStyles[guide.severity];

  const IconComponent = guide.severity === "info" ? InfoIcon : ErrorIcon;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        styles.container,
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <IconComponent className={styles.icon} />

        <div className="flex-1 min-w-0">
          {/* 에러 메시지 */}
          <p className={cn("text-sm font-medium", styles.title)}>
            {displayMessage}
          </p>

          {/* 조치 가이드 */}
          {guide.actions.length > 0 && (
            <div className="mt-2">
              {compact && !isExpanded ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className={cn("text-xs underline", styles.text)}
                >
                  해결 방법 보기
                </button>
              ) : (
                <>
                  <p className={cn("text-xs font-medium mb-1", styles.text)}>
                    해결 방법:
                  </p>
                  <ul className="space-y-1">
                    {guide.actions.map((action, index) => (
                      <li
                        key={index}
                        className={cn("text-xs flex items-start gap-1.5", styles.text)}
                      >
                        <span className="mt-1 h-1 w-1 rounded-full bg-current flex-shrink-0" />
                        {action}
                      </li>
                    ))}
                  </ul>
                  {compact && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded(false)}
                      className={cn("text-xs underline mt-1", styles.text)}
                    >
                      접기
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* 지원 요청 안내 */}
          {guide.needsSupport && (
            <p className={cn("mt-2 text-xs", styles.text)}>
              문제가 지속되면 관리자에게 문의해주세요.
            </p>
          )}

          {/* B3 개선: 액션 버튼 - 재시도 상태 표시 */}
          {(guide.canRetry && onRetry) && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying || retryCount >= maxRetries}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-all",
                  styles.button,
                  (isRetrying || retryCount >= maxRetries) && "opacity-50 cursor-not-allowed"
                )}
              >
                <RetryIcon className={cn(isRetrying && "animate-spin")} />
                {isRetrying ? "재시도 중..." : "다시 시도"}
              </button>
              {/* B3 개선: 재시도 횟수 표시 */}
              {retryCount > 0 && (
                <span className={cn("text-xs", styles.text)}>
                  {retryCount >= maxRetries
                    ? `최대 재시도 횟수(${maxRetries}회) 초과`
                    : `재시도 ${retryCount}/${maxRetries}회`
                  }
                </span>
              )}
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-md p-1 transition hover:bg-black/5",
              styles.text
            )}
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

export const ErrorWithGuide = memo(ErrorWithGuideComponent);
export default ErrorWithGuide;
