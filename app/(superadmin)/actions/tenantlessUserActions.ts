"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type TenantlessUser = {
  id: string;
  email: string;
  name: string | null;
  role: "student" | "parent" | "admin" | "consultant";
  userType: "student" | "parent" | "admin";
  created_at: string;
};

/**
 * 테넌트 미할당 사용자 조회
 */
export async function getTenantlessUsers(
  userType?: "student" | "parent" | "admin" | "all"
): Promise<{ success: boolean; data?: TenantlessUser[]; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    return { success: false, error: "Super Admin만 접근할 수 있습니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();

    // Supabase Auth에서 모든 사용자 이메일 조회
    let allAuthUsers: Array<{ id: string; email?: string; user_metadata?: any }> = [];
    if (adminClient) {
      const { data: authData } = await adminClient.auth.admin.listUsers();
      if (authData?.users) {
        allAuthUsers = authData.users.map((u) => ({
          id: u.id,
          email: u.email,
          user_metadata: u.user_metadata,
        }));
      }
    }

    const tenantlessUsers: TenantlessUser[] = [];

    // 1. 학생 조회 (tenant_id IS NULL)
    if (!userType || userType === "student" || userType === "all") {
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, created_at")
        .is("tenant_id", null);

      if (studentsError) {
        console.error("[tenantless-users] 학생 조회 실패", studentsError);
      } else if (students) {
        for (const student of students) {
          const authUser = allAuthUsers.find((u) => u.id === student.id);
          tenantlessUsers.push({
            id: student.id,
            email: authUser?.email || "이메일 없음",
            name: authUser?.user_metadata?.display_name || null,
            role: "student",
            userType: "student",
            created_at: student.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // 2. 학부모 조회 (tenant_id IS NULL)
    if (!userType || userType === "parent" || userType === "all") {
      const { data: parents, error: parentsError } = await supabase
        .from("parent_users")
        .select("id, created_at")
        .is("tenant_id", null);

      if (parentsError) {
        console.error("[tenantless-users] 학부모 조회 실패", parentsError);
      } else if (parents) {
        for (const parent of parents) {
          const authUser = allAuthUsers.find((u) => u.id === parent.id);
          tenantlessUsers.push({
            id: parent.id,
            email: authUser?.email || "이메일 없음",
            name: authUser?.user_metadata?.display_name || null,
            role: "parent",
            userType: "parent",
            created_at: parent.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // 3. 관리자 조회 (tenant_id IS NULL, superadmin 제외)
    if (!userType || userType === "admin" || userType === "all") {
      const { data: admins, error: adminsError } = await supabase
        .from("admin_users")
        .select("id, role, created_at")
        .is("tenant_id", null)
        .neq("role", "superadmin");

      if (adminsError) {
        console.error("[tenantless-users] 관리자 조회 실패", adminsError);
      } else if (admins) {
        for (const admin of admins) {
          const authUser = allAuthUsers.find((u) => u.id === admin.id);
          tenantlessUsers.push({
            id: admin.id,
            email: authUser?.email || "이메일 없음",
            name: authUser?.user_metadata?.display_name || null,
            role: admin.role === "admin" ? "admin" : "consultant",
            userType: "admin",
            created_at: admin.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // 생성일 기준 정렬 (최신순)
    tenantlessUsers.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return { success: true, data: tenantlessUsers };
  } catch (error) {
    console.error("[tenantless-users] 사용자 조회 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "사용자 조회에 실패했습니다.",
    };
  }
}

/**
 * 단일 사용자에 테넌트 할당
 */
export async function assignTenantToUser(
  userId: string,
  tenantId: string,
  userType: "student" | "parent" | "admin"
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    return { success: false, error: "Super Admin만 접근할 수 있습니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 테넌트 존재 확인
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return { success: false, error: "해당 기관을 찾을 수 없습니다." };
    }

    // 사용자 타입에 따라 해당 테이블 업데이트
    let updateError = null;

    if (userType === "student") {
      const { error } = await supabase
        .from("students")
        .update({ tenant_id: tenantId })
        .eq("id", userId);
      updateError = error;
    } else if (userType === "parent") {
      const { error } = await supabase
        .from("parent_users")
        .update({ tenant_id: tenantId })
        .eq("id", userId);
      updateError = error;
    } else if (userType === "admin") {
      const { error } = await supabase
        .from("admin_users")
        .update({ tenant_id: tenantId })
        .eq("id", userId);
      updateError = error;
    }

    if (updateError) {
      console.error(`[tenantless-users] ${userType} 테넌트 할당 실패`, updateError);
      return {
        success: false,
        error: updateError.message || "테넌트 할당에 실패했습니다.",
      };
    }

    revalidatePath("/superadmin/tenantless-users");
    return { success: true };
  } catch (error) {
    console.error("[tenantless-users] 테넌트 할당 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "테넌트 할당에 실패했습니다.",
    };
  }
}

/**
 * 다중 사용자에 테넌트 할당
 */
export async function assignTenantToMultipleUsers(
  userIds: Array<{ userId: string; userType: "student" | "parent" | "admin" }>,
  tenantId: string
): Promise<{ success: boolean; error?: string; assignedCount?: number }> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    return { success: false, error: "Super Admin만 접근할 수 있습니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 테넌트 존재 확인
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return { success: false, error: "해당 기관을 찾을 수 없습니다." };
    }

    let assignedCount = 0;
    const errors: string[] = [];

    for (const { userId, userType } of userIds) {
      let updateError = null;

      if (userType === "student") {
        const { error } = await supabase
          .from("students")
          .update({ tenant_id: tenantId })
          .eq("id", userId);
        updateError = error;
      } else if (userType === "parent") {
        const { error } = await supabase
          .from("parent_users")
          .update({ tenant_id: tenantId })
          .eq("id", userId);
        updateError = error;
      } else if (userType === "admin") {
        const { error } = await supabase
          .from("admin_users")
          .update({ tenant_id: tenantId })
          .eq("id", userId);
        updateError = error;
      }

      if (updateError) {
        errors.push(`${userId}: ${updateError.message}`);
      } else {
        assignedCount++;
      }
    }

    if (errors.length > 0) {
      console.error("[tenantless-users] 일부 사용자 테넌트 할당 실패", errors);
    }

    revalidatePath("/superadmin/tenantless-users");
    return { success: true, assignedCount };
  } catch (error) {
    console.error("[tenantless-users] 일괄 테넌트 할당 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "일괄 테넌트 할당에 실패했습니다.",
    };
  }
}

/**
 * 활성 테넌트 목록 조회 (테넌트 할당용)
 */
export async function getActiveTenants(): Promise<
  { success: boolean; data?: Array<{ id: string; name: string }>; error?: string }
> {
  const { role } = await getCurrentUserRole();

  if (role !== "superadmin") {
    return { success: false, error: "Super Admin만 접근할 수 있습니다." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // status 컬럼이 있으면 활성화된 기관만, 없으면 모두 조회
    let query = supabase.from("tenants").select("id, name").order("name", { ascending: true });

    // status 컬럼이 있는지 확인 후 필터링
    try {
      const { data, error } = await query.eq("status", "active");
      if (!error && data) {
        return {
          success: true,
          data: data.map((t) => ({ id: t.id, name: t.name })),
        };
      }
    } catch (e) {
      // status 컬럼이 없을 수 있으므로 무시하고 전체 조회
    }

    // status 컬럼이 없거나 에러가 발생한 경우 전체 조회
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("[tenantless-users] 테넌트 목록 조회 실패", error);
      return { success: false, error: error.message || "테넌트 목록 조회에 실패했습니다." };
    }

    return {
      success: true,
      data: (data || []).map((t) => ({ id: t.id, name: t.name })),
    };
  } catch (error) {
    console.error("[tenantless-users] 테넌트 목록 조회 중 오류", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "테넌트 목록 조회에 실패했습니다.",
    };
  }
}

