import type { AutoApproveSettings, ParentRelation } from "@/lib/domains/tenant";

/**
 * 자동 승인 조건 확인
 * @param settings 자동 승인 설정
 * @param studentTenantId 학생의 테넌트 ID
 * @param parentTenantId 학부모의 테넌트 ID
 * @param relation 요청한 관계
 * @returns 조건 만족 여부
 */
export function checkAutoApproveConditions(
  settings: AutoApproveSettings,
  studentTenantId: string | null,
  parentTenantId: string | null,
  relation: ParentRelation
): boolean {
  // 자동 승인이 비활성화되어 있으면 false
  if (!settings.enabled) {
    return false;
  }

  // sameTenantOnly 조건 확인
  if (settings.conditions.sameTenantOnly) {
    // 학생과 학부모가 같은 테넌트가 아니면 false
    if (studentTenantId !== parentTenantId) {
      return false;
    }
  }

  // allowedRelations 조건 확인
  if (!settings.conditions.allowedRelations.includes(relation)) {
    return false;
  }

  // 모든 조건 만족
  return true;
}

