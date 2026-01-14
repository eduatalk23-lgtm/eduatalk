"use client";

/**
 * React Query 무효화 힌트 처리 훅
 *
 * 서버 액션에서 반환된 invalidationHints를 자동으로 처리하여
 * React Query 캐시를 무효화합니다.
 *
 * @module lib/hooks/useInvalidationHandler
 *
 * @example
 * ```tsx
 * const { processHints } = useInvalidationHandler();
 *
 * const handleSubmit = async () => {
 *   const result = await createQuickPlan(input);
 *   if (result.success) {
 *     // 자동으로 캐시 무효화
 *     processHints(result.invalidationHints);
 *   }
 * };
 * ```
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getQueryKeysFromHints,
  type InvalidationHint,
} from "@/lib/query/keys";

/**
 * 무효화 결과 정보
 */
interface InvalidationResult {
  /** 무효화된 쿼리 수 */
  invalidatedCount: number;
  /** 무효화된 쿼리 키 목록 */
  invalidatedKeys: ReadonlyArray<readonly unknown[]>;
}

/**
 * useInvalidationHandler 훅 반환 타입
 */
interface UseInvalidationHandlerReturn {
  /** 힌트 배열을 처리하여 캐시 무효화 */
  processHints: (hints?: InvalidationHint[]) => Promise<InvalidationResult>;
  /** 서버 액션 결과에서 힌트를 추출하여 처리 */
  processResultHints: <T extends { invalidationHints?: InvalidationHint[] }>(
    result: T
  ) => Promise<InvalidationResult>;
}

/**
 * 서버 액션 결과의 invalidationHints를 자동으로 처리하는 훅
 *
 * @returns {UseInvalidationHandlerReturn} 힌트 처리 함수들
 */
export function useInvalidationHandler(): UseInvalidationHandlerReturn {
  const queryClient = useQueryClient();

  /**
   * InvalidationHint 배열을 받아 React Query 캐시를 무효화
   */
  const processHints = useCallback(
    async (hints?: InvalidationHint[]): Promise<InvalidationResult> => {
      if (!hints || hints.length === 0) {
        return { invalidatedCount: 0, invalidatedKeys: [] };
      }

      const queryKeyObjects = getQueryKeysFromHints(hints);
      const invalidatedKeys: Array<readonly unknown[]> = [];

      // 각 쿼리 키에 대해 무효화 실행
      await Promise.all(
        queryKeyObjects.map(async ({ queryKey }) => {
          await queryClient.invalidateQueries({ queryKey });
          invalidatedKeys.push(queryKey);
        })
      );

      return {
        invalidatedCount: invalidatedKeys.length,
        invalidatedKeys,
      };
    },
    [queryClient]
  );

  /**
   * 서버 액션 결과 객체에서 invalidationHints를 추출하여 처리
   */
  const processResultHints = useCallback(
    async <T extends { invalidationHints?: InvalidationHint[] }>(
      result: T
    ): Promise<InvalidationResult> => {
      return processHints(result.invalidationHints);
    },
    [processHints]
  );

  return {
    processHints,
    processResultHints,
  };
}

/**
 * 서버 액션 래퍼: 실행 후 자동으로 캐시 무효화
 *
 * @example
 * ```tsx
 * const { executeWithInvalidation } = useServerActionWithInvalidation(createQuickPlan);
 *
 * const handleSubmit = async () => {
 *   const result = await executeWithInvalidation(input);
 *   if (result.success) {
 *     toast.success("플랜이 생성되었습니다.");
 *   }
 * };
 * ```
 */
export function useServerActionWithInvalidation<
  TResult extends { success: boolean; invalidationHints?: InvalidationHint[] },
  TArgs extends unknown[],
>(
  action: (...args: TArgs) => Promise<TResult>
): {
  executeWithInvalidation: (...args: TArgs) => Promise<TResult>;
} {
  const { processHints } = useInvalidationHandler();

  const executeWithInvalidation = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      const result = await action(...args);

      // 성공 시 자동 캐시 무효화
      if (result.success && result.invalidationHints) {
        await processHints(result.invalidationHints);
      }

      return result;
    },
    [action, processHints]
  );

  return { executeWithInvalidation };
}
