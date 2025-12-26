/**
 * WizardData 비교 유틸리티
 * 
 * 초기 데이터와 현재 데이터를 비교하여 변경 사항을 감지합니다.
 */

import type { WizardData } from "@/lib/schemas/planWizardSchema";

/**
 * 두 WizardData 객체가 동일한지 비교 (깊은 비교)
 * 
 * JSON.stringify를 사용하여 비교하되, 순서에 민감한 필드는 정렬하여 비교합니다.
 * 
 * @param a 첫 번째 WizardData 객체
 * @param b 두 번째 WizardData 객체
 * @returns 동일하면 true, 다르면 false
 */
export function isWizardDataEqual(
  a: Partial<WizardData> | null | undefined,
  b: Partial<WizardData> | null | undefined
): boolean {
  // 둘 다 null/undefined이면 동일
  if (!a && !b) return true;
  
  // 하나만 null/undefined이면 다름
  if (!a || !b) return false;
  
  // 같은 참조면 동일
  if (a === b) return true;
  
  // 정규화된 객체를 생성하여 비교
  const normalizedA = normalizeWizardDataForComparison(a);
  const normalizedB = normalizeWizardDataForComparison(b);
  
  // JSON.stringify로 비교 (순서 문제를 피하기 위해 정규화된 객체 사용)
  return JSON.stringify(normalizedA) === JSON.stringify(normalizedB);
}

/**
 * WizardData를 비교용으로 정규화
 * 
 * 배열 필드를 정렬하고, undefined/null 필드를 제거하여 비교합니다.
 * 
 * @param data 정규화할 WizardData
 * @returns 정규화된 객체
 */
function normalizeWizardDataForComparison(
  data: Partial<WizardData>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  
  // 모든 필드를 순회하며 정규화
  for (const [key, value] of Object.entries(data)) {
    // undefined/null 필드는 제외
    if (value === undefined || value === null) {
      continue;
    }
    
    // 배열 필드는 정렬하여 비교
    if (Array.isArray(value)) {
      normalized[key] = [...value].sort((a, b) => {
        // 객체 배열인 경우 id나 고유 식별자로 정렬
        if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
          const aId = (a as { id?: string }).id || JSON.stringify(a);
          const bId = (b as { id?: string }).id || JSON.stringify(b);
          return aId.localeCompare(bId);
        }
        return String(a).localeCompare(String(b));
      });
    } else if (typeof value === "object") {
      // 중첩 객체는 재귀적으로 정규화
      normalized[key] = normalizeWizardDataForComparison(value as Partial<WizardData>);
    } else {
      normalized[key] = value;
    }
  }
  
  return normalized;
}

/**
 * WizardData가 변경되었는지 확인
 * 
 * @param initial 초기 WizardData
 * @param current 현재 WizardData
 * @returns 변경되었으면 true, 동일하면 false
 */
export function hasWizardDataChanged(
  initial: Partial<WizardData> | null | undefined,
  current: Partial<WizardData> | null | undefined
): boolean {
  return !isWizardDataEqual(initial, current);
}





