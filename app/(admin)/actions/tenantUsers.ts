"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TenantUser = {
  id: string;
  email: string | null;
  name: string | null;
  tenant_id: string | null;
  type: "student" | "parent";
  // student specific
  grade?: string | null;
  class?: string | null;
  // parent specific
  relationship?: string | null;
};

/**
 * 기관별 사용자 목록 조회 (모든 기관의 학생/학부모)
 * Super Admin만 모든 기관의 사용자를 조회할 수 있음
 */
export async function getTenantUsersAction(
  currentTenantId: string
): Promise<TenantUser[]> {
  const { role, tenantId } = await requireAdminAuth();

  // Super Admin이 아니면 현재 기관의 사용자만 조회
  const targetTenantId = role === "superadmin" ? null : tenantId;

  const supabase = await createSupabaseServerClient();

  // 학생 목록 조회
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, tenant_id, user_id, grade, name")
    .order("created_at", { ascending: false });

  if (studentsError) {
    console.error("[tenantUsers] 학생 목록 조회 실패:", studentsError);
  }

  // 학부모 목록 조회
  const { data: parents, error: parentsError } = await supabase
    .from("parent_users")
    .select("id, tenant_id, relationship")
    .order("created_at", { ascending: false });

  if (parentsError) {
    console.error("[tenantUsers] 학부모 목록 조회 실패:", parentsError);
  }

  // 사용자 기본 정보 조회 (이메일, 이름)
  const allUserIds = [
    ...(students || []).map((s) => s.user_id || s.id),
    ...(parents || []).map((p) => p.id),
  ];

  let userMetadata: Map<string, { email: string | null; name: string | null }> =
    new Map();

  if (allUserIds.length > 0) {
    // Supabase Auth에서 사용자 정보 조회
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (!authError && authUsers?.users) {
      authUsers.users.forEach((user) => {
        userMetadata.set(user.id, {
          email: user.email || null,
          name: (user.user_metadata?.display_name as string) || null,
        });
      });
    }
  }

  // 학생 데이터 변환
  const studentUsers: TenantUser[] = (students || []).map((student) => {
    const userId = student.user_id || student.id;
    const metadata = userMetadata.get(userId) || {
      email: null,
      name: student.name || null,
    };
    return {
      id: userId,
      email: metadata.email,
      name: metadata.name || student.name || null,
      tenant_id: student.tenant_id,
      type: "student" as const,
      grade: student.grade?.toString() || null,
      class: null, // students 테이블에 class 필드가 없을 수 있음
    };
  });

  // 학부모 데이터 변환
  const parentUsers: TenantUser[] = (parents || []).map((parent) => {
    const metadata = userMetadata.get(parent.id) || {
      email: null,
      name: null,
    };
    return {
      id: parent.id,
      email: metadata.email,
      name: metadata.name,
      tenant_id: parent.tenant_id,
      type: "parent" as const,
      relationship: parent.relationship || null,
    };
  });

  // 필터링: Super Admin이 아니면 현재 기관의 사용자만
  const filteredUsers = [...studentUsers, ...parentUsers].filter((user) => {
    if (targetTenantId === null) {
      // Super Admin: 모든 사용자
      return true;
    }
    // 일반 Admin: 현재 기관의 사용자만
    return user.tenant_id === targetTenantId || !user.tenant_id;
  });

  return filteredUsers;
}

/**
 * 사용자를 기관에 할당/이동
 */
export async function assignUserToTenantAction(
  userId: string,
  tenantId: string,
  userType: "student" | "parent"
): Promise<{ success: boolean; error?: string }> {
  const { role } = await requireAdminAuth();

  if (role !== "admin" && role !== "superadmin") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    if (userType === "student") {
      // 학생 테이블 업데이트 (user_id로 먼저 시도, 없으면 id로)
      let studentError = null;
      
      // user_id로 시도
      const { error: error1 } = await supabase
        .from("students")
        .update({ tenant_id: tenantId })
        .eq("user_id", userId);
      
      if (error1) {
        // id로 시도
        const { error: error2 } = await supabase
          .from("students")
          .update({ tenant_id: tenantId })
          .eq("id", userId);
        
        studentError = error2;
      }

      if (studentError) {
        console.error("[tenantUsers] 학생 기관 할당 실패:", studentError);
        return {
          success: false,
          error: studentError.message || "학생 기관 할당에 실패했습니다.",
        };
      }
    } else {
      // 학부모 테이블 업데이트
      const { error: parentError } = await supabase
        .from("parent_users")
        .update({ tenant_id: tenantId })
        .eq("id", userId);

      if (parentError) {
        console.error("[tenantUsers] 학부모 기관 할당 실패:", parentError);
        return {
          success: false,
          error: parentError.message || "학부모 기관 할당에 실패했습니다.",
        };
      }
    }

    revalidatePath("/admin/tenant/users");
    revalidatePath("/admin/tenant/settings");

    return { success: true };
  } catch (error) {
    console.error("[tenantUsers] 사용자 기관 할당 중 오류:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "사용자 기관 할당 중 오류가 발생했습니다.",
    };
  }
}

