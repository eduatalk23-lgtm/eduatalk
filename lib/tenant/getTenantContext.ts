import { cache } from "react";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";

export type TenantContext = {
  tenantId: string | null;
  role: "superadmin" | "admin" | "consultant" | "parent" | "student" | null;
  userId: string | null;
};

/**
 * 현재 로그인한 사용자의 tenant context를 조회합니다.
 *
 * getCachedUserRole()에 위임하여 독립적인 auth+DB 조회를 제거합니다.
 * 같은 RSC 요청 내에서 getCurrentUser/getCurrentUserRole과 인증 결과를 공유합니다.
 *
 * @returns {Promise<TenantContext | null>} tenantId, role, userId를 포함한 객체
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const { userId, role, tenantId } = await getCachedUserRole();
  if (!userId || !role) return null;
  return { tenantId, role, userId };
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

