import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTypedQuery,
  createTypedSingleQuery,
} from "@/lib/data/core/typedQueryBuilder";

export type Parent = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  tenant_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const PARENT_SELECT = "id,name,phone,email,is_active,tenant_id,created_at,updated_at";

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
        .select(PARENT_SELECT)
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
        .select(PARENT_SELECT)
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

export type ParentSearchItem = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string | null;
  linked_student_count: number;
};

/**
 * 학부모 검색 (이름/전화번호/이메일 ILIKE) + 연결 학생 수 집계
 */
export async function searchParentsByTenant(
  tenantId: string | null,
  query?: string,
  limit = 50
): Promise<{ parents: ParentSearchItem[]; total: number }> {
  if (!tenantId) {
    return { parents: [], total: 0 };
  }

  const supabase = await createSupabaseServerClient();

  let baseQuery = supabase
    .from("parent_users")
    .select("id,name,phone,email,is_active,created_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query && query.trim()) {
    const q = query.trim();
    baseQuery = baseQuery.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, count, error } = await baseQuery;

  if (error || !data) {
    return { parents: [], total: 0 };
  }

  // 연결 학생 수 일괄 조회
  const parentIds = data.map((p: { id: string }) => p.id);
  let linkCountMap = new Map<string, number>();

  if (parentIds.length > 0) {
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("parent_id")
      .in("parent_id", parentIds);

    if (links) {
      for (const link of links) {
        const pid = (link as { parent_id: string }).parent_id;
        linkCountMap.set(pid, (linkCountMap.get(pid) ?? 0) + 1);
      }
    }
  }

  const parents: ParentSearchItem[] = data.map(
    (p: { id: string; name: string | null; phone: string | null; email: string | null; is_active: boolean; created_at: string | null }) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      is_active: p.is_active,
      created_at: p.created_at,
      linked_student_count: linkCountMap.get(p.id) ?? 0,
    })
  );

  return { parents, total: count ?? 0 };
}

/**
 * 학부모 정보 업데이트
 */
export async function updateParentData(
  parentId: string,
  data: { name?: string; phone?: string | null; email?: string | null; is_active?: boolean },
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("parent_users")
    .update(data)
    .eq("id", parentId)
    .eq("tenant_id", tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 학부모 삭제 (연결 학생 있으면 실패)
 */
export async function deleteParentData(
  parentId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 연결 학생 확인
  const { data: links } = await supabase
    .from("parent_student_links")
    .select("id")
    .eq("parent_id", parentId)
    .limit(1);

  if (links && links.length > 0) {
    return { success: false, error: "연결된 학생이 있어 삭제할 수 없습니다. 먼저 학생 연결을 해제해주세요." };
  }

  const { error } = await supabase
    .from("parent_users")
    .delete()
    .eq("id", parentId)
    .eq("tenant_id", tenantId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
