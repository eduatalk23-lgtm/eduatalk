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

