import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { apiSuccess } from "@/lib/api";

type CheckSuperAdminResponse = {
  isSuperAdmin: boolean;
};

/**
 * Super Admin 권한 확인 API
 * GET /api/auth/check-superadmin
 *
 * @returns
 * 성공: { success: true, data: { isSuperAdmin: boolean } }
 */
export async function GET() {
  const tenantContext = await getTenantContext();

  return apiSuccess<CheckSuperAdminResponse>({
    isSuperAdmin: tenantContext?.role === "superadmin",
  });
}
