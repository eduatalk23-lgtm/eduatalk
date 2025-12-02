import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TenantStatistics = {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
};

export type UserStatistics = {
  students: number;
  parents: number;
  admins: number;
  consultants: number;
  superadmins: number;
  total: number;
};

export type RecentTenant = {
  id: string;
  name: string;
  type: string;
  created_at: string;
};

/**
 * 기관 통계 조회
 */
export async function getTenantStatistics(): Promise<TenantStatistics> {
  const supabase = await createSupabaseServerClient();

  // 전체 기관 수
  const { count: total } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true });

  // 활성 기관 수
  const { count: active } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // 비활성 기관 수
  const { count: inactive } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("status", "inactive");

  // 정지된 기관 수
  const { count: suspended } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("status", "suspended");

  return {
    total: total || 0,
    active: active || 0,
    inactive: inactive || 0,
    suspended: suspended || 0,
  };
}

/**
 * 사용자 통계 조회
 */
export async function getUserStatistics(): Promise<UserStatistics> {
  const supabase = await createSupabaseServerClient();

  // 학생 수
  const { count: students } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true });

  // 학부모 수
  const { count: parents } = await supabase
    .from("parent_users")
    .select("*", { count: "exact", head: true });

  // 관리자 수 (admin)
  const { count: admins } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  // 컨설턴트 수
  const { count: consultants } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "consultant");

  // Super Admin 수
  const { count: superadmins } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "superadmin");

  return {
    students: students || 0,
    parents: parents || 0,
    admins: admins || 0,
    consultants: consultants || 0,
    superadmins: superadmins || 0,
    total: (students || 0) + (parents || 0) + (admins || 0) + (consultants || 0) + (superadmins || 0),
  };
}

/**
 * 최근 생성된 기관 목록 조회
 */
export async function getRecentTenants(limit: number = 10): Promise<RecentTenant[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, type, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[superadminDashboard] 최근 기관 조회 실패:", error);
    return [];
  }

  return data || [];
}

