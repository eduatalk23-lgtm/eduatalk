/**
 * Tenant 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 tenant 도메인에 접근합니다.
 */

// ============================================
// Types
// ============================================

export * from "./types";

// ============================================
// Actions (Server Actions)
// ============================================

export {
  getTenantOptionsForSignup,
  type TenantOption,
} from "./actions";

/**
 * 사용 예시:
 *
 * // 회원가입용 기관 목록 조회
 * import { getTenantOptionsForSignup } from "@/lib/domains/tenant";
 * const response = await getTenantOptionsForSignup();
 */
