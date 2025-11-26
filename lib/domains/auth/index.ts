/**
 * Auth 도메인 Public API
 *
 * 인증/인가 관련 기능을 통합합니다:
 * - 사용자 인증
 * - 역할 확인
 * - 세션 관리
 * - 테넌트 컨텍스트
 */

// 현재 사용자 정보 re-export
export {
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth/getCurrentUser";

// 역할 확인 re-export
export {
  getCurrentUserRole,
  type UserRole,
} from "@/lib/auth/getCurrentUserRole";

// 학생 인증 요구 re-export
export {
  requireStudentAuth,
} from "@/lib/auth/requireStudentAuth";

// 세션 관리 re-export
export {
  getSession,
  refreshSession,
} from "@/lib/auth/sessionManager";

// Rate limit 처리 re-export
export {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";

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
 *    - User, Session, Role 타입 통합
 *
 * 2. actions.ts 통합
 *    - app/actions/auth.ts
 *    - 로그인, 로그아웃, 회원가입 액션
 *
 * 3. middleware.ts 고려
 *    - 인증 미들웨어 로직 통합
 */

