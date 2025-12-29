"use client";

/**
 * BatchOperationStatus - 배치 작업 상태 표시
 *
 * 배치 작업의 진행 상황과 결과를 표시하는 컴포넌트
 *
 * @module lib/wizard/components/admin/BatchOperationStatus
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import type { BatchOperationResult } from "../../types";

// ============================================
// 타입 정의
// ============================================

export interface BatchOperationStatusProps {
  /** 작업 이름 */
  operationName: string;
  /** 작업 결과 */
  result: BatchOperationResult | null;
  /** 진행 중 여부 */
  isLoading?: boolean;
  /** 추가 클래스명 */
  className?: string;
}

export interface BatchOperationsSummaryProps {
  /** 작업 결과 목록 */
  operations: Array<{
    name: string;
    result: BatchOperationResult | null;
    isLoading?: boolean;
  }>;
  /** 추가 클래스명 */
  className?: string;
}

// ============================================
// 단일 작업 상태
// ============================================

/**
 * BatchOperationStatus
 *
 * 단일 배치 작업의 상태를 표시
 */
export const BatchOperationStatus = memo(function BatchOperationStatus({
  operationName,
  result,
  isLoading = false,
  className,
}: BatchOperationStatusProps) {
  // 로딩 중
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20",
          className
        )}
      >
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-blue-500 motion-safe:animate-spin dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-blue-800 dark:text-blue-200">
            {operationName}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-300">처리 중...</p>
        </div>
      </div>
    );
  }

  // 결과 없음
  if (!result) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800",
          className
        )}
      >
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {operationName}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">대기 중</p>
        </div>
      </div>
    );
  }

  // 성공
  if (result.success && result.failureCount === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20",
          className
        )}
      >
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-green-500 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-green-800 dark:text-green-200">
            {operationName}
          </p>
          <p className="text-sm text-green-600 dark:text-green-300">
            {result.successCount}건 완료
          </p>
        </div>
      </div>
    );
  }

  // 부분 성공
  if (result.success && result.failureCount > 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              {operationName}
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-300">
              성공: {result.successCount}건, 실패: {result.failureCount}건
            </p>
          </div>
        </div>

        {result.errors && result.errors.length > 0 && (
          <div className="mt-3 space-y-1">
            {result.errors.slice(0, 3).map((error, index) => (
              <p
                key={index}
                className="text-xs text-yellow-700 dark:text-yellow-300"
              >
                - {error.error}
              </p>
            ))}
            {result.errors.length > 3 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                외 {result.errors.length - 3}건...
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // 실패
  return (
    <div
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-500 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-medium text-red-800 dark:text-red-200">
            {operationName}
          </p>
          <p className="text-sm text-red-600 dark:text-red-300">
            {result.failureCount}건 실패
          </p>
        </div>
      </div>

      {result.errors && result.errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {result.errors.slice(0, 5).map((error, index) => (
            <p key={index} className="text-xs text-red-700 dark:text-red-300">
              - {error.error}
            </p>
          ))}
          {result.errors.length > 5 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              외 {result.errors.length - 5}건...
            </p>
          )}
        </div>
      )}
    </div>
  );
});

// ============================================
// 배치 작업 요약
// ============================================

/**
 * BatchOperationsSummary
 *
 * 여러 배치 작업의 결과를 요약하여 표시
 */
export const BatchOperationsSummary = memo(function BatchOperationsSummary({
  operations,
  className,
}: BatchOperationsSummaryProps) {
  const totalSuccess = operations.reduce(
    (sum, op) => sum + (op.result?.successCount || 0),
    0
  );
  const totalFailure = operations.reduce(
    (sum, op) => sum + (op.result?.failureCount || 0),
    0
  );
  const isAllComplete = operations.every(
    (op) => !op.isLoading && op.result !== null
  );
  const hasErrors = totalFailure > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* 요약 헤더 */}
      <div
        className={cn(
          "rounded-lg p-4",
          isAllComplete && !hasErrors
            ? "bg-green-50 dark:bg-green-900/20"
            : isAllComplete && hasErrors
              ? "bg-yellow-50 dark:bg-yellow-900/20"
              : "bg-blue-50 dark:bg-blue-900/20"
        )}
      >
        <div className="flex items-center justify-between">
          <h3
            className={cn(
              "font-semibold",
              isAllComplete && !hasErrors
                ? "text-green-800 dark:text-green-200"
                : isAllComplete && hasErrors
                  ? "text-yellow-800 dark:text-yellow-200"
                  : "text-blue-800 dark:text-blue-200"
            )}
          >
            {isAllComplete
              ? hasErrors
                ? "일부 작업 완료"
                : "모든 작업 완료"
              : "작업 진행 중..."}
          </h3>
          <div className="text-sm">
            <span className="font-medium text-green-600 dark:text-green-400">
              {totalSuccess} 성공
            </span>
            {totalFailure > 0 && (
              <>
                <span className="mx-1 text-gray-400">/</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  {totalFailure} 실패
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 개별 작업 상태 */}
      <div className="space-y-3">
        {operations.map((operation, index) => (
          <BatchOperationStatus
            key={index}
            operationName={operation.name}
            result={operation.result}
            isLoading={operation.isLoading}
          />
        ))}
      </div>
    </div>
  );
});
