import { createSupabaseServerClient } from "@/lib/supabase/server";
import { flattenUserProfile, USER_PROFILE_JOIN } from "@/lib/data/helpers/withUserProfile";

export type Admin = {
  id: string;
  name: string;
  tenant_id?: string | null;
  role: "admin" | "consultant";
  created_at?: string | null;
};

/** admin_users 고유 필드 (공통 필드는 user_profiles JOIN) */
const ADMIN_SELECT_FIELDS = `id,tenant_id,role,created_at,${USER_PROFILE_JOIN}`;

/**
 * Admin ID로 Admin 조회
 */
export async function getAdminById(
  adminId: string,
  tenantId?: string | null
): Promise<Admin | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("admin_users")
    .select(ADMIN_SELECT_FIELDS)
    .eq("id", adminId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;
  return flattenUserProfile(data) as unknown as Admin;
}

/**
 * Tenant ID로 Admin 목록 조회
 */
export async function listAdminsByTenant(
  tenantId: string | null
): Promise<Admin[]> {
  if (!tenantId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("admin_users")
    .select(ADMIN_SELECT_FIELDS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(
    (row) => flattenUserProfile(row) as unknown as Admin
  );
}

