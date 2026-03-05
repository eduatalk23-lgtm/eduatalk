"use server";

/**
 * Custom File Category Server Actions
 * 테넌트별 커스텀 파일 카테고리 CRUD
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { resolveAuthContext } from "@/lib/auth/strategies";
import * as repo from "../repository";
import type { CustomFileCategory } from "../types";

export async function getCustomCategoriesAction(): Promise<CustomFileCategory[]> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return [];
    return repo.getCategoriesByTenant(tenantId);
  } catch {
    return [];
  }
}

/**
 * Get categories for any authenticated user (student/parent/admin)
 */
export async function getMyTenantCategoriesAction(): Promise<CustomFileCategory[]> {
  try {
    const auth = await resolveAuthContext({});
    return repo.getCategoriesByTenant(auth.tenantId);
  } catch {
    return [];
  }
}

export async function createCustomCategoryAction(input: {
  key: string;
  label: string;
}): Promise<{ success: boolean; category?: CustomFileCategory; error?: string }> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!userId || !tenantId) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
    const label = input.label.trim().slice(0, 50);
    if (!key || !label) {
      return { success: false, error: "카테고리 키와 라벨은 필수입니다." };
    }

    // Check for duplicates
    const existing = await repo.getCategoriesByTenant(tenantId);
    if (existing.some((c) => c.key === key)) {
      return { success: false, error: "이미 존재하는 카테고리 키입니다." };
    }

    const category = await repo.insertCategory({
      tenant_id: tenantId,
      key,
      label,
      sort_order: existing.length,
    });

    return { success: true, category };
  } catch (err) {
    console.error("[Categories] createCustomCategory error:", err);
    return { success: false, error: "카테고리 생성 중 오류가 발생했습니다." };
  }
}

export async function deleteCustomCategoryAction(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!userId || !tenantId) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    const ok = await repo.deleteCategory(categoryId);
    if (!ok) return { success: false, error: "삭제에 실패했습니다." };
    return { success: true };
  } catch (err) {
    console.error("[Categories] deleteCustomCategory error:", err);
    return { success: false, error: "삭제 중 오류가 발생했습니다." };
  }
}
