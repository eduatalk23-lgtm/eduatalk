/**
 * Supabase 쿼리 헬퍼 함수
 * 42703 에러 코드 처리 및 일반적인 쿼리 패턴 통합
 */

import type { PostgrestError } from "@supabase/supabase-js";
import type { createSupabaseServerClient } from "../supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * Supabase 쿼리 결과 타입
 */
export type SupabaseQueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

/**
 * 42703 에러 코드를 처리하는 안전한 쿼리 실행
 * 
 * @param queryFn - 메인 쿼리 함수
 * @param fallbackQueryFn - 42703 에러 발생 시 실행할 대체 쿼리 함수
 * @returns 쿼리 결과 데이터 또는 null
 */
export async function safeQuery<T>(
  queryFn: () => Promise<SupabaseQueryResult<T>>,
  fallbackQueryFn?: () => Promise<SupabaseQueryResult<T>>
): Promise<T | null> {
  const result = await queryFn();

  // 42703 에러는 컬럼이 존재하지 않을 때 발생 (마이그레이션 중간 상태)
  if (result.error?.code === "42703" && fallbackQueryFn) {
    const fallback = await fallbackQueryFn();
    if (fallback.error && fallback.error.code !== "PGRST116") {
      // PGRST116은 "no rows returned" 에러이므로 정상적인 경우
      throw fallback.error;
    }
    return fallback.data;
  }

  // PGRST116은 "no rows returned" 에러이므로 정상적인 경우
  if (result.error && result.error.code !== "PGRST116") {
    throw result.error;
  }

  return result.data;
}

/**
 * 여러 쿼리를 병렬로 실행하고 에러를 안전하게 처리
 */
export async function safeQueryAll<T>(
  queries: Array<() => Promise<SupabaseQueryResult<T>>>
): Promise<Array<T | null>> {
  const results = await Promise.allSettled(
    queries.map((queryFn) => safeQuery(queryFn))
  );

  return results.map((result) =>
    result.status === "fulfilled" ? result.value : null
  );
}

/**
 * 쿼리 결과를 변환하는 헬퍼
 */
export function mapQueryResult<T, R>(
  result: SupabaseQueryResult<T>,
  mapper: (data: T) => R
): R | null {
  if (result.error || !result.data) {
    return null;
  }
  return mapper(result.data);
}

/**
 * 단일 레코드 조회 헬퍼
 */
export async function safeSingle<T>(
  queryFn: () => Promise<SupabaseQueryResult<T[]>>
): Promise<T | null> {
  const data = await safeQuery(queryFn);
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }
  return data[0];
}

/**
 * 존재 여부 확인 헬퍼
 */
export async function safeExists(
  queryFn: () => Promise<SupabaseQueryResult<unknown[]>>
): Promise<boolean> {
  const data = await safeQuery(queryFn);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Supabase 조인 결과에서 첫 번째 요소 추출
 * 조인 결과는 배열 또는 단일 객체로 반환될 수 있음
 *
 * @example
 * const student = extractJoinResult(link.students);
 * // link.students가 배열이면 첫 번째 요소 반환
 * // 단일 객체면 그대로 반환
 * // null/undefined면 null 반환
 */
export function extractJoinResult<T>(
  joinResult: T | T[] | null | undefined
): T | null {
  if (joinResult === null || joinResult === undefined) {
    return null;
  }
  if (Array.isArray(joinResult)) {
    return joinResult.length > 0 ? joinResult[0] : null;
  }
  return joinResult;
}

