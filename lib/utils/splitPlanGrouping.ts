/**
 * 분할 플랜 그룹화 유틸리티
 *
 * 분할된 플랜(같은 콘텐츠가 여러 시간대로 나뉜 경우)을 그룹화하는
 * 공통 로직을 제공합니다.
 *
 * @module lib/utils/splitPlanGrouping
 */

import { timeToMinutes } from "./time";

// ============================================
// 그룹 키 생성
// ============================================

/**
 * 분할 플랜 그룹화를 위한 표준 키 생성
 *
 * 같은 날짜, 같은 콘텐츠, 같은 범위의 플랜들을 하나의 그룹으로 묶기 위한 키를 생성합니다.
 *
 * @param planDate - 플랜 날짜 (YYYY-MM-DD)
 * @param contentId - 콘텐츠 ID
 * @param rangeStart - 범위 시작 (페이지 또는 시간)
 * @param rangeEnd - 범위 종료 (페이지 또는 시간)
 * @returns 그룹 키 문자열 (date:contentId:rangeStart:rangeEnd)
 *
 * @example
 * ```typescript
 * createSplitPlanGroupKey("2025-01-15", "book-123", 1, 50)
 * // "2025-01-15:book-123:1:50"
 * ```
 */
export function createSplitPlanGroupKey(
  planDate: string,
  contentId: string,
  rangeStart: number | null,
  rangeEnd: number | null
): string {
  return `${planDate}:${contentId}:${rangeStart}:${rangeEnd}`;
}

// ============================================
// 그룹화 함수
// ============================================

/**
 * 플랜 배열을 키 함수 기준으로 그룹화
 *
 * @param plans - 그룹화할 플랜 배열
 * @param keyFn - 각 플랜에서 그룹 키를 추출하는 함수
 * @param filterFn - (선택) 특정 조건의 플랜만 포함하는 필터 함수
 * @returns 그룹 키 → 플랜 배열 Map
 *
 * @example
 * ```typescript
 * // 모든 플랜을 그룹화
 * const groups = groupPlansByKey(plans, p =>
 *   createSplitPlanGroupKey(p.plan_date, p.content_id, p.range_start, p.range_end)
 * );
 *
 * // is_partial=true인 플랜만 그룹화
 * const partialGroups = groupPlansByKey(
 *   plans,
 *   p => createSplitPlanGroupKey(p.plan_date, p.content_id, p.range_start, p.range_end),
 *   p => p.is_partial === true
 * );
 * ```
 */
export function groupPlansByKey<T>(
  plans: T[],
  keyFn: (plan: T) => string,
  filterFn?: (plan: T) => boolean
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const plan of plans) {
    if (filterFn && !filterFn(plan)) continue;

    const key = keyFn(plan);
    const group = groups.get(key) || [];
    group.push(plan);
    groups.set(key, group);
  }

  return groups;
}

// ============================================
// 정렬 함수
// ============================================

/**
 * 플랜 배열을 시간순으로 제자리 정렬 (원본 수정)
 *
 * start_time 기준으로 오름차순 정렬합니다.
 * 원본 배열을 직접 수정합니다.
 *
 * @param plans - 정렬할 플랜 배열 (원본이 수정됨)
 *
 * @example
 * ```typescript
 * sortByStartTimeInPlace(plans);
 * // plans가 09:00 → 10:30 → 14:00 순서로 정렬됨
 * ```
 */
export function sortByStartTimeInPlace<T extends { start_time?: string | null }>(
  plans: T[]
): void {
  plans.sort((a, b) => {
    const aTime = timeToMinutes(a.start_time ?? "00:00");
    const bTime = timeToMinutes(b.start_time ?? "00:00");
    return aTime - bTime;
  });
}
