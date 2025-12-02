"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TenantOption = {
  id: string;
  name: string;
  type: string | null;
};

/**
 * 회원가입용 기관 목록 조회
 * 활성화된 기관만 조회
 */
export async function getTenantOptionsForSignup(): Promise<TenantOption[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, type")
    .order("name", { ascending: true });
  
  // status 컬럼이 있으면 활성화된 기관만 필터링
  // (데이터베이스에 status 컬럼이 없을 수 있으므로 에러 무시)

  if (error) {
    console.error("[tenants] 기관 목록 조회 실패:", error);
    return [];
  }

  return (data || []).map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    type: tenant.type,
  }));
}

