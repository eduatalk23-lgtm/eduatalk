import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 현재 로그인한 사용자의 tenant 정보를 조회합니다.
 * 
 * @returns {Promise<{ name: string; type?: string } | null>} tenant 정보 (name, type) 또는 null
 * 
 * 규칙:
 * - Super Admin: null 반환 (tenant_id가 null)
 * - Admin/Consultant: 해당 기관 정보 반환
 * - Parent: 해당 기관 정보 반환
 * - Student: 해당 기관 정보 반환
 * - 로그인하지 않은 사용자: null 반환
 */
export async function getTenantInfo(): Promise<{
  name: string;
  type?: string;
} | null> {
  try {
    const tenantContext = await getTenantContext();

    // tenant_id가 없으면 null 반환 (Super Admin 또는 로그인하지 않은 사용자)
    if (!tenantContext?.tenantId) {
      return null;
    }

    // tenants 테이블에서 기관 정보 조회
    const supabase = await createSupabaseServerClient();
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("name, type")
      .eq("id", tenantContext.tenantId)
      .maybeSingle();

    if (error) {
      // PGRST116은 레코드가 없는 경우이므로 null 반환
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("[auth] tenant 정보 조회 실패", {
        tenantId: tenantContext.tenantId,
        error: error.message,
        code: error.code,
      });
      return null;
    }

    if (!tenant) {
      return null;
    }

    return {
      name: tenant.name,
      type: tenant.type || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[auth] getTenantInfo 실패", {
      message: errorMessage,
      error,
    });
    return null;
  }
}






