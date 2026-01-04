/**
 * Auth Strategies - Public API
 *
 * Strategy Pattern 기반 역할별 인증 처리 모듈
 *
 * @example
 * ```typescript
 * import { resolveAuthContext, isAdminContext } from '@/lib/auth/strategies';
 *
 * // Server Action에서 사용
 * async function createPlanGroup(data, options) {
 *   const auth = await resolveAuthContext({ studentId: options?.studentId });
 *
 *   if (isAdminContext(auth)) {
 *     // Admin 전용 로직
 *     logAudit(`Admin ${auth.userId} creating plan for ${auth.studentId}`);
 *   }
 *
 *   // 공통 로직 - auth.studentId는 모든 컨텍스트에서 사용 가능
 *   return createPlan({ studentId: auth.studentId, ... });
 * }
 * ```
 *
 * @module lib/auth/strategies
 */

// ============================================
// Types
// ============================================

export type {
  AuthContext,
  AuthOptions,
  AuthStrategy,
  StudentAuthContext,
  AdminAuthContext,
  ParentAuthContext,
  ContextForRole,
  CommonAuthFields,
} from "./types";

export {
  isStudentContext,
  isAdminContext,
  isParentContext,
  isActingOnBehalf,
} from "./types";

// ============================================
// Strategies
// ============================================

export { StudentAuthStrategy, studentAuthStrategy } from "./studentAuthStrategy";
export { AdminAuthStrategy, adminAuthStrategy } from "./adminAuthStrategy";
export { ParentAuthStrategy, parentAuthStrategy } from "./parentAuthStrategy";

// ============================================
// Factory
// ============================================

export {
  resolveAuthContext,
  resolveAuthContextForMode,
  canUseAuthMode,
  registerAuthStrategy,
  unregisterAuthStrategy,
  getRegisteredStrategies,
} from "./authStrategyFactory";
