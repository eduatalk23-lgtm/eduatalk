/**
 * Student Auth Strategy
 *
 * 학생 역할 인증 전략 구현
 * - 학생이 자신의 데이터에 접근할 때 사용
 * - studentId가 없거나 학생 역할인 경우 적용
 *
 * @module lib/auth/strategies/studentAuthStrategy
 */

import { requireStudentAuth } from "@/lib/auth/requireStudentAuth";
import { AppError, ErrorCode } from "@/lib/errors";
import type { UserRole } from "@/lib/auth/getCurrentUserRole";
import type { AuthOptions, AuthStrategy, StudentAuthContext } from "./types";

/**
 * 학생 인증 전략
 *
 * 학생이 자신의 플랜/데이터에 접근할 때 사용됩니다.
 * 기본 폴백 전략으로, studentId 옵션이 없으면 이 전략이 사용됩니다.
 */
export class StudentAuthStrategy implements AuthStrategy<StudentAuthContext> {
  readonly mode = "student" as const;

  /**
   * 학생 전략 적용 가능 여부 확인
   *
   * @param role 현재 사용자 역할
   * @param options 인증 옵션
   * @returns studentId가 없거나 학생 역할이면 true
   */
  canHandle(role: UserRole | null, options?: AuthOptions): boolean {
    // studentId가 명시되지 않은 경우 (자기 자신)
    if (!options?.studentId) {
      return true;
    }

    // 학생 역할이고 자신의 ID와 일치하는 경우
    // (이 경우는 드물지만 명시적 처리)
    return role === "student";
  }

  /**
   * 학생 인증 수행
   *
   * @param options 인증 옵션 (학생은 대부분 무시)
   * @returns 학생 인증 컨텍스트
   * @throws {AppError} 학생 인증 실패 시
   */
  async authenticate(options?: AuthOptions): Promise<StudentAuthContext> {
    try {
      const studentAuth = await requireStudentAuth();

      // 테넌트 필수인데 없는 경우
      if (options?.requireTenant && !studentAuth.tenantId) {
        throw new AppError("테넌트 정보가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400);
      }

      return {
        mode: "student",
        userId: studentAuth.userId,
        studentId: studentAuth.userId, // 학생은 userId === studentId
        tenantId: studentAuth.tenantId || "",
        actingOnBehalfOf: false,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "학생 인증에 실패했습니다.",
        ErrorCode.UNAUTHORIZED,
        401,
        true,
        { originalError: error }
      );
    }
  }
}

/**
 * StudentAuthStrategy 싱글톤 인스턴스
 */
export const studentAuthStrategy = new StudentAuthStrategy();
