import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionWarn, logActionError } from "@/lib/utils/serverActionLogger";

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
  // Admin Client를 우선 사용 (RLS 우회)
  const adminClient = createSupabaseAdminClient();
  const supabase = adminClient || (await createSupabaseServerClient());

  // 전체 기관 수
  const { count: total } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true });

  // status 컬럼이 있는지 확인
  let hasStatusColumn = false;
  try {
    const { error: testError } = await supabase
      .from("tenants")
      .select("status")
      .limit(1);
    
    if (!testError) {
      hasStatusColumn = true;
    }
  } catch (e) {
    // status 컬럼이 없으면 무시
  }

  let active = 0;
  let inactive = 0;
  let suspended = 0;

  if (hasStatusColumn) {
    // 활성 기관 수 (status가 'active'이거나 null인 경우)
    const { count: activeCount, error: activeError } = await supabase
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .or("status.eq.active,status.is.null");

    if (activeError) {
      logActionError("superadminDashboard.getTenantStatistics", `활성 기관 수 조회 실패: ${activeError.message}`);
    } else {
      active = activeCount || 0;
    }

    // 비활성 기관 수
    const { count: inactiveCount, error: inactiveError } = await supabase
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .eq("status", "inactive");

    if (inactiveError) {
      logActionError("superadminDashboard.getTenantStatistics", `비활성 기관 수 조회 실패: ${inactiveError.message}`);
    } else {
      inactive = inactiveCount || 0;
    }

    // 정지된 기관 수
    const { count: suspendedCount, error: suspendedError } = await supabase
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .eq("status", "suspended");

    if (suspendedError) {
      logActionError("superadminDashboard.getTenantStatistics", `정지된 기관 수 조회 실패: ${suspendedError.message}`);
    } else {
      suspended = suspendedCount || 0;
    }
  } else {
    // status 컬럼이 없으면 전체를 활성으로 간주
    active = total || 0;
  }

  return {
    total: total || 0,
    active: active || 0,
    inactive: inactive || 0,
    suspended: suspended || 0,
  };
}

/**
 * 사용자 통계 조회
 * Super Admin은 모든 테넌트의 사용자를 볼 수 있어야 하므로 Admin Client 사용
 */
export async function getUserStatistics(): Promise<UserStatistics> {
  // Admin Client를 우선 사용 (RLS 우회하여 모든 테넌트의 데이터 조회)
  const adminClient = createSupabaseAdminClient();
  const supabase = adminClient || (await createSupabaseServerClient());

  if (!adminClient) {
    logActionWarn("superadminDashboard.getUserStatistics", "Admin Client를 사용할 수 없어 서버 클라이언트로 조회. RLS로 인해 일부 데이터 누락 가능");
  }

  try {
    // 학생 수 (모든 테넌트의 학생)
    const { count: students, error: studentsError } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true });

    if (studentsError) {
      logActionError("superadminDashboard.getUserStatistics", `학생 수 조회 실패: ${studentsError.message}`);
    }

    // 학부모 수 (모든 테넌트의 학부모)
    const { count: parents, error: parentsError } = await supabase
      .from("parent_users")
      .select("*", { count: "exact", head: true });

    if (parentsError) {
      logActionError("superadminDashboard.getUserStatistics", `학부모 수 조회 실패: ${parentsError.message}`);
    }

    // 관리자 수 (admin)
    const { count: admins, error: adminsError } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (adminsError) {
      logActionError("superadminDashboard.getUserStatistics", `관리자 수 조회 실패: ${adminsError.message}`);
    }

    // 컨설턴트 수
    const { count: consultants, error: consultantsError } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "consultant");

    if (consultantsError) {
      logActionError("superadminDashboard.getUserStatistics", `컨설턴트 수 조회 실패: ${consultantsError.message}`);
    }

    // Super Admin 수
    const { count: superadmins, error: superadminsError } = await supabase
      .from("admin_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "superadmin");

    if (superadminsError) {
      logActionError("superadminDashboard.getUserStatistics", `Super Admin 수 조회 실패: ${superadminsError.message}`);
    }

    return {
      students: students || 0,
      parents: parents || 0,
      admins: admins || 0,
      consultants: consultants || 0,
      superadmins: superadmins || 0,
      total: (students || 0) + (parents || 0) + (admins || 0) + (consultants || 0) + (superadmins || 0),
    };
  } catch (error) {
    logActionError("superadminDashboard.getUserStatistics", `사용자 통계 조회 중 오류: ${error instanceof Error ? error.message : String(error)}`);
    return {
      students: 0,
      parents: 0,
      admins: 0,
      consultants: 0,
      superadmins: 0,
      total: 0,
    };
  }
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
    logActionError("superadminDashboard.getRecentTenants", `최근 기관 조회 실패: ${error.message}`);
    return [];
  }

  return data || [];
}

