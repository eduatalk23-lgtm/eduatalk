/**
 * 마스터 콘텐츠 관련 유틸리티 함수
 */

/**
 * 콘텐츠가 마스터에서 가져온 것인지 확인
 * 
 * @param item - 콘텐츠 아이템 (master_content_id 또는 master_lecture_id 포함)
 * @returns 마스터에서 가져온 콘텐츠인지 여부
 * 
 * @example
 * ```typescript
 * const isMaster = isFromMaster({ master_content_id: "123" }); // true
 * const isMaster = isFromMaster({ master_lecture_id: "456" }); // true
 * const isMaster = isFromMaster({ master_content_id: null }); // false
 * ```
 */
export function isFromMaster(item: {
  master_content_id?: string | null;
  master_lecture_id?: string | null;
}): boolean {
  return !!(item.master_content_id || item.master_lecture_id);
}

