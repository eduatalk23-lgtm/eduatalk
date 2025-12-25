"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import {
  getPermissionDefinitions,
  getRolePermissions,
  setRolePermission,
  resetRolePermissions,
  type PermissionKey,
  type PermissionDefinition,
  type RolePermission,
} from "@/lib/auth/permissions";
import { auditSuccess, auditFailure } from "@/lib/audit";

/**
 * 모든 권한 정의를 조회합니다.
 */
export async function getPermissionDefinitionsAction(): Promise<{
  success: boolean;
  data?: PermissionDefinition[];
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const definitions = await getPermissionDefinitions();
    return { success: true, data: definitions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "권한 정의 조회 실패";
    return { success: false, error: message };
  }
}

/**
 * 테넌트의 역할별 권한 설정을 조회합니다.
 */
export async function getRolePermissionsAction(
  tenantId: string
): Promise<{
  success: boolean;
  data?: RolePermission[];
  error?: string;
}> {
  try {
    const { tenantId: userTenantId, role } = await requireAdminAuth();

    // superadmin이 아니면 자신의 테넌트만 조회 가능
    if (role !== "superadmin" && userTenantId !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const permissions = await getRolePermissions(tenantId);
    return { success: true, data: permissions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "권한 조회 실패";
    return { success: false, error: message };
  }
}

/**
 * 테넌트의 역할 권한을 설정합니다.
 */
export async function setRolePermissionAction(
  tenantId: string,
  role: "consultant",
  permissionKey: PermissionKey,
  isAllowed: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { tenantId: userTenantId, role: userRole } = await requireAdminAuth();

    // superadmin이 아니면 자신의 테넌트만 수정 가능
    if (userRole !== "superadmin" && userTenantId !== tenantId) {
      await auditFailure("permission_change", "permission", "권한이 없습니다.", permissionKey, {
        metadata: { targetTenantId: tenantId, targetRole: role },
      });
      return { success: false, error: "권한이 없습니다." };
    }

    const result = await setRolePermission(tenantId, role, permissionKey, isAllowed);

    if (result.success) {
      await auditSuccess("permission_change", "permission", permissionKey, {
        newData: { role, permissionKey, isAllowed },
        metadata: { targetTenantId: tenantId },
      });
      revalidatePath("/admin/settings/permissions");
    } else {
      await auditFailure("permission_change", "permission", result.error || "설정 실패", permissionKey, {
        metadata: { targetTenantId: tenantId, targetRole: role },
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "권한 설정 실패";
    await auditFailure("permission_change", "permission", message, permissionKey);
    return { success: false, error: message };
  }
}

/**
 * 여러 권한을 한 번에 설정합니다.
 */
export async function setMultipleRolePermissionsAction(
  tenantId: string,
  role: "consultant",
  permissions: Array<{ permissionKey: PermissionKey; isAllowed: boolean }>
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { tenantId: userTenantId, role: userRole } = await requireAdminAuth();

    // superadmin이 아니면 자신의 테넌트만 수정 가능
    if (userRole !== "superadmin" && userTenantId !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    // 모든 권한 설정
    const results = await Promise.all(
      permissions.map((p) =>
        setRolePermission(tenantId, role, p.permissionKey, p.isAllowed)
      )
    );

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      return {
        success: false,
        error: `${failed.length}개의 권한 설정 실패`,
      };
    }

    revalidatePath("/admin/settings/permissions");
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "권한 설정 실패";
    return { success: false, error: message };
  }
}

/**
 * 테넌트의 역할 권한 설정을 초기화합니다 (기본값으로 복원).
 */
export async function resetRolePermissionsAction(
  tenantId: string,
  role: "consultant"
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { tenantId: userTenantId, role: userRole } = await requireAdminAuth();

    // superadmin이 아니면 자신의 테넌트만 수정 가능
    if (userRole !== "superadmin" && userTenantId !== tenantId) {
      await auditFailure("permission_change", "permission", "권한이 없습니다.", null, {
        resourceName: "권한 초기화",
        metadata: { targetTenantId: tenantId, targetRole: role, action: "reset" },
      });
      return { success: false, error: "권한이 없습니다." };
    }

    const result = await resetRolePermissions(tenantId, role);

    if (result.success) {
      await auditSuccess("permission_change", "permission", null, {
        resourceName: "권한 초기화",
        newData: { role, action: "reset_to_default" },
        metadata: { targetTenantId: tenantId },
      });
      revalidatePath("/admin/settings/permissions");
    } else {
      await auditFailure("permission_change", "permission", result.error || "초기화 실패", null, {
        resourceName: "권한 초기화",
        metadata: { targetTenantId: tenantId, targetRole: role },
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "권한 초기화 실패";
    await auditFailure("permission_change", "permission", message, null, {
      resourceName: "권한 초기화",
    });
    return { success: false, error: message };
  }
}
