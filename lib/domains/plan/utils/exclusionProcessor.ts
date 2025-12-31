/**
 * exclusionProcessor.ts - 제외일 처리 유틸리티
 *
 * 플랜 생성 시 제외일 중복 제거 및 위계 기반 처리를 담당합니다.
 *
 * 위계 (높은 순서):
 * 1. 휴일지정 (가장 높은 우선순위)
 * 2. 휴가
 * 3. 개인사정
 * 4. 기타
 */

import type { ExclusionType } from "@/lib/types/common";

// Re-export for convenience
export type { ExclusionType };

/**
 * 제외일 데이터 타입
 */
export type ExclusionData = {
  exclusion_date: string;
  exclusion_type: ExclusionType;
  reason?: string | null;
};

/**
 * 제외일 타입 위계 (숫자가 높을수록 우선순위 높음)
 */
const EXCLUSION_TYPE_PRIORITY: Record<ExclusionType, number> = {
  휴일지정: 4,
  휴가: 3,
  개인사정: 2,
  기타: 1,
};

/**
 * 두 제외일 타입 중 더 높은 우선순위 타입 반환
 *
 * @param type1 첫 번째 제외일 타입
 * @param type2 두 번째 제외일 타입
 * @returns 더 높은 우선순위를 가진 타입
 */
export function getHigherPriorityExclusionType(
  type1: ExclusionType,
  type2: ExclusionType
): ExclusionType {
  const priority1 = EXCLUSION_TYPE_PRIORITY[type1] ?? 0;
  const priority2 = EXCLUSION_TYPE_PRIORITY[type2] ?? 0;
  return priority1 >= priority2 ? type1 : type2;
}

/**
 * 제외일 목록에서 중복을 제거하고 위계 기반으로 병합
 *
 * 동일한 날짜에 여러 제외일이 있는 경우:
 * - 더 높은 우선순위의 제외일만 유지
 * - 예: "개인일정"과 "지정휴일"이 같은 날 → "지정휴일"만 유지
 *
 * @param exclusions 원본 제외일 목록
 * @param options 옵션
 * @returns 중복 제거된 제외일 목록
 */
export function deduplicateExclusions<T extends ExclusionData>(
  exclusions: T[] | undefined | null,
  options?: {
    /** 캠프 모드에서만 위계 기반 중복 제거 적용 (기본값: true) */
    applyHierarchy?: boolean;
  }
): T[] {
  if (!exclusions || exclusions.length === 0) {
    return [];
  }

  const { applyHierarchy = true } = options ?? {};

  // 위계 적용하지 않는 경우 단순 날짜 기준 중복 제거
  if (!applyHierarchy) {
    const dateSet = new Set<string>();
    const result: T[] = [];

    for (const exclusion of exclusions) {
      if (!dateSet.has(exclusion.exclusion_date)) {
        dateSet.add(exclusion.exclusion_date);
        result.push(exclusion);
      }
    }

    return result;
  }

  // 위계 기반 중복 제거 (Map 사용)
  const exclusionMap = new Map<string, T>();

  for (const exclusion of exclusions) {
    const existing = exclusionMap.get(exclusion.exclusion_date);

    if (existing) {
      // 같은 날짜에 이미 제외일이 있으면 위계 비교
      const higherType = getHigherPriorityExclusionType(
        exclusion.exclusion_type,
        existing.exclusion_type
      );

      // 더 높은 위계의 제외일로 교체
      if (higherType === exclusion.exclusion_type) {
        exclusionMap.set(exclusion.exclusion_date, exclusion);
      }
    } else {
      exclusionMap.set(exclusion.exclusion_date, exclusion);
    }
  }

  return Array.from(exclusionMap.values());
}

/**
 * 제외일 데이터를 DB 저장 형식으로 변환
 *
 * @param exclusions 원본 제외일 목록
 * @returns DB 저장 형식의 제외일 목록
 */
export function formatExclusionsForDb<T extends ExclusionData>(
  exclusions: T[]
): Array<{
  exclusion_date: string;
  exclusion_type: ExclusionType;
  reason: string | null;
}> {
  return exclusions.map((e) => ({
    exclusion_date: e.exclusion_date,
    exclusion_type: e.exclusion_type,
    reason: e.reason || null,
  }));
}
