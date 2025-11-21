import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Admin = {
  id: string;
  tenant_id?: string | null;
  role: "admin" | "consultant";
  created_at?: string | null;
};

/**
 * Admin ID로 Admin 조회
 */
export async function getAdminById(
  adminId: string,
  tenantId?: string | null
): Promise<Admin | null> {
  const supabase = await createSupabaseServerClient();

  const selectAdmin = () =>
    supabase
      .from("admin_users")
      .select("id,tenant_id,role,created_at")
      .eq("id", adminId);

  let query = selectAdmin();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query.maybeSingle<Admin>();

  if (error && error.code === "42703") {
    ({ data, error } = await selectAdmin().maybeSingle<Admin>());
  }

  if (error && error.code !== "PGRST116") {
    console.error("[data/admins] Admin 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * Tenant ID로 Admin 목록 조회
 */
export async function listAdminsByTenant(
  tenantId: string | null
): Promise<Admin[]> {
  const supabase = await createSupabaseServerClient();

  if (!tenantId) {
    return [];
  }

  const selectAdmins = () =>
    supabase
      .from("admin_users")
      .select("id,tenant_id,role,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

  let { data, error } = await selectAdmins();

  if (error && error.code === "42703") {
    ({ data, error } = await selectAdmins());
  }

  if (error) {
    console.error("[data/admins] Admin 목록 조회 실패", error);
    return [];
  }

  return (data as Admin[] | null) ?? [];
}

