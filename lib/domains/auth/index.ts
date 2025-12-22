/**
 * Auth 도메인 Public API
 *
 * 인증/인가 관련 기능을 통합합니다:
 * - 사용자 인증 (로그인, 회원가입, 로그아웃)
 * - 역할 확인
 * - 비밀번호 관리
 *
 * IMPORTANT: 아래 서버 전용 기능은 서버 컴포넌트/액션에서 직접 import 필요:
 * - getTenantContext: import { getTenantContext } from "@/lib/tenant/getTenantContext"
 * - requireTenantContext: import { requireTenantContext } from "@/lib/tenant/requireTenantContext"
 * - getCurrentUser: import { getCurrentUser } from "@/lib/auth/getCurrentUser"
 * - getCurrentUserRole: import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole"
 * - requireStudentAuth: import { requireStudentAuth } from "@/lib/auth/requireStudentAuth"
 * - sessionManager: import { ... } from "@/lib/auth/sessionManager"
 */

// ============================================
// Types (safe for client)
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

// Type-only re-exports (safe for client)
export type { CurrentUser } from "@/lib/auth/getCurrentUser";
export type { UserRole } from "@/lib/auth/getCurrentUserRole";
export type { TenantContext } from "@/lib/tenant/getTenantContext";
export type { UserSession } from "@/lib/auth/sessionManager";

// ============================================
// Actions (Server Actions - safe for client import)
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
  changePassword, // 마이페이지 비밀번호 변경 (현재 비밀번호 확인 필요)
  // 역할 변경
  changeUserRole,
} from "./actions";

// ============================================
// Rate limit 처리 re-export (safe for client)
// ============================================

export {
  isRateLimitError,
  retryWithBackoff,
} from "@/lib/auth/rateLimitHandler";

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
 * // 현재 사용자 조회 (서버 컴포넌트/액션에서만)
 * import { getCurrentUser } from "@/lib/auth/getCurrentUser";
 * const user = await getCurrentUser();
 *
 * // 역할 변경
 * import { changeUserRole } from "@/lib/domains/auth";
 * await changeUserRole("parent");
 */
