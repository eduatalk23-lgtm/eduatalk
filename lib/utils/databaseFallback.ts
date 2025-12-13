/**
 * 데이터베이스 컬럼 누락 시 fallback 처리를 위한 유틸리티 함수
 * 
 * PostgreSQL 에러 코드 42703 (undefined_column)을 처리하기 위한 공통 함수
 */

/**
 * 컬럼 누락 에러인지 확인
 */
export function isColumnMissingError(error: any): boolean {
  return error?.code === "42703";
}

/**
 * 컬럼 누락 시 fallback 쿼리를 실행하는 헬퍼 함수
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
  const result = await query();
  
  if (isColumnMissingError(result.error)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[withColumnFallback] ${missingColumn} 컬럼이 없어 fallback 사용`);
    }
    return await fallbackQuery();
  }
  
  return result;
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
      data = assignBlockIndex(fallbackResult.data as any[], (block) => block.day_of_week);
    }
    error = fallbackResult.error;
  }

  return { data, error };
}

