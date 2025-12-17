/**
 * 타입 안전한 쿼리 빌더
 * 
 * Supabase 쿼리를 타입 안전하게 실행하고, 공통 패턴을 추상화합니다.
 * 2025년 모범 사례를 반영하여 제네릭 타입과 명시적 타입 정의를 활용합니다.
 */

import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseServerClient } from "./types";
import { executeQuery, executeSingleQuery, type QueryOptions } from "./queryBuilder";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

/**
 * 타입 안전한 쿼리 결과
 */
export type TypedQueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

/**
 * 타입 안전한 쿼리 함수 타입
 */
export type TypedQueryFn<T> = () => Promise<TypedQueryResult<T>>;

/**
 * 타입 안전한 쿼리 옵션
 */
export interface TypedQueryOptions<T> extends QueryOptions {
  /**
   * 타입 안전성을 위한 명시적 타입 (선택적)
   * 제네릭으로 추론되지만, 명시적으로 지정할 수 있음
   */
  type?: new () => T;
  /**
   * 타입 가드 함수 (런타임 타입 검증)
   */
  typeGuard?: (data: unknown) => data is T;
}

/**
 * 타입 안전한 쿼리 실행
 * 
 * @example
 * ```typescript
 * const student = await createTypedQuery(
 *   () => supabase
 *     .from("students")
 *     .select("*")
 *     .eq("id", studentId)
 *     .maybeSingle(),
 *   {
 *     context: "[data/students]",
 *     defaultValue: null,
 *   }
 * );
 * ```
 */
export async function createTypedQuery<T>(
  queryFn: TypedQueryFn<T>,
  options: TypedQueryOptions<T> = {}
): Promise<T | null> {
  const { typeGuard, ...queryOptions } = options;

  try {
    const result = await executeQuery<T>(queryFn, queryOptions);

    // 타입 가드가 제공된 경우 런타임 검증
    if (result !== null && typeGuard && !typeGuard(result)) {
      console.warn(
        `${options.context || "[typedQuery]"} 타입 검증 실패`,
        { result, type: typeof result }
      );
      return options.defaultValue as T | null ?? null;
    }

    return result;
  } catch (error) {
    console.error(
      `${options.context || "[typedQuery]"} 쿼리 실행 중 예외 발생`,
      error
    );
    return options.defaultValue as T | null ?? null;
  }
}

/**
 * 타입 안전한 단일 레코드 조회
 * 
 * @example
 * ```typescript
 * const student = await createTypedSingleQuery(
 *   () => supabase
 *     .from("students")
 *     .select("*")
 *     .eq("id", studentId),
 *   {
 *     context: "[data/students]",
 *   }
 * );
 * ```
 */
export async function createTypedSingleQuery<T>(
  queryFn: () => Promise<{ data: T[] | null; error: PostgrestError | null }>,
  options: TypedQueryOptions<T> = {}
): Promise<T | null> {
  const { typeGuard, ...queryOptions } = options;

  try {
    const result = await executeSingleQuery<T>(queryFn, queryOptions);

    // 타입 가드가 제공된 경우 런타임 검증
    if (result !== null && typeGuard && !typeGuard(result)) {
      console.warn(
        `${options.context || "[typedQuery]"} 타입 검증 실패`,
        { result, type: typeof result }
      );
      return options.defaultValue as T | null ?? null;
    }

    return result;
  } catch (error) {
    console.error(
      `${options.context || "[typedQuery]"} 쿼리 실행 중 예외 발생`,
      error
    );
    return options.defaultValue as T | null ?? null;
  }
}

/**
 * 타입 안전한 배치 쿼리 실행
 * 여러 ID에 대한 조회를 한 번의 쿼리로 처리
 * 
 * @example
 * ```typescript
 * const students = await createTypedBatchQuery(
 *   studentIds,
 *   (ids) => supabase
 *     .from("students")
 *     .select("*")
 *     .in("id", ids),
 *   {
 *     context: "[data/students]",
 *     defaultValue: [],
 *   }
 * );
 * ```
 */
export async function createTypedBatchQuery<T>(
  ids: string[],
  queryFn: (ids: string[]) => Promise<{ data: T[] | null; error: PostgrestError | null }>,
  options: TypedQueryOptions<T[]> = {}
): Promise<T[]> {
  if (ids.length === 0) {
    return options.defaultValue as T[] ?? [];
  }

  const { typeGuard, ...queryOptions } = options;

  try {
    const result = await executeQuery<T[]>(
      () => queryFn(ids),
      {
        ...queryOptions,
        defaultValue: [],
      }
    );

    if (!result || !Array.isArray(result)) {
      return options.defaultValue as T[] ?? [];
    }

    // 타입 가드가 제공된 경우 각 항목 검증
    if (typeGuard) {
      const validItems = result.filter((item): item is T => typeGuard(item));
      if (validItems.length !== result.length) {
        console.warn(
          `${options.context || "[typedQuery]"} 일부 항목이 타입 검증 실패`,
          { total: result.length, valid: validItems.length }
        );
      }
      return validItems;
    }

    return result;
  } catch (error) {
    console.error(
      `${options.context || "[typedQuery]"} 배치 쿼리 실행 중 예외 발생`,
      error
    );
    return options.defaultValue as T[] ?? [];
  }
}

/**
 * 타입 안전한 JOIN 쿼리 실행
 * JOIN된 데이터를 타입 안전하게 추출
 * 
 * @example
 * ```typescript
 * const plansWithContent = await createTypedJoinQuery(
 *   () => supabase
 *     .from("student_plan")
 *     .select("*, books(*)")
 *     .eq("student_id", studentId),
 *   {
 *     context: "[data/plans]",
 *     extractJoinedData: (row) => ({
 *       plan: row as Plan,
 *       book: extractJoinedData<Book>(row.books),
 *     }),
 *   }
 * );
 * ```
 */
export interface TypedJoinQueryOptions<T, J = unknown> extends TypedQueryOptions<T> {
  /**
   * JOIN된 데이터 추출 함수
   */
  extractJoinedData?: (row: unknown) => J;
}

export async function createTypedJoinQuery<T, J = unknown>(
  queryFn: TypedQueryFn<T>,
  options: TypedJoinQueryOptions<T, J> = {}
): Promise<Array<T & { joined?: J }>> {
  const { extractJoinedData, ...queryOptions } = options;

  try {
    const result = await executeQuery<T[]>(
      queryFn as TypedQueryFn<T[]>,
      {
        ...queryOptions,
        defaultValue: [],
      }
    );

    if (!result || !Array.isArray(result)) {
      return [];
    }

    // JOIN된 데이터 추출
    if (extractJoinedData) {
      return result.map((row) => ({
        ...row,
        joined: extractJoinedData(row),
      })) as Array<T & { joined?: J }>;
    }

    return result as Array<T & { joined?: J }>;
  } catch (error) {
    console.error(
      `${options.context || "[typedQuery]"} JOIN 쿼리 실행 중 예외 발생`,
      error
    );
    return [];
  }
}

/**
 * 타입 안전한 조건부 쿼리 실행
 * 에러 코드에 따라 다른 쿼리를 실행
 * 
 * @example
 * ```typescript
 * const result = await createTypedConditionalQuery(
 *   () => supabase.from("view_name").select("*"),
 *   {
 *     fallbackQuery: () => supabase.from("table_name").select("*"),
 *     shouldFallback: (error) => ErrorCodeCheckers.isViewNotFound(error),
 *   }
 * );
 * ```
 */
export interface TypedConditionalQueryOptions<T> extends TypedQueryOptions<T> {
  /**
   * Fallback 쿼리 함수
   */
  fallbackQuery?: TypedQueryFn<T>;
  /**
   * Fallback 실행 여부 결정 함수
   */
  shouldFallback?: (error: PostgrestError | null) => boolean;
}

export async function createTypedConditionalQuery<T>(
  queryFn: TypedQueryFn<T>,
  options: TypedConditionalQueryOptions<T> = {}
): Promise<T | null> {
  const { fallbackQuery, shouldFallback, ...queryOptions } = options;

  try {
    const result = await queryFn();

    // 에러가 있고 fallback 조건을 만족하는 경우
    if (result.error && shouldFallback && shouldFallback(result.error)) {
      if (fallbackQuery) {
        console.info(
          `${options.context || "[typedQuery]"} Fallback 쿼리 실행`,
          { errorCode: result.error.code }
        );
        return await createTypedQuery(fallbackQuery, queryOptions);
      }
    }

    // 일반적인 에러 처리
    if (result.error) {
      // 42703 에러는 이미 queryBuilder에서 처리됨
      if (ErrorCodeCheckers.isColumnNotFound(result.error)) {
        if (fallbackQuery) {
          return await createTypedQuery(fallbackQuery, queryOptions);
        }
      }

      // 에러가 있지만 fallback하지 않는 경우
      return options.defaultValue as T | null ?? null;
    }

    return result.data;
  } catch (error) {
    console.error(
      `${options.context || "[typedQuery]"} 조건부 쿼리 실행 중 예외 발생`,
      error
    );
    return options.defaultValue as T | null ?? null;
  }
}

/**
 * 타입 안전한 병렬 쿼리 실행
 * 여러 독립적인 쿼리를 병렬로 실행
 * 
 * @example
 * ```typescript
 * const [students, plans, goals] = await createTypedParallelQueries([
 *   () => supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
 *   () => supabase.from("student_plan").select("*").eq("student_id", studentId),
 *   () => supabase.from("student_goals").select("*").eq("student_id", studentId),
 * ], {
 *   context: "[data/dashboard]",
 * });
 * ```
 */
export async function createTypedParallelQueries<T extends unknown[]>(
  queries: Array<() => Promise<{ data: T[number] | null; error: PostgrestError | null }>>,
  options: TypedQueryOptions<T[number]> = {}
): Promise<Array<T[number] | null>> {
  const results = await Promise.allSettled(
    queries.map((queryFn) => createTypedQuery(queryFn, options))
  );

  return results.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : (options.defaultValue as T[number] | null ?? null)
  );
}

