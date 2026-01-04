/**
 * Auth Strategy Types
 *
 * Strategy Pattern을 활용한 역할 기반 인증 처리
 * - Student, Admin, Parent 등 역할별 인증 컨텍스트 분리
 * - 확장성 있는 구조로 새로운 역할 추가 용이
 *
 * @module lib/auth/strategies/types
 */

import type { UserRole } from "@/lib/auth/getCurrentUserRole";

// ============================================
// Auth Context Types (Discriminated Union)
// ============================================

/**
 * 학생 인증 컨텍스트
 */
export interface StudentAuthContext {
  mode: "student";
  userId: string;
  studentId: string;
  tenantId: string;
  actingOnBehalfOf: false;
}

/**
 * 관리자 인증 컨텍스트
 * - studentId: 관리자가 대신 작업하는 학생 ID
 */
export interface AdminAuthContext {
  mode: "admin";
  userId: string;
  studentId: string;
  tenantId: string;
  actingOnBehalfOf: true;
  adminRole: "admin" | "consultant";
}

/**
 * 학부모 인증 컨텍스트
 * - studentId: 학부모가 관리하는 자녀의 학생 ID
 */
export interface ParentAuthContext {
  mode: "parent";
  userId: string;
  studentId: string;
  tenantId: string;
  actingOnBehalfOf: true;
  childIds: string[];
}

/**
 * 통합 인증 컨텍스트 (Discriminated Union)
 */
export type AuthContext = StudentAuthContext | AdminAuthContext | ParentAuthContext;

// ============================================
// Auth Options
// ============================================

/**
 * 인증 옵션
 */
export interface AuthOptions {
  /** 대상 학생 ID (Admin/Parent 모드에서 사용) */
  studentId?: string;
  /** 테넌트 ID (멀티 테넌트 환경) */
  tenantId?: string;
  /** 테넌트 필수 여부 */
  requireTenant?: boolean;
}

// ============================================
// Auth Strategy Interface
// ============================================

/**
 * 인증 전략 인터페이스
 *
 * 각 역할별 인증 로직을 캡슐화합니다.
 */
export interface AuthStrategy<TContext extends AuthContext = AuthContext> {
  /** 전략이 처리하는 모드 */
  readonly mode: TContext["mode"];

  /**
   * 이 전략이 현재 조건을 처리할 수 있는지 확인
   *
   * @param role 현재 사용자 역할
   * @param options 인증 옵션
   * @returns 처리 가능 여부
   */
  canHandle(role: UserRole | null, options?: AuthOptions): boolean;

  /**
   * 인증 수행 및 컨텍스트 생성
   *
   * @param options 인증 옵션
   * @returns 인증 컨텍스트
   * @throws {AppError} 인증 실패 시
   */
  authenticate(options?: AuthOptions): Promise<TContext>;
}

// ============================================
// Type Guards
// ============================================

/**
 * 학생 컨텍스트 타입 가드
 */
export function isStudentContext(context: AuthContext): context is StudentAuthContext {
  return context.mode === "student";
}

/**
 * 관리자 컨텍스트 타입 가드
 */
export function isAdminContext(context: AuthContext): context is AdminAuthContext {
  return context.mode === "admin";
}

/**
 * 학부모 컨텍스트 타입 가드
 */
export function isParentContext(context: AuthContext): context is ParentAuthContext {
  return context.mode === "parent";
}

/**
 * 대리 작업 컨텍스트 타입 가드
 * (Admin 또는 Parent가 학생을 대신하여 작업)
 */
export function isActingOnBehalf(
  context: AuthContext
): context is AdminAuthContext | ParentAuthContext {
  return context.actingOnBehalfOf === true;
}

// ============================================
// Utility Types
// ============================================

/**
 * 역할에서 컨텍스트 타입 추출
 */
export type ContextForRole<R extends AuthContext["mode"]> = Extract<AuthContext, { mode: R }>;

/**
 * 모든 컨텍스트에서 공통 필드
 */
export type CommonAuthFields = Pick<AuthContext, "userId" | "studentId" | "tenantId">;
