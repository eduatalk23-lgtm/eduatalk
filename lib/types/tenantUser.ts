/**
 * 테넌트 사용자 관리 관련 타입 정의
 */

export type UserType = "student" | "parent" | "admin";

/**
 * 테넌트 할당 결과
 */
export type TenantAssignmentResult = {
  success: boolean;
  error?: string;
  assignedCount?: number;
};

/**
 * 테넌트 사용자 기본 정보
 */
export type TenantUserBase = {
  id: string;
  email: string | null;
  name: string | null;
  tenant_id: string | null;
  userType: UserType;
  created_at: string;
};

/**
 * 테넌트 존재 확인 결과
 */
export type TenantValidationResult = {
  exists: boolean;
  error?: string;
};

