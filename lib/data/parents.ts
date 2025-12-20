import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTypedQuery,
  createTypedSingleQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";

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

  return await createTypedSingleQuery<Parent>(
    async () => {
      let query = supabase
        .from("parent_users")
        .select("id,tenant_id,created_at")
        .eq("id", parentId);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const queryResult = await query;
      return {
        data: queryResult.data as Parent[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/parents] getParentById",
      defaultValue: null,
    }
  );
}

/**
 * Tenant ID로 Parent 목록 조회
 */
export async function listParentsByTenant(
  tenantId: string | null
): Promise<Parent[]> {
  if (!tenantId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  return await createTypedQuery<Parent[]>(
    async () => {
      const queryResult = await supabase
        .from("parent_users")
        .select("id,tenant_id,created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      return {
        data: queryResult.data as Parent[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/parents] listParentsByTenant",
      defaultValue: [],
    }
  ) ?? [];
}

