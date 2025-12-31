"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  getRangeRecommendationConfig,
  updateRangeRecommendationConfig,
  resetRangeRecommendationConfig,
} from "@/lib/recommendations/config/configManager";
import type { RangeRecommendationConfig } from "@/lib/recommendations/config/types";
import { revalidatePath } from "next/cache";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 범위 추천 설정 조회
 */
export async function getRangeRecommendationSettingsAction(): Promise<{
  success: boolean;
  config?: RangeRecommendationConfig;
  error?: string;
}> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    return {
      success: false,
      error: "관리자 권한이 필요합니다.",
    };
  }

  const tenantContext = await getTenantContext();

  try {
    const config = await getRangeRecommendationConfig(tenantContext?.tenantId || null);

    return {
      success: true,
      config,
    };
  } catch (error) {
    logActionError(
      { domain: "settings", action: "getRangeRecommendationSettingsAction" },
      error,
      { tenantId: tenantContext?.tenantId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "설정 조회에 실패했습니다.",
    };
  }
}

/**
 * 범위 추천 설정 업데이트
 */
export async function updateRangeRecommendationSettingsAction(
  config: RangeRecommendationConfig
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    return {
      success: false,
      error: "관리자 권한이 필요합니다.",
    };
  }

  const tenantContext = await getTenantContext();

  try {
    const result = await updateRangeRecommendationConfig(
      config,
      tenantContext?.tenantId || null
    );

    if (result.success) {
      revalidatePath("/admin/recommendation-settings");
    }

    return result;
  } catch (error) {
    logActionError(
      { domain: "settings", action: "updateRangeRecommendationSettingsAction" },
      error,
      { tenantId: tenantContext?.tenantId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "설정 업데이트에 실패했습니다.",
    };
  }
}

/**
 * 범위 추천 설정을 기본값으로 재설정
 */
export async function resetRangeRecommendationSettingsAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    return {
      success: false,
      error: "관리자 권한이 필요합니다.",
    };
  }

  const tenantContext = await getTenantContext();

  try {
    const result = await resetRangeRecommendationConfig(
      tenantContext?.tenantId || null
    );

    if (result.success) {
      revalidatePath("/admin/recommendation-settings");
    }

    return result;
  } catch (error) {
    logActionError(
      { domain: "settings", action: "resetRangeRecommendationSettingsAction" },
      error,
      { tenantId: tenantContext?.tenantId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "설정 재설정에 실패했습니다.",
    };
  }
}

