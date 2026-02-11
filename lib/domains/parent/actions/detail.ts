"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getParentById } from "@/lib/data/parents";

export type ParentDetailData = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ParentDetailResult = {
  success: boolean;
  data?: ParentDetailData;
  error?: string;
};

/**
 * 학부모 상세 조회 서버 액션
 */
export async function getParentDetailAction(
  parentId: string
): Promise<ParentDetailResult> {
  try {
    await requireAdminOrConsultant();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId ?? null;

    const parent = await getParentById(parentId, tenantId);

    if (!parent) {
      return { success: false, error: "학부모 정보를 찾을 수 없습니다." };
    }

    return {
      success: true,
      data: {
        id: parent.id,
        name: parent.name,
        phone: parent.phone,
        email: parent.email,
        is_active: parent.is_active,
        created_at: parent.created_at ?? null,
        updated_at: parent.updated_at ?? null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "조회 중 오류가 발생했습니다.",
    };
  }
}
