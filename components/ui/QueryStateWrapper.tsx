"use client";

/**
 * React Query 상태 통합 래퍼 컴포넌트
 *
 * 로딩, 에러, 빈 데이터, 성공 상태를 일관된 UI로 처리합니다.
 *
 * @module components/ui/QueryStateWrapper
 */

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ErrorState, type ErrorStateProps } from "./ErrorState";
import { EmptyState, type EmptyStateProps } from "../molecules/EmptyState";
import { LoadingSkeleton, type SkeletonVariant } from "./LoadingSkeleton";

// ============================================
// 타입 정의
// ============================================

export type QueryState = {
  /** 로딩 중 여부 */
  isLoading: boolean;
  /** 에러 객체 */
  error: Error | null;
  /** 데이터 존재 여부 확인 함수 */
  isEmpty?: boolean;
};

export type QueryStateWrapperProps = {
  /** React Query 상태 (useQuery 반환값에서 추출) */
  state: QueryState;
  /** 성공 시 렌더링할 children */
  children: ReactNode;
  /** 로딩 스켈레톤 variant */
  loadingVariant?: SkeletonVariant;
  /** 커스텀 로딩 컴포넌트 */
  loadingComponent?: ReactNode;
  /** 에러 상태 props */
  errorProps?: Partial<ErrorStateProps>;
  /** 커스텀 에러 컴포넌트 */
  errorComponent?: ReactNode;
  /** 빈 상태 props */
  emptyProps?: EmptyStateProps;
  /** 커스텀 빈 상태 컴포넌트 */
  emptyComponent?: ReactNode;
  /** 재시도 함수 */
  onRetry?: () => void;
  /** 래퍼 className */
  className?: string;
  /** 최소 높이 (로딩/에러/빈 상태 시) */
  minHeight?: string;
};

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * React Query 상태에 따른 UI 자동 처리 래퍼
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useQuery({...});
 *
 * return (
 *   <QueryStateWrapper
 *     state={{ isLoading, error, isEmpty: !data?.length }}
 *     loadingVariant="table"
 *     onRetry={refetch}
 *     emptyProps={{
 *       title: "데이터가 없습니다",
 *       description: "새 항목을 추가해보세요.",
 *       actionLabel: "추가하기",
 *       onAction: () => router.push("/add"),
 *     }}
 *   >
 *     <DataTable data={data} />
 *   </QueryStateWrapper>
 * );
 * ```
 */
function QueryStateWrapperComponent({
  state,
  children,
  loadingVariant = "default",
  loadingComponent,
  errorProps,
  errorComponent,
  emptyProps,
  emptyComponent,
  onRetry,
  className,
  minHeight = "min-h-[200px]",
}: QueryStateWrapperProps) {
  const { isLoading, error, isEmpty } = state;

  // 1. 로딩 상태
  if (isLoading) {
    if (loadingComponent) {
      return (
        <div className={cn(minHeight, "flex items-center justify-center", className)}>
          {loadingComponent}
        </div>
      );
    }
    return (
      <div className={cn(minHeight, className)}>
        <LoadingSkeleton variant={loadingVariant} />
      </div>
    );
  }

  // 2. 에러 상태
  if (error) {
    if (errorComponent) {
      return <div className={className}>{errorComponent}</div>;
    }
    return (
      <div className={cn(minHeight, className)}>
        <ErrorState
          title="데이터를 불러올 수 없습니다"
          message={error.message || "잠시 후 다시 시도해주세요."}
          onRetry={onRetry}
          {...errorProps}
        />
      </div>
    );
  }

  // 3. 빈 상태
  if (isEmpty) {
    if (emptyComponent) {
      return <div className={className}>{emptyComponent}</div>;
    }
    if (emptyProps) {
      return (
        <div className={cn(minHeight, className)}>
          <EmptyState {...emptyProps} />
        </div>
      );
    }
    // 기본 빈 상태
    return (
      <div className={cn(minHeight, className)}>
        <EmptyState
          title="데이터가 없습니다"
          description="표시할 내용이 없습니다."
          icon="📭"
        />
      </div>
    );
  }

  // 4. 성공 상태
  return <>{children}</>;
}

export const QueryStateWrapper = memo(QueryStateWrapperComponent);
export default QueryStateWrapper;

// ============================================
// 유틸리티 함수
// ============================================

/**
 * useQuery 반환값에서 QueryState 추출
 */
export function extractQueryState<T>(
  query: {
    isLoading: boolean;
    error: Error | null;
    data: T | undefined;
  },
  isEmptyFn?: (data: T | undefined) => boolean
): QueryState {
  return {
    isLoading: query.isLoading,
    error: query.error,
    isEmpty: isEmptyFn
      ? isEmptyFn(query.data)
      : query.data === undefined ||
        query.data === null ||
        (Array.isArray(query.data) && query.data.length === 0),
  };
}

/**
 * 여러 쿼리의 상태를 결합
 */
export function combineQueryStates(...states: QueryState[]): QueryState {
  return {
    isLoading: states.some((s) => s.isLoading),
    error: states.find((s) => s.error)?.error ?? null,
    isEmpty: states.every((s) => s.isEmpty),
  };
}
