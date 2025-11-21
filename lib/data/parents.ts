import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Parent = {
  id: string;
  tenant_id?: string | null;
  created_at?: string | null;
};

/**
 * Parent ID로 Parent 조회
 */
export async function getParentById(
  parentId: string,
  tenantId?: string | null
): Promise<Parent | null> {
  const supabase = await createSupabaseServerClient();

  const selectParent = () =>
    supabase
      .from("parent_users")
      .select("id,tenant_id,created_at")
      .eq("id", parentId);

  let query = selectParent();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query.maybeSingle<Parent>();

  if (error && error.code === "42703") {
    ({ data, error } = await selectParent().maybeSingle<Parent>());
  }

  if (error && error.code !== "PGRST116") {
    console.error("[data/parents] Parent 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * Tenant ID로 Parent 목록 조회
 */
export async function listParentsByTenant(
  tenantId: string | null
): Promise<Parent[]> {
  const supabase = await createSupabaseServerClient();

  if (!tenantId) {
    return [];
  }

  const selectParents = () =>
    supabase
      .from("parent_users")
      .select("id,tenant_id,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

  let { data, error } = await selectParents();

  if (error && error.code === "42703") {
    ({ data, error } = await selectParents());
  }

  if (error) {
    console.error("[data/parents] Parent 목록 조회 실패", error);
    return [];
  }

  return (data as Parent[] | null) ?? [];
}

