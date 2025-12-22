/**
 * tenantlessUserActions.ts - 테넌트 미할당 사용자 관련 Server Actions
 *
 * 이 파일은 lib/domains/superadmin의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/superadmin에서 직접 import 사용을 권장합니다.
 */

export type { TenantlessUser } from "@/lib/domains/superadmin";

export {
  getTenantlessUsers,
  assignTenantToUser,
  assignTenantToMultipleUsers,
  getActiveTenants,
} from "@/lib/domains/superadmin";
