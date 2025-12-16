/**
 * Supabase 쿼리 헬퍼 함수
 * JOIN 결과 처리 및 기타 유틸리티 함수 제공
 */

/**
 * Supabase JOIN 결과에서 첫 번째 항목 추출
 * 배열 또는 단일 객체 모두 처리
 * 
 * @param raw JOIN 결과 (배열, 단일 객체, 또는 null/undefined)
 * @returns 첫 번째 항목 또는 null
 * 
 * @example
 * ```typescript
 * const publisherRaw = (bookData as any).publishers;
 * const publisher = extractJoinedData(publisherRaw);
 * ```
 */
export function extractJoinedData<T>(
  raw: T | T[] | null | undefined
): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

