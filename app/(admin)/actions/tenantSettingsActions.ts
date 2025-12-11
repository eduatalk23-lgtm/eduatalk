"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ParentRelation = "father" | "mother" | "guardian" | "other";

export type AutoApproveSettings = {
  enabled: boolean;
  conditions: {
    sameTenantOnly: boolean;
    allowedRelations: ParentRelation[];
  };
};

/**
 * 테넌트의 자동 승인 설정 조회
 */
export async function getAutoApproveSettings(
  tenantId?: string
): Promise<{
  success: boolean;
  data?: AutoApproveSettings;
  error?: string;
}> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const tenantContext = await getTenantContext();
  const targetTenantId = tenantId || tenantContext?.tenantId;

  if (!targetTenantId) {
    return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", targetTenantId)
      .maybeSingle();

    if (error) {
      console.error(
        "[tenantSettings] 자동 승인 설정 조회 실패",
        error
      );
      return {
        success: false,
        error: error.message || "설정 조회에 실패했습니다.",
      };
    }

    if (!tenant) {
      return { success: false, error: "테넌트를 찾을 수 없습니다." };
    }

    // settings에서 parentLinkAutoApprove 추출
    const settings = tenant.settings as Record<string, unknown> | null;
    const autoApprove = settings?.parentLinkAutoApprove as
      | AutoApproveSettings
      | undefined;

    // 기본값 반환 (설정이 없는 경우)
    const defaultSettings: AutoApproveSettings = {
      enabled: false,
      conditions: {
        sameTenantOnly: true,
        allowedRelations: ["father", "mother"],
      },
    };

    return {
      success: true,
      data: autoApprove || defaultSettings,
    };
  } catch (error) {
    console.error("[tenantSettings] 자동 승인 설정 조회 중 오류", error);
    return {
      success: false,
      error: "설정 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 테넌트의 자동 승인 설정 업데이트
 */
export async function updateAutoApproveSettings(
  settings: AutoApproveSettings,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  // 설정 검증
  if (
    !Array.isArray(settings.conditions.allowedRelations) ||
    settings.conditions.allowedRelations.length === 0
  ) {
    return {
      success: false,
      error: "최소 하나 이상의 관계를 선택해야 합니다.",
    };
  }

  const validRelations: ParentRelation[] = [
    "father",
    "mother",
    "guardian",
    "other",
  ];
  for (const relation of settings.conditions.allowedRelations) {
    if (!validRelations.includes(relation)) {
      return {
        success: false,
        error: `올바르지 않은 관계 값: ${relation}`,
      };
    }
  }

  const tenantContext = await getTenantContext();
  const targetTenantId = tenantId || tenantContext?.tenantId;

  if (!targetTenantId) {
    return { success: false, error: "테넌트 정보를 찾을 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 기존 설정 조회
    const { data: tenant, error: fetchError } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", targetTenantId)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "[tenantSettings] 테넌트 조회 실패",
        fetchError
      );
      return {
        success: false,
        error: "테넌트 정보를 찾을 수 없습니다.",
      };
    }

    if (!tenant) {
      return { success: false, error: "테넌트를 찾을 수 없습니다." };
    }

    // 기존 settings 유지하고 parentLinkAutoApprove만 업데이트
    const currentSettings =
      (tenant.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      parentLinkAutoApprove: settings,
    };

    // 업데이트
    const { error } = await supabase
      .from("tenants")
      .update({ settings: updatedSettings })
      .eq("id", targetTenantId);

    if (error) {
      console.error(
        "[tenantSettings] 자동 승인 설정 업데이트 실패",
        error
      );
      return {
        success: false,
        error: error.message || "설정 업데이트에 실패했습니다.",
      };
    }

    revalidatePath("/admin/tenant/settings");

    return { success: true };
  } catch (error) {
    console.error("[tenantSettings] 자동 승인 설정 업데이트 중 오류", error);
    return {
      success: false,
      error: "설정 업데이트 중 오류가 발생했습니다.",
    };
  }
}

