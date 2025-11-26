/**
 * Supabase 쿼리 빌더 래퍼
 * 일관된 쿼리 패턴을 제공하는 헬퍼 함수들
 */

import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseServerClient } from "./types";
import { handleQueryError, isColumnNotFoundError } from "./errorHandler";

/**
 * 쿼리 빌더 타입
 */
export type QueryBuilder<T> = PostgrestQueryBuilder<
  unknown,
  T,
  unknown[],
  unknown,
  unknown
>;

/**
 * 쿼리 실행 옵션
 */
export type QueryOptions = {
  /**
   * 에러 발생 시 기본 반환값
   */
  defaultValue?: unknown;
  /**
   * 에러 로깅 컨텍스트
   */
  context?: string;
  /**
   * Fallback 쿼리 함수 (42703 에러 발생 시 사용)
   */
  fallbackQuery?: () => Promise<{ data: unknown; error: PostgrestError | null }>;
};

/**
 * 안전한 쿼리 실행
 * 
 * @param queryFn - 실행할 쿼리 함수
 * @param options - 쿼리 옵션
 * @returns 쿼리 결과 데이터 또는 기본값
 */
export async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  options: QueryOptions = {}
): Promise<T | null> {
  const { defaultValue = null, context = "[data]", fallbackQuery } = options;

  try {
    const { data, error } = await queryFn();

    if (error) {
      // 42703 에러는 컬럼이 없는 경우이므로 fallback이 있으면 사용
      if (isColumnNotFoundError(error)) {
        if (fallbackQuery) {
          const fallbackResult = await fallbackQuery();
          if (!fallbackResult.error) {
            return (fallbackResult.data as T | null) ?? (defaultValue as T | null);
          }
        }
      }

      handleQueryError(error, {
        context,
      });
      return defaultValue as T | null;
    }

    return data ?? (defaultValue as T | null);
  } catch (error) {
    handleQueryError(error as PostgrestError, {
      context,
    });
    return defaultValue as T | null;
  }
}

/**
 * 단일 레코드 조회
 */
export async function executeSingleQuery<T>(
  queryFn: () => Promise<{ data: T[] | null; error: PostgrestError | null }>,
  options: QueryOptions = {}
): Promise<T | null> {
  const result = await executeQuery<T[]>(queryFn, options);
  if (!result || !Array.isArray(result) || result.length === 0) {
    return null;
  }
  return result[0];
}

/**
 * 여러 쿼리를 병렬로 실행
 */
export async function executeQueriesParallel<T>(
  queries: Array<() => Promise<{ data: T | null; error: PostgrestError | null }>>,
  options: QueryOptions = {}
): Promise<Array<T | null>> {
  const results = await Promise.allSettled(
    queries.map((queryFn) => executeQuery(queryFn, options))
  );

  return results.map((result) =>
    result.status === "fulfilled" ? result.value : (options.defaultValue as T | null)
  );
}

