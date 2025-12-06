"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TenantOption = {
  id: string;
  name: string;
  type: string | null;
};

/**
 * 회원가입용 기관 목록 조회
 * 활성화된 기관만 조회
 * 인증되지 않은 사용자도 접근 가능하도록 Admin 클라이언트 사용 (RLS 우회)
 */
export async function getTenantOptionsForSignup(): Promise<TenantOption[]> {
  // 회원가입 시점에는 인증되지 않은 사용자이므로 Admin 클라이언트 사용
  const adminClient = createSupabaseAdminClient();
  
  if (!adminClient) {
    console.error("[tenants] Admin 클라이언트 생성 실패: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
    return [];
  }

  // status 컬럼이 있는지 확인 후 쿼리 구성
  let query = adminClient
    .from("tenants")
    .select("id, name, type")
    .order("name", { ascending: true });

  // status 컬럼이 있으면 활성화된 기관만 필터링
  try {
    const { error: testError } = await adminClient
      .from("tenants")
      .select("status")
      .limit(1);
    
    if (!testError) {
      // status 컬럼이 있으면 활성화된 기관만 조회
      query = adminClient
        .from("tenants")
        .select("id, name, type")
        .eq("status", "active")
        .order("name", { ascending: true });
    }
  } catch (e) {
    // status 컬럼이 없으면 무시하고 계속 진행
  }

  const { data, error } = await query;

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

