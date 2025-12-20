import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTypedQuery,
  createTypedSingleQuery,
} from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import type { Database } from "@/lib/supabase/database.types";

// Database 타입에서 테이블 타입 추출
type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];
type TenantInsert = Database["public"]["Tables"]["tenants"]["Insert"];
type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

export type Tenant = TenantRow;

/**
 * Tenant ID로 Tenant 조회
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const supabase = await createSupabaseServerClient();

  return await createTypedSingleQuery<Tenant>(
    async () => {
      const queryResult = await supabase
        .from("tenants")
        .select("id,name,created_at,updated_at")
        .eq("id", tenantId);

      return {
        data: queryResult.data as Tenant[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/tenants] getTenantById",
      defaultValue: null,
    }
  );
}

/**
 * 모든 Tenant 목록 조회 (Super Admin용)
 */
export async function listAllTenants(): Promise<Tenant[]> {
  const supabase = await createSupabaseServerClient();

  return await createTypedQuery<Tenant[]>(
    async () => {
      const queryResult = await supabase
        .from("tenants")
        .select("id,name,created_at,updated_at")
        .order("created_at", { ascending: false });

      return {
        data: queryResult.data as Tenant[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/tenants] listAllTenants",
      defaultValue: [],
    }
  ) ?? [];
}

/**
 * Tenant 생성
 */
export async function createTenant(
  tenant: { name: string }
): Promise<{ success: boolean; tenantId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedSingleQuery<{ id: string }>(
    async () => {
      const queryResult = await supabase
        .from("tenants")
        .insert({ name: tenant.name } as TenantInsert)
        .select("id")
        .single();

      return {
        data: queryResult.data ? [queryResult.data] : null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/tenants] createTenant",
      defaultValue: null,
    }
  );

  if (!result) {
    return { success: false, error: "Tenant 생성 실패" };
  }

  return { success: true, tenantId: result.id };
}

/**
 * Tenant 업데이트
 */
export async function updateTenant(
  tenantId: string,
  updates: { name?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: TenantUpdate = {};
  if (updates.name !== undefined) {
    payload.name = updates.name;
  }

  const queryResult = await supabase
    .from("tenants")
    .update(payload)
    .eq("id", tenantId);

  if (queryResult.error) {
    handleQueryError(queryResult.error, {
      context: "[data/tenants] updateTenant",
    });
    return { success: false, error: queryResult.error.message };
  }

  return { success: true };
}

/**
 * 기본 Tenant 조회
 * 회원가입 시 tenant_id가 없을 경우 사용
 */
export async function getDefaultTenant(): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();

  return await createTypedSingleQuery<{ id: string }>(
    async () => {
      const queryResult = await supabase
        .from("tenants")
        .select("id")
        .eq("name", "Default Tenant");

      return {
        data: queryResult.data as { id: string }[] | null,
        error: queryResult.error,
      };
    },
    {
      context: "[data/tenants] getDefaultTenant",
      defaultValue: null,
    }
  );
}

