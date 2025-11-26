/**
 * Tenant 도메인 타입 정의
 *
 * Supabase Database 타입에서 파생됩니다.
 * @see lib/supabase/database.types.ts
 */

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/database.types";

// ============================================
// Database 타입에서 파생된 타입
// ============================================

/**
 * 테넌트 타입
 */
export type Tenant = Tables<"tenants">;

/**
 * 테넌트 생성 입력 타입
 */
export type TenantInsert = TablesInsert<"tenants">;

/**
 * 테넌트 수정 입력 타입
 */
export type TenantUpdate = TablesUpdate<"tenants">;

// ============================================
// 응답 타입
// ============================================

/**
 * 테넌트 액션 결과
 */
export type TenantActionResult = {
  success: boolean;
  error?: string;
  tenantId?: string;
  tenant?: Tenant;
};

