/**
 * 유동적 권한 관리 시스템
 *
 * 테넌트별로 역할(admin, consultant)에 대한 권한을 설정할 수 있습니다.
 * 권한이 명시적으로 설정되지 않은 경우 permission_definitions의 기본값을 사용합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole, type UserRole } from "./getCurrentUserRole";
import { AppError, ErrorCode } from "@/lib/errors";

export type PermissionKey =
  // 캠프 관련
  | "camp.create"
  | "camp.update"
  | "camp.delete"
  | "camp.invite"
  // 학생 관련
  | "student.create"
  | "student.update"
  | "student.delete"
  | "student.view_all"
  // 콘텐츠 관련
  | "content.create"
  | "content.update"
  | "content.delete"
  // 출석 관련
  | "attendance.create"
  | "attendance.update"
  | "attendance.delete"
  // 설정 관련
  | "settings.scheduler"
  | "settings.sms"
  | "settings.tenant"
  // 사용자 관리
  | "user.create"
  | "user.update"
  | "user.delete";

export type PermissionCategory =
  | "camp"
  | "student"
  | "content"
  | "attendance"
  | "settings"
  | "user";

export type PermissionDefinition = {
  permission_key: PermissionKey;
  description: string;
  category: PermissionCategory;
  default_allowed_for_consultant: boolean;
};

export type RolePermission = {
  id: string;
  tenant_id: string | null;
  role: "admin" | "consultant";
  permission_key: PermissionKey;
  is_allowed: boolean;
};

/**
 * 현재 사용자가 특정 권한을 가지고 있는지 확인합니다.
 *
 * 권한 확인 우선순위:
 * 1. superadmin은 모든 권한 보유
 * 2. admin은 모든 권한 보유
 * 3. consultant는 테넌트별 설정 확인 -> 없으면 기본값 사용
 * 4. student/parent는 관리자 권한 없음
 */
export async function hasPermission(permissionKey: PermissionKey): Promise<boolean> {
  const { role, tenantId } = await getCurrentUserRole();

  // 로그인하지 않은 사용자
  if (!role) {
    return false;
  }

  // superadmin과 admin은 모든 권한 보유
  if (role === "superadmin" || role === "admin") {
    return true;
  }

  // student와 parent는 관리자 권한 없음
  if (role === "student" || role === "parent") {
    return false;
  }

  // consultant인 경우 권한 확인
  if (role === "consultant") {
    return await checkConsultantPermission(permissionKey, tenantId);
  }

  return false;
}

/**
 * Consultant의 특정 권한을 확인합니다.
 * 테넌트별 설정이 있으면 사용하고, 없으면 기본값 사용
 */
async function checkConsultantPermission(
  permissionKey: PermissionKey,
  tenantId: string | null
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  // 1. 테넌트별 권한 설정 확인
  if (tenantId) {
    const { data: rolePermission } = await supabase
      .from("role_permissions")
      .select("is_allowed")
      .eq("tenant_id", tenantId)
      .eq("role", "consultant")
      .eq("permission_key", permissionKey)
      .maybeSingle();

    if (rolePermission !== null) {
      return rolePermission.is_allowed;
    }
  }

  // 2. 기본값 사용
  const { data: definition } = await supabase
    .from("permission_definitions")
    .select("default_allowed_for_consultant")
    .eq("permission_key", permissionKey)
    .maybeSingle();

  // 정의가 없으면 기본적으로 허용하지 않음
  return definition?.default_allowed_for_consultant ?? false;
}

/**
 * 특정 권한이 필요한 작업 전에 권한을 확인하고, 없으면 에러를 throw합니다.
 */
export async function requirePermission(permissionKey: PermissionKey): Promise<{
  userId: string;
  role: UserRole;
  tenantId: string | null;
}> {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  const allowed = await hasPermission(permissionKey);

  if (!allowed) {
    throw new AppError(
      "이 작업을 수행할 권한이 없습니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  return { userId, role, tenantId };
}

/**
 * 테넌트의 역할별 권한 설정을 조회합니다.
 */
export async function getRolePermissions(
  tenantId: string
): Promise<RolePermission[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("role_permissions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("permission_key");

  if (error) {
    console.error("[permissions] 권한 조회 실패:", error.message);
    return [];
  }

  return data as RolePermission[];
}

/**
 * 모든 권한 정의를 조회합니다.
 */
export async function getPermissionDefinitions(): Promise<PermissionDefinition[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("permission_definitions")
    .select("permission_key, description, category, default_allowed_for_consultant")
    .order("category")
    .order("permission_key");

  if (error) {
    console.error("[permissions] 권한 정의 조회 실패:", error.message);
    return [];
  }

  return data as PermissionDefinition[];
}

/**
 * 테넌트의 역할 권한을 설정합니다.
 * Admin만 호출 가능합니다.
 */
export async function setRolePermission(
  tenantId: string,
  role: "consultant",
  permissionKey: PermissionKey,
  isAllowed: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("role_permissions")
    .upsert(
      {
        tenant_id: tenantId,
        role,
        permission_key: permissionKey,
        is_allowed: isAllowed,
      },
      {
        onConflict: "tenant_id,role,permission_key",
      }
    );

  if (error) {
    console.error("[permissions] 권한 설정 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 테넌트의 역할 권한 설정을 초기화합니다 (기본값으로 복원).
 */
export async function resetRolePermissions(
  tenantId: string,
  role: "consultant"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("role_permissions")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("role", role);

  if (error) {
    console.error("[permissions] 권한 초기화 실패:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 현재 사용자의 모든 권한을 조회합니다.
 * UI에서 버튼 표시/숨김에 사용할 수 있습니다.
 */
export async function getCurrentUserPermissions(): Promise<Record<PermissionKey, boolean>> {
  const { role, tenantId } = await getCurrentUserRole();

  // 모든 권한 정의 조회
  const definitions = await getPermissionDefinitions();
  const permissions: Record<string, boolean> = {};

  // 로그인하지 않은 사용자
  if (!role) {
    for (const def of definitions) {
      permissions[def.permission_key] = false;
    }
    return permissions as Record<PermissionKey, boolean>;
  }

  // superadmin과 admin은 모든 권한 보유
  if (role === "superadmin" || role === "admin") {
    for (const def of definitions) {
      permissions[def.permission_key] = true;
    }
    return permissions as Record<PermissionKey, boolean>;
  }

  // student와 parent는 관리자 권한 없음
  if (role === "student" || role === "parent") {
    for (const def of definitions) {
      permissions[def.permission_key] = false;
    }
    return permissions as Record<PermissionKey, boolean>;
  }

  // consultant인 경우 각 권한 확인
  if (role === "consultant" && tenantId) {
    const rolePermissions = await getRolePermissions(tenantId);
    const permissionMap = new Map(
      rolePermissions.map((p) => [p.permission_key, p.is_allowed])
    );

    for (const def of definitions) {
      // 테넌트별 설정이 있으면 사용, 없으면 기본값
      permissions[def.permission_key] =
        permissionMap.get(def.permission_key as PermissionKey) ??
        def.default_allowed_for_consultant;
    }
  } else {
    // 기본값 사용
    for (const def of definitions) {
      permissions[def.permission_key] = def.default_allowed_for_consultant;
    }
  }

  return permissions as Record<PermissionKey, boolean>;
}
