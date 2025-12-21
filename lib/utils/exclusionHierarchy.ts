/**
 * 제외일 타입 위계 정의 및 유틸리티
 * 
 * 제외일 타입의 위계를 정의하고, 위계 기반 비교 및 병합 로직을 제공합니다.
 * 숫자가 높을수록 더 강한 제외 (자율학습도 불가능)
 */

/**
 * 제외일 타입 위계 정의
 * 숫자가 높을수록 더 강한 제외 (자율학습도 불가능)
 */
export const EXCLUSION_TYPE_HIERARCHY: Record<string, number> = {
  "휴일지정": 1,  // 가장 낮음 - 자율학습 가능
  "기타": 2,
  "개인사정": 3,
  "휴가": 4,      // 가장 높음 - 모든 학습 불가
};

/**
 * 제외일 타입의 위계 반환
 * @param exclusionType 제외일 타입
 * @returns 위계 값 (없으면 0)
 */
export function getExclusionTypeHierarchy(exclusionType: string): number {
  return EXCLUSION_TYPE_HIERARCHY[exclusionType] || 0;
}

/**
 * 두 제외일 중 더 높은 위계의 타입 반환
 * @param type1 첫 번째 제외일 타입
 * @param type2 두 번째 제외일 타입
 * @returns 더 높은 위계의 제외일 타입
 */
export function getHigherPriorityExclusionType(
  type1: string,
  type2: string
): string {
  const hierarchy1 = getExclusionTypeHierarchy(type1);
  const hierarchy2 = getExclusionTypeHierarchy(type2);
  return hierarchy1 > hierarchy2 ? type1 : type2;
}

/**
 * 첫 번째 제외일 타입이 두 번째보다 높은 위계인지 확인
 * @param type1 첫 번째 제외일 타입
 * @param type2 두 번째 제외일 타입
 * @returns type1이 type2보다 높은 위계이면 true
 */
export function isHigherPriorityExclusionType(
  type1: string,
  type2: string
): boolean {
  const hierarchy1 = getExclusionTypeHierarchy(type1);
  const hierarchy2 = getExclusionTypeHierarchy(type2);
  return hierarchy1 > hierarchy2;
}

