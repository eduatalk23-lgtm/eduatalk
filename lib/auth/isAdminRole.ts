/**
 * 관리자 역할인지 확인하는 유틸리티 함수
 * admin, consultant, superadmin을 모두 관리자로 인식
 */
export function isAdminRole(role: string | null): boolean {
  return role === "admin" || role === "consultant" || role === "superadmin";
}

/**
 * Super Admin인지 확인하는 유틸리티 함수
 */
export function isSuperAdmin(role: string | null): boolean {
  return role === "superadmin";
}

