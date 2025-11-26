import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TenantContext = {
  tenantId: string | null;
  role: "superadmin" | "admin" | "consultant" | "parent" | "student" | null;
  userId: string | null;
};

/**
 * 현재 로그인한 사용자의 tenant context를 조회합니다.
 * 
 * @returns {Promise<TenantContext | null>} tenantId, role, userId를 포함한 객체
 * 
 * 규칙:
 * - Super Admin: tenantId = null, role = 'superadmin'
 * - Admin/Consultant: tenantId = 해당 기관 ID, role = 'admin' | 'consultant'
 * - Parent: tenantId = 해당 기관 ID, role = 'parent'
 * - Student: tenantId = 해당 기관 ID, role = 'student'
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // 1. admin_users 테이블에서 조회 (최우선 - superadmin 확인)
    const selectAdmin = () =>
      supabase
        .from("admin_users")
        .select("id,role,tenant_id")
        .eq("id", user.id)
        .maybeSingle();

    let { data: admin, error: adminError } = await selectAdmin();

    if (adminError && adminError.code === "42703") {
      // fallback: 컬럼이 없는 경우
      const fallbackSelect = () =>
        supabase
          .from("admin_users")
          .select("id,role")
          .eq("id", user.id)
          .maybeSingle<{ id: string; role?: string }>();
      const fallbackResult = await fallbackSelect();
      admin = fallbackResult.data;
    }

    if (adminError && adminError.code !== "PGRST116" && adminError.code !== "42703") {
      console.error("[tenant] admin_users 조회 실패", adminError);
    }

    // Super Admin인 경우
    if (admin && admin.role === "superadmin") {
      return {
        tenantId: null,
        role: "superadmin",
        userId: user.id,
      };
    }

    // Admin/Consultant인 경우
    if (admin) {
      return {
        tenantId: (admin as { tenant_id?: string | null })?.tenant_id ?? null,
        role: admin.role === "admin" || admin.role === "consultant" ? admin.role : "admin",
        userId: user.id,
      };
    }

    // 2. students 테이블에서 조회 (tenant_id 포함)
    const selectStudent = () =>
      supabase
        .from("students")
        .select("id,tenant_id")
        .eq("id", user.id)
        .maybeSingle();

    let { data: student, error: studentError } = await selectStudent();

    if (studentError && studentError.code === "42703") {
      // fallback: tenant_id 컬럼이 없는 경우
      const fallbackSelect = () =>
        supabase
          .from("students")
          .select("id")
          .eq("id", user.id)
          .maybeSingle<{ id: string }>();
      const fallbackResult = await fallbackSelect();
      const fallbackStudent = fallbackResult.data;
      
      if (fallbackStudent) {
        return {
          tenantId: null, // tenant_id 컬럼이 없는 경우
          role: "student",
          userId: user.id,
        };
      }
    }

    if (studentError && studentError.code !== "PGRST116") {
      console.error("[tenant] students 조회 실패", studentError);
    }

    if (student) {
      return {
        tenantId: (student as { tenant_id?: string | null })?.tenant_id ?? null,
        role: "student",
        userId: user.id,
      };
    }

    // 어떤 테이블에도 없으면 null 반환
    return null;
  } catch (error) {
    console.error("[tenant] getTenantContext 실패", error);
    return null;
  }
}

/**
 * 현재 사용자가 Super Admin인지 확인합니다.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const context = await getTenantContext();
  return context?.role === "superadmin";
}

/**
 * 현재 사용자가 특정 tenant에 접근 권한이 있는지 확인합니다.
 */
export async function hasTenantAccess(tenantId: string | null): Promise<boolean> {
  const context = await getTenantContext();
  
  if (!context) {
    return false;
  }

  // Super Admin은 모든 tenant 접근 가능
  if (context.role === "superadmin") {
    return true;
  }

  // 같은 tenant_id를 가진 경우만 접근 가능
  return context.tenantId === tenantId;
}

