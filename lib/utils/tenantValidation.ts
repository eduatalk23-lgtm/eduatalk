/**
 * 테넌트 검증 유틸리티
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantValidationResult } from "@/lib/types/tenantUser";

/**
 * 테넌트 존재 여부 확인
 */
export async function validateTenantExists(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantValidationResult> {
  try {
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (error) {
      console.error("[tenantValidation] 테넌트 조회 실패:", error);
      return {
        exists: false,
        error: error.message || "테넌트 조회에 실패했습니다.",
      };
    }

    if (!tenant) {
      return {
        exists: false,
        error: "해당 기관을 찾을 수 없습니다.",
      };
    }

    return { exists: true };
  } catch (error) {
    console.error("[tenantValidation] 테넌트 확인 중 오류:", error);
    return {
      exists: false,
      error:
        error instanceof Error
          ? error.message
          : "테넌트 확인 중 오류가 발생했습니다.",
    };
  }
}

