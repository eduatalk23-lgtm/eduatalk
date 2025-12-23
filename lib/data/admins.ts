import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTypedQuery,
  createTypedSingleQuery,
} from "@/lib/data/core/typedQueryBuilder";

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

  return await createTypedSingleQuery<Admin>(
    async () => {
      let query = supabase
        .from("admin_users")
        .select("id,tenant_id,role,created_at")
        .eq("id", adminId);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const queryResult = await query;
      return {
        data: queryResult.data as Admin[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/admins] getAdminById",
      defaultValue: null,
    }
  );
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

  return await createTypedQuery<Admin[]>(
    async () => {
      const queryResult = await supabase
        .from("admin_users")
        .select("id,tenant_id,role,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      return {
        data: queryResult.data as Admin[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/admins] listAdminsByTenant",
      defaultValue: [],
    }
  ) ?? [];
}

