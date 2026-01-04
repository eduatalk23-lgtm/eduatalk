/**
 * Parent Auth Strategy
 *
 * 학부모 역할 인증 전략 구현
 * - 학부모가 자녀의 데이터에 접근할 때 사용
 * - parent 역할이고 자녀 studentId가 있는 경우 적용
 *
 * @module lib/auth/strategies/parentAuthStrategy
 */

import { requireParent } from "@/lib/auth/guards";
import { AppError, ErrorCode } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/auth/getCurrentUserRole";
import type { AuthOptions, AuthStrategy, ParentAuthContext } from "./types";

/**
 * 학부모 인증 전략
 *
 * 학부모가 연결된 자녀의 플랜/데이터에 접근할 때 사용됩니다.
 * 자녀와의 연결 관계 검증이 포함됩니다.
 */
export class ParentAuthStrategy implements AuthStrategy<ParentAuthContext> {
  readonly mode = "parent" as const;

  /**
   * 학부모 전략 적용 가능 여부 확인
   *
   * @param role 현재 사용자 역할
   * @param options 인증 옵션
   * @returns parent 역할이고 studentId가 있으면 true
   */
  canHandle(role: UserRole | null, options?: AuthOptions): boolean {
    return role === "parent" && !!options?.studentId;
  }

  /**
   * 학부모 인증 수행
   *
   * @param options 인증 옵션 (studentId 필수)
   * @returns 학부모 인증 컨텍스트
   * @throws {AppError} 학부모 인증 실패 또는 자녀 연결 없음
   */
  async authenticate(options?: AuthOptions): Promise<ParentAuthContext> {
    if (!options?.studentId) {
      throw new AppError(
        "학부모 모드에서는 자녀 학생 ID가 필요합니다.",
        ErrorCode.VALIDATION_ERROR,
        400
      );
    }

    try {
      // 학부모 권한 검증
      const result = await requireParent();

      // 자녀 연결 확인
      const supabase = await createSupabaseServerClient();
      const { data: children, error } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", result.userId)
        .eq("status", "active");

      if (error) {
        throw new AppError(
          "자녀 정보를 조회하는데 실패했습니다.",
          ErrorCode.DATABASE_ERROR,
          500,
          true,
          { originalError: error }
        );
      }

      const childIds = children?.map((c) => c.student_id) || [];

      // 요청한 studentId가 자녀 목록에 있는지 확인
      if (!childIds.includes(options.studentId)) {
        throw new AppError(
          "해당 학생에 대한 접근 권한이 없습니다.",
          ErrorCode.FORBIDDEN,
          403
        );
      }

      return {
        mode: "parent",
        userId: result.userId,
        studentId: options.studentId,
        tenantId: options.tenantId || "",
        actingOnBehalfOf: true,
        childIds,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "학부모 인증에 실패했습니다.",
        ErrorCode.UNAUTHORIZED,
        401,
        true,
        { originalError: error }
      );
    }
  }
}

/**
 * ParentAuthStrategy 싱글톤 인스턴스
 */
export const parentAuthStrategy = new ParentAuthStrategy();
