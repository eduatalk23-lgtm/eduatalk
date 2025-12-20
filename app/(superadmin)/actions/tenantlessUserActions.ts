"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { updateUserTenant, updateMultipleUserTenants } from "@/lib/utils/tenantAssignment";
import { getAuthUserMetadata } from "@/lib/utils/authUserMetadata";

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
    // Super admin은 RLS를 우회하기 위해 Admin 클라이언트 사용
    const adminClient = createSupabaseAdminClient();
    
    if (!adminClient) {
      return {
        success: false,
        error: "Service Role Key가 설정되지 않았습니다. 관리자에게 문의하세요.",
      };
    }

    const tenantlessUsers: TenantlessUser[] = [];
    const userIdsToFetch: string[] = [];

    // 1. 학생 조회 (tenant_id IS NULL) - Admin 클라이언트로 RLS 우회
    if (!userType || userType === "student" || userType === "all") {
      const { data: students, error: studentsError } = await adminClient
        .from("students")
        .select("id, created_at")
        .is("tenant_id", null);

      if (studentsError) {
        console.error("[tenantless-users] 학생 조회 실패", studentsError);
      } else if (students) {
        for (const student of students) {
          userIdsToFetch.push(student.id);
          tenantlessUsers.push({
            id: student.id,
            email: "이메일 없음", // 임시값, 나중에 업데이트
            name: null,
            role: "student",
            userType: "student",
            created_at: student.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // 2. 학부모 조회 (tenant_id IS NULL) - Admin 클라이언트로 RLS 우회
    if (!userType || userType === "parent" || userType === "all") {
      const { data: parents, error: parentsError } = await adminClient
        .from("parent_users")
        .select("id, created_at")
        .is("tenant_id", null);

      if (parentsError) {
        console.error("[tenantless-users] 학부모 조회 실패", parentsError);
      } else if (parents) {
        for (const parent of parents) {
          userIdsToFetch.push(parent.id);
          tenantlessUsers.push({
            id: parent.id,
            email: "이메일 없음", // 임시값, 나중에 업데이트
            name: null,
            role: "parent",
            userType: "parent",
            created_at: parent.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // 3. 관리자 조회 (tenant_id IS NULL, superadmin 제외) - Admin 클라이언트로 RLS 우회
    if (!userType || userType === "admin" || userType === "all") {
      const { data: admins, error: adminsError } = await adminClient
        .from("admin_users")
        .select("id, role, created_at")
        .is("tenant_id", null)
        .neq("role", "superadmin");

      if (adminsError) {
        console.error("[tenantless-users] 관리자 조회 실패", adminsError);
      } else if (admins) {
        for (const admin of admins) {
          userIdsToFetch.push(admin.id);
          tenantlessUsers.push({
            id: admin.id,
            email: "이메일 없음", // 임시값, 나중에 업데이트
            name: null,
            role: admin.role === "admin" ? "admin" : "consultant",
            userType: "admin",
            created_at: admin.created_at || new Date().toISOString(),
          });
        }
      }
    }

    // 최적화된 Auth 사용자 메타데이터 조회
    const userMetadata = await getAuthUserMetadata(adminClient, userIdsToFetch);

    // 메타데이터로 사용자 정보 업데이트
    tenantlessUsers.forEach((user) => {
      const metadata = userMetadata.get(user.id);
      if (metadata) {
        user.email = metadata.email || "이메일 없음";
        user.name = metadata.name;
      }
    });

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
    // Super admin은 RLS를 우회하기 위해 Admin 클라이언트 사용
    const adminClient = createSupabaseAdminClient();
    
    if (!adminClient) {
      return {
        success: false,
        error: "Service Role Key가 설정되지 않았습니다. 관리자에게 문의하세요.",
      };
    }

    // 공통 함수 사용
    const result = await updateUserTenant(adminClient, userId, tenantId, userType);

    if (result.success) {
      revalidatePath("/superadmin/tenantless-users");
    }

    return result;
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
    // Super admin은 RLS를 우회하기 위해 Admin 클라이언트 사용
    const adminClient = createSupabaseAdminClient();
    
    if (!adminClient) {
      return {
        success: false,
        error: "Service Role Key가 설정되지 않았습니다. 관리자에게 문의하세요.",
      };
    }

    // 공통 함수 사용
    const result = await updateMultipleUserTenants(adminClient, userIds, tenantId);

    if (result.success) {
      revalidatePath("/superadmin/tenantless-users");
    }

    return result;
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
    const query = supabase.from("tenants").select("id, name").order("name", { ascending: true });

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

