import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/utils/serverActionLogger";

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
 * 
 * React의 cache 함수를 사용하여 동일한 요청 내에서 중복 호출을 방지합니다.
 * (Next.js Request Memoization 활용)
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
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

    const { data: initialAdmin, error: adminError } = await selectAdmin();
    let admin = initialAdmin;

    if (adminError && adminError.code === "42703") {
      // fallback: 컬럼이 없는 경우
      const fallbackSelect = () =>
        supabase
          .from("admin_users")
          .select("id,role")
          .eq("id", user.id)
          .maybeSingle<{ id: string; role?: string; tenant_id?: string | null }>();
      const fallbackResult = await fallbackSelect();
      admin = fallbackResult.data ? { ...fallbackResult.data, tenant_id: null, role: fallbackResult.data.role || undefined } : null;
    }

    if (adminError && adminError.code !== "PGRST116" && adminError.code !== "42703") {
      logActionError("tenant.getTenantContext", `admin_users 조회 실패: ${adminError.message}`);
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

    const { data: student, error: studentError } = await selectStudent();

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
      logActionError("tenant.getTenantContext", `students 조회 실패: ${studentError.message}`);
    }

    if (student) {
      return {
        tenantId: (student as { tenant_id?: string | null })?.tenant_id ?? null,
        role: "student",
        userId: user.id,
      };
    }

    // 3. parent_users 테이블에서 조회
    const selectParent = () =>
      supabase
        .from("parent_users")
        .select("id,tenant_id")
        .eq("id", user.id)
        .maybeSingle();

    const { data: parent, error: parentError } = await selectParent();

    if (parentError && parentError.code === "42703") {
      // fallback: tenant_id 컬럼이 없는 경우
      const fallbackSelect = () =>
        supabase
          .from("parent_users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle<{ id: string }>();
      const fallbackResult = await fallbackSelect();
      const fallbackParent = fallbackResult.data;

      if (fallbackParent) {
        return {
          tenantId: null, // tenant_id 컬럼이 없는 경우
          role: "parent",
          userId: user.id,
        };
      }
    }

    if (parentError && parentError.code !== "PGRST116") {
      logActionError("tenant.getTenantContext", `parent_users 조회 실패: ${parentError.message}`);
    }

    if (parent) {
      return {
        tenantId: (parent as { tenant_id?: string | null })?.tenant_id ?? null,
        role: "parent",
        userId: user.id,
      };
    }

    // 어떤 테이블에도 없으면 null 반환
    return null;
  } catch (error) {
    logActionError("tenant.getTenantContext", `실패: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
});

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

