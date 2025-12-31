/**
 * Supabase 쿼리 헬퍼 함수
 * JOIN 결과 처리 및 기타 유틸리티 함수 제공
 */

import { logActionDebug } from "@/lib/logging/actionLogger";

/**
 * Supabase JOIN 결과에서 첫 번째 항목 추출
 * 배열 또는 단일 객체 모두 처리
 * 타입 안전성을 보장하기 위해 제네릭 타입 사용
 * 
 * @param raw JOIN 결과 (배열, 단일 객체, 또는 null/undefined)
 * @returns 첫 번째 항목 또는 null
 * 
 * @example
 * ```typescript
 * // 타입 안전한 사용
 * const publisherRaw = bookData.publishers;
 * const publisher = extractJoinedData<{ id: string; name: string }>(publisherRaw);
 * 
 * // 배열인 경우
 * const publishers = extractJoinedData<{ id: string; name: string }[]>(publisherRaw);
 * ```
 */
export function extractJoinedData<T>(
  raw: T | T[] | null | undefined
): T | null {
  if (!raw) {
    return null;
  }

  try {
    if (Array.isArray(raw)) {
      return raw.length > 0 ? raw[0] : null;
    }
    return raw;
  } catch (error) {
    // 예상치 못한 타입의 경우 null 반환
    logActionDebug(
      { domain: "utils", action: "extractJoinedData" },
      "Unexpected data type",
      { error }
    );
    return null;
  }
}

/**
 * Supabase JOIN 결과에서 중첩된 JOIN 데이터 추출
 * 예: subjects.subject_groups 같은 중첩 구조 처리
 * 
 * @param raw JOIN 결과 (배열, 단일 객체, 또는 null/undefined)
 * @param nestedKey 중첩된 키 이름
 * @returns 중첩된 데이터의 첫 번째 항목 또는 null
 * 
 * @example
 * ```typescript
 * const subject = extractJoinedData<{ id: string; name: string; subject_groups: Array<{ id: string; name: string }> }>(subjectRaw);
 * const subjectGroup = extractNestedJoinedData(subject?.subject_groups, "subject_groups");
 * ```
 */
export function extractNestedJoinedData<T>(
  raw: T | T[] | null | undefined,
  nestedKey?: string
): T | null {
  return extractJoinedData(raw);
}

