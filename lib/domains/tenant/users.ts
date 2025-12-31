"use server";

import { requireAdmin as requireAdminAuth } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { updateUserTenant } from "@/lib/utils/tenantAssignment";
import { getAuthUserMetadata } from "@/lib/utils/authUserMetadata";
import { logActionError } from "@/lib/logging/actionLogger";

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
  const adminClient = createSupabaseAdminClient();

  // DB 레벨 필터링으로 최적화
  let studentsQuery = supabase
    .from("students")
    .select("id, tenant_id, user_id, grade, name")
    .order("created_at", { ascending: false });

  let parentsQuery = supabase
    .from("parent_users")
    .select("id, tenant_id, relationship")
    .order("created_at", { ascending: false });

  // 일반 Admin인 경우 현재 기관의 사용자 또는 미할당 사용자만 조회
  if (targetTenantId !== null) {
    studentsQuery = studentsQuery.or(`tenant_id.eq.${targetTenantId},tenant_id.is.null`);
    parentsQuery = parentsQuery.or(`tenant_id.eq.${targetTenantId},tenant_id.is.null`);
  }

  // 학생 목록 조회
  const { data: students, error: studentsError } = await studentsQuery;

  if (studentsError) {
    logActionError(
      { domain: "tenant", action: "getTenantUsersAction" },
      studentsError,
      { context: "학생 목록 조회 실패" }
    );
  }

  // 학부모 목록 조회
  const { data: parents, error: parentsError } = await parentsQuery;

  if (parentsError) {
    logActionError(
      { domain: "tenant", action: "getTenantUsersAction" },
      parentsError,
      { context: "학부모 목록 조회 실패" }
    );
  }

  // 사용자 기본 정보 조회 (이메일, 이름)
  const allUserIds = [
    ...(students || []).map((s) => s.user_id || s.id),
    ...(parents || []).map((p) => p.id),
  ];

  // 최적화된 Auth 사용자 메타데이터 조회
  const userMetadata = await getAuthUserMetadata(adminClient, allUserIds);

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

  // Super Admin인 경우 필터링 불필요 (이미 DB 레벨에서 필터링됨)
  return [...studentUsers, ...parentUsers];
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

  try {
    const supabase = await createSupabaseServerClient();

    // 공통 함수 사용
    const result = await updateUserTenant(supabase, userId, tenantId, userType);

    if (result.success) {
      revalidatePath("/admin/tenant/users");
      revalidatePath("/admin/tenant/settings");
    }

    return result;
  } catch (error) {
    logActionError(
      { domain: "tenant", action: "assignUserToTenantAction" },
      error,
      { userId, tenantId, userType }
    );
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "사용자 기관 할당 중 오류가 발생했습니다.",
    };
  }
}

