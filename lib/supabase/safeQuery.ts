/**
 * Supabase 안전 쿼리 래퍼
 * 
 * 42703 에러(undefined column) 자동 재시도 및 일관된 에러 처리 제공
 * metrics/goals 모듈에서 반복되는 에러 처리 로직을 추상화
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";

/**
 * Supabase 쿼리 결과 타입
 */
export type SupabaseQueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

/**
 * 쿼리 옵션
 */
export type SafeQueryOptions = {
  /**
   * 컨텍스트 이름 (에러 로깅용)
   */
  context?: string;
  
  /**
   * 42703 에러 발생 시 재시도 여부 (기본값: true)
   */
  retryOnColumnError?: boolean;
  
  /**
   * 에러 발생 시 기본값
   * Note: 제네릭 함수에서 반환 타입과 호환되어야 하므로 any 사용
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any;
};

/**
 * 안전한 쿼리 실행 (배열 반환)
 * 
 * 42703 에러 발생 시 자동으로 재시도 (student_id 필터 제거)
 * 
 * @param queryFn - 메인 쿼리 함수 (student_id 필터 포함)
 * @param fallbackQueryFn - 42703 에러 발생 시 실행할 대체 쿼리 함수 (student_id 필터 제거)
 * @param options - 쿼리 옵션
 * @returns 쿼리 결과 데이터 배열 또는 기본값
 */
export async function safeQueryArray<T>(
  queryFn: () => Promise<SupabaseQueryResult<T[]>>,
  fallbackQueryFn?: () => Promise<SupabaseQueryResult<T[]>>,
  options: SafeQueryOptions = {}
): Promise<T[]> {
  const {
    context = "[safeQuery]",
    retryOnColumnError = true,
    defaultValue = [],
  } = options;

  try {
    let { data, error } = await queryFn();

    // 42703 에러는 컬럼이 존재하지 않을 때 발생 (마이그레이션 중간 상태)
    if (error?.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN && retryOnColumnError) {
      if (fallbackQueryFn) {
        ({ data, error } = await fallbackQueryFn());
      } else {
        // fallback이 없으면 기본 쿼리 재시도 (student_id 필터 제거)
        ({ data, error } = await queryFn());
      }
    }

    if (error) {
      // Supabase 에러 객체의 모든 속성을 명시적으로 로깅
      // PostgrestError는 직렬화 시 빈 객체로 출력될 수 있으므로 각 속성을 명시적으로 추출
      const errorInfo: Record<string, unknown> = {
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      };
      
      // 에러 객체의 추가 속성도 포함 (있는 경우)
      if (error instanceof Error) {
        errorInfo.name = error.name;
        errorInfo.stack = error.stack;
      }
      
      // 원본 에러 객체도 포함 (직렬화 가능한 경우)
      try {
        // PostgrestError의 모든 속성을 명시적으로 추출
        const serialized = JSON.parse(JSON.stringify(error));
        errorInfo.raw = serialized;
      } catch {
        // 직렬화 실패 시 문자열로 변환
        errorInfo.raw = String(error);
      }
      
      console.error(`${context} 쿼리 실패`, {
        code: errorInfo.code,
        message: errorInfo.message,
        details: errorInfo.details,
        hint: errorInfo.hint,
        name: errorInfo.name,
        stack: errorInfo.stack,
        raw: errorInfo.raw,
      });
      return defaultValue;
    }

    return (data as T[] | null) ?? defaultValue;
  } catch (error) {
    // 예외 발생 시 상세 정보 로깅
    const errorInfo: Record<string, unknown> = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    };
    
    try {
      errorInfo.raw = JSON.parse(JSON.stringify(error));
    } catch {
      errorInfo.raw = String(error);
    }
    
    console.error(`${context} 쿼리 예외`, errorInfo);
    return defaultValue;
  }
}

/**
 * 안전한 쿼리 실행 (단일 항목 반환)
 * 
 * @param queryFn - 메인 쿼리 함수
 * @param fallbackQueryFn - 42703 에러 발생 시 실행할 대체 쿼리 함수
 * @param options - 쿼리 옵션
 * @returns 쿼리 결과 데이터 또는 기본값
 */
export async function safeQuerySingle<T>(
  queryFn: () => Promise<SupabaseQueryResult<T>>,
  fallbackQueryFn?: () => Promise<SupabaseQueryResult<T>>,
  options: SafeQueryOptions = {}
): Promise<T | null> {
  const {
    context = "[safeQuery]",
    retryOnColumnError = true,
    defaultValue = null,
  } = options;

  try {
    let { data, error } = await queryFn();

    // 42703 에러는 컬럼이 존재하지 않을 때 발생 (마이그레이션 중간 상태)
    if (error?.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN && retryOnColumnError) {
      if (fallbackQueryFn) {
        ({ data, error } = await fallbackQueryFn());
      } else {
        // fallback이 없으면 기본 쿼리 재시도
        ({ data, error } = await queryFn());
      }
    }

    if (error) {
      // Supabase 에러 객체의 모든 속성을 명시적으로 로깅
      // PostgrestError는 직렬화 시 빈 객체로 출력될 수 있으므로 각 속성을 명시적으로 추출
      const errorInfo: Record<string, unknown> = {
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      };
      
      // 에러 객체의 추가 속성도 포함 (있는 경우)
      if (error instanceof Error) {
        errorInfo.name = error.name;
        errorInfo.stack = error.stack;
      }
      
      // 원본 에러 객체도 포함 (직렬화 가능한 경우)
      try {
        // PostgrestError의 모든 속성을 명시적으로 추출
        const serialized = JSON.parse(JSON.stringify(error));
        errorInfo.raw = serialized;
      } catch {
        // 직렬화 실패 시 문자열로 변환
        errorInfo.raw = String(error);
      }
      
      console.error(`${context} 쿼리 실패`, {
        code: errorInfo.code,
        message: errorInfo.message,
        details: errorInfo.details,
        hint: errorInfo.hint,
        name: errorInfo.name,
        stack: errorInfo.stack,
        raw: errorInfo.raw,
      });
      return defaultValue;
    }

    return (data as T | null) ?? defaultValue;
  } catch (error) {
    // 예외 발생 시 상세 정보 로깅
    const errorInfo: Record<string, unknown> = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    };
    
    try {
      errorInfo.raw = JSON.parse(JSON.stringify(error));
    } catch {
      errorInfo.raw = String(error);
    }
    
    console.error(`${context} 쿼리 예외`, errorInfo);
    return defaultValue;
  }
}

/**
 * 안전한 쿼리 실행 (maybeSingle 사용)
 * 
 * @param queryFn - 메인 쿼리 함수
 * @param fallbackQueryFn - 42703 에러 발생 시 실행할 대체 쿼리 함수
 * @param options - 쿼리 옵션
 * @returns 쿼리 결과 데이터 또는 기본값
 */
export async function safeQueryMaybeSingle<T>(
  queryFn: () => Promise<SupabaseQueryResult<T>>,
  fallbackQueryFn?: () => Promise<SupabaseQueryResult<T>>,
  options: SafeQueryOptions = {}
): Promise<T | null> {
  return safeQuerySingle(queryFn, fallbackQueryFn, options);
}

