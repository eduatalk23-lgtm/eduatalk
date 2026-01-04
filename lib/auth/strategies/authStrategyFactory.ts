/**
 * Auth Strategy Factory
 *
 * Strategy Registry 패턴을 사용한 인증 컨텍스트 해결
 * - 역할과 옵션에 따라 적절한 전략 자동 선택
 * - 확장성: 새 전략 추가 시 registry에만 등록
 *
 * @module lib/auth/strategies/authStrategyFactory
 */

import { getCurrentUserRole, type UserRole } from "@/lib/auth/getCurrentUserRole";
import { AppError, ErrorCode } from "@/lib/errors";
import { adminAuthStrategy } from "./adminAuthStrategy";
import { parentAuthStrategy } from "./parentAuthStrategy";
import { studentAuthStrategy } from "./studentAuthStrategy";
import type { AuthContext, AuthOptions, AuthStrategy } from "./types";

// ============================================
// Strategy Registry
// ============================================

/**
 * 전략 레지스트리
 *
 * 순서 중요: 더 구체적인 전략이 먼저 오도록 배치
 * 1. AdminAuthStrategy - studentId가 있고 admin/consultant인 경우
 * 2. ParentAuthStrategy - studentId가 있고 parent인 경우
 * 3. StudentAuthStrategy - 기본 폴백 (학생 본인)
 */
const strategyRegistry: AuthStrategy[] = [
  adminAuthStrategy,
  parentAuthStrategy,
  studentAuthStrategy,
];

// ============================================
// Factory Functions
// ============================================

/**
 * 인증 컨텍스트 해결
 *
 * 현재 사용자의 역할과 옵션을 기반으로 적절한 인증 전략을 선택하고
 * 인증을 수행하여 컨텍스트를 반환합니다.
 *
 * @param options 인증 옵션
 * @returns 인증 컨텍스트
 * @throws {AppError} 적절한 전략이 없거나 인증 실패 시
 *
 * @example
 * ```typescript
 * // 학생 본인 접근
 * const auth = await resolveAuthContext();
 * // { mode: 'student', userId: '...', studentId: '...', ... }
 *
 * // 관리자가 학생 대신 접근
 * const auth = await resolveAuthContext({ studentId: 'student-123' });
 * // { mode: 'admin', userId: '...', studentId: 'student-123', actingOnBehalfOf: true, ... }
 * ```
 */
export async function resolveAuthContext(options?: AuthOptions): Promise<AuthContext> {
  // 현재 사용자 역할 조회
  const { role: currentRole } = await getCurrentUserRole();

  // 적절한 전략 선택
  for (const strategy of strategyRegistry) {
    if (strategy.canHandle(currentRole, options)) {
      return strategy.authenticate(options);
    }
  }

  // 어떤 전략도 처리할 수 없는 경우
  throw new AppError(
    "지원되지 않는 사용자 역할입니다.",
    ErrorCode.FORBIDDEN,
    403,
    true,
    { role: currentRole, options }
  );
}

/**
 * 특정 모드의 인증 컨텍스트 강제 해결
 *
 * 특정 인증 모드를 강제하고 싶을 때 사용합니다.
 * canHandle 체크 없이 직접 authenticate를 호출합니다.
 *
 * @param mode 강제할 인증 모드
 * @param options 인증 옵션
 * @returns 인증 컨텍스트
 * @throws {AppError} 해당 모드의 전략이 없거나 인증 실패 시
 */
export async function resolveAuthContextForMode<TMode extends AuthContext["mode"]>(
  mode: TMode,
  options?: AuthOptions
): Promise<Extract<AuthContext, { mode: TMode }>> {
  const strategy = strategyRegistry.find((s) => s.mode === mode);

  if (!strategy) {
    throw new AppError(
      `${mode} 모드에 대한 인증 전략이 등록되지 않았습니다.`,
      ErrorCode.CONFIGURATION_ERROR,
      500,
      true,
      { mode }
    );
  }

  return strategy.authenticate(options) as Promise<Extract<AuthContext, { mode: TMode }>>;
}

/**
 * 현재 사용자가 특정 모드를 사용할 수 있는지 확인
 *
 * 실제 인증 없이 권한만 체크합니다.
 *
 * @param mode 확인할 인증 모드
 * @param options 인증 옵션
 * @returns 사용 가능 여부
 */
export async function canUseAuthMode(
  mode: AuthContext["mode"],
  options?: AuthOptions
): Promise<boolean> {
  const { role: currentRole } = await getCurrentUserRole();
  const strategy = strategyRegistry.find((s) => s.mode === mode);

  if (!strategy) {
    return false;
  }

  return strategy.canHandle(currentRole, options);
}

// ============================================
// Registry Management (확장용)
// ============================================

/**
 * 전략 레지스트리에 새 전략 추가
 *
 * 런타임에 새로운 인증 전략을 등록합니다.
 * 테스트나 플러그인 시스템에서 유용합니다.
 *
 * @param strategy 추가할 전략
 * @param priority 우선순위 (낮을수록 먼저 체크, 기본값: 맨 뒤)
 */
export function registerAuthStrategy(
  strategy: AuthStrategy,
  priority?: number
): void {
  const index = priority ?? strategyRegistry.length;
  strategyRegistry.splice(index, 0, strategy);
}

/**
 * 전략 레지스트리에서 전략 제거
 *
 * @param mode 제거할 전략의 모드
 * @returns 제거된 전략 (없으면 undefined)
 */
export function unregisterAuthStrategy(mode: AuthContext["mode"]): AuthStrategy | undefined {
  const index = strategyRegistry.findIndex((s) => s.mode === mode);

  if (index === -1) {
    return undefined;
  }

  const [removed] = strategyRegistry.splice(index, 1);
  return removed;
}

/**
 * 현재 등록된 전략 목록 조회
 *
 * @returns 등록된 전략 모드 배열
 */
export function getRegisteredStrategies(): readonly AuthContext["mode"][] {
  return strategyRegistry.map((s) => s.mode);
}
