"use server";

import { requireAdminOrConsultant, requireAdmin } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { updateParentData, deleteParentData } from "@/lib/data/parents";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 학부모 정보 수정
 */
export async function updateParentInfoAction(
  parentId: string,
  data: { name?: string; phone?: string | null; email?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId;

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const result = await updateParentData(parentId, data, tenantId);

    if (result.success) {
      revalidatePath("/admin/parents");
    }

    return result;
  } catch (error) {
    logActionError(
      { domain: "parent", action: "updateParentInfo" },
      error,
      { parentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "수정 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학부모 활성/비활성 토글
 */
export async function toggleParentStatusAction(
  parentId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId;

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const result = await updateParentData(parentId, { is_active: isActive }, tenantId);

    if (result.success) {
      revalidatePath("/admin/parents");
    }

    return result;
  } catch (error) {
    logActionError(
      { domain: "parent", action: "toggleParentStatus" },
      error,
      { parentId, isActive }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "상태 변경 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학부모 삭제 (admin만, 연결 학생 있으면 거부)
 */
export async function deleteParentAction(
  parentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const tenantContext = await getTenantContext();
    const tenantId = tenantContext?.tenantId;

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const result = await deleteParentData(parentId, tenantId);

    if (result.success) {
      revalidatePath("/admin/parents");
    }

    return result;
  } catch (error) {
    logActionError(
      { domain: "parent", action: "deleteParent" },
      error,
      { parentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.",
    };
  }
}
