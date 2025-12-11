import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Tenant = {
  id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Tenant ID로 Tenant 조회
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,created_at,updated_at")
    .eq("id", tenantId)
    .maybeSingle<Tenant>();

  if (error && error.code !== "PGRST116") {
    console.error("[data/tenants] Tenant 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * 모든 Tenant 목록 조회 (Super Admin용)
 */
export async function listAllTenants(): Promise<Tenant[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[data/tenants] Tenant 목록 조회 실패", error);
    return [];
  }

  return (data as Tenant[] | null) ?? [];
}

/**
 * Tenant 생성
 */
export async function createTenant(
  tenant: { name: string }
): Promise<{ success: boolean; tenantId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenants")
    .insert({ name: tenant.name })
    .select("id")
    .single();

  if (error) {
    console.error("[data/tenants] Tenant 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, tenantId: data?.id };
}

/**
 * Tenant 업데이트
 */
export async function updateTenant(
  tenantId: string,
  updates: { name?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;

  const { error } = await supabase
    .from("tenants")
    .update(payload)
    .eq("id", tenantId);

  if (error) {
    console.error("[data/tenants] Tenant 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 기본 Tenant 조회
 * 회원가입 시 tenant_id가 없을 경우 사용
 */
export async function getDefaultTenant(): Promise<{ id: string } | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: defaultTenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("name", "Default Tenant")
      .maybeSingle<{ id: string }>();

    if (tenantError) {
      // PGRST116은 레코드가 없는 경우이므로 null 반환
      if (tenantError.code === "PGRST116") {
        console.warn("[data/tenants] Default Tenant가 존재하지 않습니다.");
        return null;
      }
      console.error("[data/tenants] Default Tenant 조회 실패", {
        error: tenantError.message,
        code: tenantError.code,
      });
      return null;
    }

    return defaultTenant ?? null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[data/tenants] getDefaultTenant 실패", {
      message: errorMessage,
      error,
    });
    return null;
  }
}

