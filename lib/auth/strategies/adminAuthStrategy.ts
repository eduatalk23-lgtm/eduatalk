/**
 * Admin Auth Strategy
 *
 * 관리자/컨설턴트 역할 인증 전략 구현
 * - 관리자가 학생 데이터에 대신 접근할 때 사용
 * - studentId 옵션이 있고 admin/consultant 역할인 경우 적용
 *
 * @module lib/auth/strategies/adminAuthStrategy
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";
import type { UserRole } from "@/lib/auth/getCurrentUserRole";
import type { AdminAuthContext, AuthOptions, AuthStrategy } from "./types";

/**
 * 관리자 역할 확인
 */
function isAdminRole(role: UserRole | null): boolean {
  return role === "admin" || role === "consultant";
}

/**
 * 관리자 인증 전략
 *
 * 관리자/컨설턴트가 학생을 대신하여 플랜을 생성하거나
 * 학생 데이터에 접근할 때 사용됩니다.
 */
export class AdminAuthStrategy implements AuthStrategy<AdminAuthContext> {
  readonly mode = "admin" as const;

  /**
   * 관리자 전략 적용 가능 여부 확인
   *
   * @param role 현재 사용자 역할
   * @param options 인증 옵션
   * @returns admin/consultant 역할이고 studentId가 있으면 true
   */
  canHandle(role: UserRole | null, options?: AuthOptions): boolean {
    // studentId가 명시되어 있고 관리자 역할인 경우
    return isAdminRole(role) && !!options?.studentId;
  }

  /**
   * 관리자 인증 수행
   *
   * @param options 인증 옵션 (studentId 필수)
   * @returns 관리자 인증 컨텍스트
   * @throws {AppError} 관리자 인증 실패 시
   */
  async authenticate(options?: AuthOptions): Promise<AdminAuthContext> {
    if (!options?.studentId) {
      throw new AppError(
        "관리자 모드에서는 대상 학생 ID가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400
      );
    }

    try {
      // 관리자 권한 검증
      const result = await requireAdminOrConsultant({
        requireTenant: options.requireTenant,
      });

      // 현재 사용자의 역할 확인
      const currentUser = await getCurrentUser();
      const adminRole = currentUser?.role === "consultant" ? "consultant" : "admin";

      return {
        mode: "admin",
        userId: result.userId,
        studentId: options.studentId,
        tenantId: result.tenantId || options.tenantId || "",
        actingOnBehalfOf: true,
        adminRole,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "관리자 인증에 실패했습니다.",
        ErrorCode.UNAUTHORIZED,
        401,
        true,
        { originalError: error }
      );
    }
  }
}

/**
 * AdminAuthStrategy 싱글톤 인스턴스
 */
export const adminAuthStrategy = new AdminAuthStrategy();
