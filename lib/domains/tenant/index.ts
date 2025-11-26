/**
 * Tenant 도메인 Public API
 *
 * 테넌트(기관) 관련 기능을 통합합니다:
 * - 테넌트 CRUD
 * - 테넌트 설정
 * - 테넌트별 데이터 관리
 */

// 테넌트 데이터 re-export
export {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
} from "@/lib/data/tenants";

// 테넌트 컨텍스트 re-export
export {
  getTenantContext,
  type TenantContext,
} from "@/lib/tenant/getTenantContext";

export {
  requireTenantContext,
} from "@/lib/tenant/requireTenantContext";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. types.ts 추가
 *    - Tenant, TenantSettings 타입 통합
 *
 * 2. validation.ts 추가
 *    - 테넌트 생성/수정 스키마
 *
 * 3. actions.ts 통합
 *    - API Route에서 Server Action으로 전환 고려
 */

