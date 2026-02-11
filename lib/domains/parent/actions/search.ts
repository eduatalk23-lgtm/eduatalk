"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { searchParentsByTenant, type ParentSearchItem } from "@/lib/data/parents";

export type SearchParentsResult = {
  success: boolean;
  parents: ParentSearchItem[];
  total: number;
  error?: string;
};

/**
 * 학부모 검색 서버 액션 (관리자 검색 패널용)
 * 쿼리가 없으면 최근 등록순 전체 조회 (limit 50)
 */
export async function searchParentsAction(
  query: string
): Promise<SearchParentsResult> {
  try {
    await requireAdminOrConsultant();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId ?? null;

    const result = await searchParentsByTenant(tenantId, query, 50);

    return {
      success: true,
      parents: result.parents,
      total: result.total,
    };
  } catch (error) {
    return {
      success: false,
      parents: [],
      total: 0,
      error: error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.",
    };
  }
}
