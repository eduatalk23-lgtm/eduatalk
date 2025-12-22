/**
 * Auth 도메인 Public API
 *
 * 인증/인가 관련 기능을 통합합니다:
 * - 사용자 인증 (로그인, 회원가입, 로그아웃)
 * - 역할 확인
 * - 세션 관리
 * - 테넌트 컨텍스트
 * - 비밀번호 관리
 */

// ============================================
// Types
// ============================================

export type {
  SignInInput,
  SignUpInput,
  SignupRole,
  SignInResult,
  AuthResult,
  UserConsentsInput,
} from "./types";

export { signInSchema, signUpSchema } from "./types";

// ============================================
// Actions (Server Actions)
// ============================================

export {
  // 인증
  signIn,
  signUp,
  signOut,
  // 이메일 확인
  resendConfirmationEmail,
  // 비밀번호
  sendPasswordResetEmail,
  updatePassword,
  // 역할 변경
  changeUserRole,
} from "./actions";

// ============================================
// 현재 사용자 정보 re-export
// ============================================

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
export { requireStudentAuth } from "@/lib/auth/requireStudentAuth";

// ============================================
// 세션 관리 re-export
// ============================================

export {
  getUserSessions,
  saveUserSession,
  revokeSession,
  revokeAllOtherSessions,
  updateLastActive,
  type UserSession,
} from "@/lib/auth/sessionManager";

// ============================================
// Rate limit 처리 re-export
// ============================================

export {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";

// ============================================
// 테넌트 컨텍스트 re-export
// ============================================

export {
  getTenantContext,
  type TenantContext,
} from "@/lib/tenant/getTenantContext";

export { requireTenantContext } from "@/lib/tenant/requireTenantContext";

/**
 * 사용 예시:
 *
 * // 로그인
 * import { signIn } from "@/lib/domains/auth";
 * await signIn(formData);
 *
 * // 회원가입
 * import { signUp } from "@/lib/domains/auth";
 * const result = await signUp(null, formData);
 *
 * // 현재 사용자 조회
 * import { getCurrentUser } from "@/lib/domains/auth";
 * const user = await getCurrentUser();
 *
 * // 역할 변경
 * import { changeUserRole } from "@/lib/domains/auth";
 * await changeUserRole("parent");
 */
