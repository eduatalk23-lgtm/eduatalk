/**
 * 데이터베이스 에러 fallback 처리를 위한 유틸리티 함수
 * 
 * 다양한 에러 타입에 대한 fallback 처리를 지원합니다.
 */

import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

/**
 * 컬럼 누락 에러인지 확인
 * PostgreSQL 에러 코드 42703 (undefined_column)
 * 
 * @deprecated ErrorCodeCheckers.isColumnNotFound 사용 권장
 */
export function isColumnMissingError(error: any): boolean {
  return ErrorCodeCheckers.isColumnNotFound(error);
}

/**
 * View 또는 테이블이 존재하지 않는 에러인지 확인
 * PostgreSQL 에러 코드 PGRST205 (table/view not found in schema cache)
 * 
 * @deprecated ErrorCodeCheckers.isViewNotFound 사용 권장
 */
export function isViewNotFoundError(error: any): boolean {
  return ErrorCodeCheckers.isViewNotFound(error);
}

/**
 * View 존재 여부를 확인하는 헬퍼 함수
 * 
 * @param supabase Supabase 클라이언트
 * @param viewName 확인할 View 이름
 * @returns View 존재 여부
 */
export async function checkViewExists(
  supabase: any,
  viewName: string
): Promise<boolean> {
  try {
    // 간단한 쿼리로 View 존재 여부 확인
    const { error } = await supabase
      .from(viewName)
      .select("1")
      .limit(0);
    
import { POSTGREST_ERROR_CODES } from "@/lib/constants/errorCodes";

    // PGRST205 에러는 View가 없다는 의미
    if (error?.code === POSTGREST_ERROR_CODES.TABLE_VIEW_NOT_FOUND) {
      return false;
    }
    
    // 다른 에러는 View가 존재하지만 다른 문제가 있다는 의미
    // (예: 권한 문제, RLS 정책 등)
    return !error;
  } catch (error) {
    // 예외 발생 시 View가 없다고 간주
    return false;
  }
}

/**
 * 범용 에러 fallback 처리 함수
 * 
 * 에러 판단 로직을 주입받아 다양한 에러 타입에 대응할 수 있습니다.
 * 
 * @param operation 원본 쿼리 함수
 * @param fallbackOperation fallback 쿼리 함수
 * @param shouldFallback 에러 판단 로직 (에러 객체를 받아 boolean 반환)
 * @returns 쿼리 결과
 * 
 * @example
 * ```typescript
 * // 컬럼 누락 에러 처리
 * const result = await withErrorFallback(
 *   () => query(),
 *   () => fallbackQuery(),
 *   isColumnMissingError
 * );
 * 
 * // 커스텀 에러 판단 로직
 * const result = await withErrorFallback(
 *   () => query(),
 *   () => fallbackQuery(),
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";

 *   (error) => error?.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN || error?.code === POSTGRES_ERROR_CODES.UNDEFINED_TABLE
 * );
 * ```
 */
export async function withErrorFallback<T, E = any>(
  operation: () => Promise<{ data: T | null; error: E }>,
  fallbackOperation: () => Promise<{ data: T | null; error: E }>,
  shouldFallback: (error: E) => boolean
): Promise<{ data: T | null; error: E }> {
  const result = await operation();
  
  if (result.error && shouldFallback(result.error)) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[withErrorFallback] Primary query failed, attempting fallback.", {
        error: result.error,
      });
    }
    return await fallbackOperation();
  }
  
  return result;
}

/**
 * 컬럼 누락 시 fallback 쿼리를 실행하는 헬퍼 함수
 * 
 * @deprecated withErrorFallback을 사용하세요. 하위 호환성을 위해 유지됩니다.
 * 
 * @param query 원본 쿼리 함수
 * @param fallbackQuery fallback 쿼리 함수 (컬럼 제외)
 * @param missingColumn 누락된 컬럼 이름 (로깅용)
 * @returns 쿼리 결과
 */
export async function withColumnFallback<T>(
  query: () => Promise<{ data: T | null; error: any }>,
  fallbackQuery: () => Promise<{ data: T | null; error: any }>,
  missingColumn: string
): Promise<{ data: T | null; error: any }> {
  return withErrorFallback(
    query,
    fallbackQuery,
    isColumnMissingError
  );
}

/**
 * block_index를 동적으로 할당하는 헬퍼 함수
 * 
 * @param blocks 블록 배열 (start_time 필수)
 * @param groupBy 그룹화 함수 (예: day_of_week별로 그룹화)
 * @returns block_index가 할당된 블록 배열
 */
export function assignBlockIndex<T extends { start_time: string }>(
  blocks: T[],
  groupBy?: (block: T) => number
): Array<T & { block_index: number }> {
  if (blocks.length === 0) {
    return [];
  }

  // 그룹화가 필요한 경우
  if (groupBy) {
    const blocksByGroup = new Map<number, T[]>();
    blocks.forEach((block) => {
      const groupKey = groupBy(block);
      if (!blocksByGroup.has(groupKey)) {
        blocksByGroup.set(groupKey, []);
      }
      blocksByGroup.get(groupKey)!.push(block);
    });

    return Array.from(blocksByGroup.entries()).flatMap(([_, groupBlocks]) =>
      groupBlocks
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map((block, index) => ({
          ...block,
          block_index: index + 1,
        }))
    );
  }

  // 그룹화가 필요 없는 경우 (전체를 하나의 그룹으로 처리)
  return blocks
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((block, index) => ({
      ...block,
      block_index: index + 1,
    }));
}

/**
 * student_block_schedule 조회 시 block_index fallback 처리
 * 
 * @param queryClient Supabase 클라이언트
 * @param filters 조회 필터
 * @returns 블록 데이터 (block_index 포함)
 */
export async function fetchBlocksWithFallback(
  queryClient: any,
  filters: {
    block_set_id?: string | null;
    student_id: string;
    day_of_week?: number;
  }
): Promise<{
  data: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    block_index: number;
  }> | null;
  error: any;
}> {
  const baseQuery = queryClient
    .from("student_block_schedule")
    .select("id, day_of_week, start_time, end_time, block_index")
    .eq("student_id", filters.student_id);

  if (filters.block_set_id) {
    baseQuery.eq("block_set_id", filters.block_set_id);
  }
  if (filters.day_of_week !== undefined) {
    baseQuery.eq("day_of_week", filters.day_of_week);
  }

  let { data, error } = await baseQuery;

  // block_index 컬럼이 없는 경우 fallback
  if (isColumnMissingError(error)) {
    const fallbackQuery = queryClient
      .from("student_block_schedule")
      .select("id, day_of_week, start_time, end_time")
      .eq("student_id", filters.student_id);

    if (filters.block_set_id) {
      fallbackQuery.eq("block_set_id", filters.block_set_id);
    }
    if (filters.day_of_week !== undefined) {
      fallbackQuery.eq("day_of_week", filters.day_of_week);
    }

    fallbackQuery
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    const fallbackResult = await fallbackQuery;

    if (fallbackResult.data) {
      // day_of_week별로 그룹화하여 block_index 재할당
      type BlockWithDayOfWeek = { day_of_week: number; start_time: string; [key: string]: unknown };
      data = assignBlockIndex(fallbackResult.data as BlockWithDayOfWeek[], (block) => block.day_of_week);
    }
    error = fallbackResult.error;
  }

  return { data, error };
}

