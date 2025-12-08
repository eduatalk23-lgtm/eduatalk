import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Supabase 쿼리 에러 처리 유틸리티
 * 컬럼이 존재하지 않는 경우(42703) 자동 재시도 지원
 */
export async function handleSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  fallback: T,
  options?: { retryOnColumnError?: boolean }
): Promise<T> {
  try {
    let { data, error } = await queryFn();

    // 컬럼이 존재하지 않는 경우 재시도
    if (error?.code === "42703" && options?.retryOnColumnError) {
      // 기본 쿼리로 재시도 (student_id 필터 제거)
      ({ data, error } = await queryFn());
    }

    if (error) {
      console.error("[Supabase Query Error]", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        error,
      });
      return fallback;
    }

    return data ?? fallback;
  } catch (error) {
    console.error("[Supabase Query Exception]", error);
    return fallback;
  }
}

/**
 * Supabase 쿼리 에러 처리 (배열 반환)
 */
export async function handleSupabaseQueryArray<T>(
  queryFn: () => Promise<{ data: T[] | null; error: PostgrestError | null }>,
  fallback: T[] = [],
  options?: { retryOnColumnError?: boolean }
): Promise<T[]> {
  try {
    let { data, error } = await queryFn();

    // 컬럼이 존재하지 않는 경우 재시도
    if (error?.code === "42703" && options?.retryOnColumnError) {
      ({ data, error } = await queryFn());
    }

    if (error) {
      // 에러 객체가 비어있는 경우를 대비한 안전한 로깅
      const errorInfo = {
        code: error?.code || "UNKNOWN",
        message: error?.message || "Unknown error",
        details: error?.details || null,
        hint: error?.hint || null,
        error: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : "Empty error object",
      };
      console.error("[Supabase Query Error]", errorInfo);
      return fallback;
    }

    return data ?? fallback;
  } catch (error) {
    console.error("[Supabase Query Exception]", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return fallback;
  }
}

/**
 * Supabase 쿼리 에러 처리 (단일 항목 반환)
 */
export async function handleSupabaseQuerySingle<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  fallback: T | null = null,
  options?: { retryOnColumnError?: boolean }
): Promise<T | null> {
  try {
    let { data, error } = await queryFn();

    // 컬럼이 존재하지 않는 경우 재시도
    if (error?.code === "42703" && options?.retryOnColumnError) {
      ({ data, error } = await queryFn());
    }

    if (error) {
      // 에러 객체가 비어있는 경우를 대비한 안전한 로깅
      const errorInfo = {
        code: error?.code || "UNKNOWN",
        message: error?.message || "Unknown error",
        details: error?.details || null,
        hint: error?.hint || null,
        error: error || null,
      };
      console.error("[Supabase Query Error]", errorInfo);
      return fallback;
    }

    return data ?? fallback;
  } catch (error) {
    console.error("[Supabase Query Exception]", error);
    return fallback;
  }
}

