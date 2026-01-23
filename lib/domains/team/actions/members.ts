"use server";

/**
 * 팀원 관리 Server Actions
 *
 * - removeTeamMember: 팀원 제거
 * - updateMemberRole: 팀원 역할 변경
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type { InvitationRole } from "../types";

/**
 * 팀원 제거 (admin_users에서 삭제)
 */
export const removeTeamMember = withErrorHandling(
  async (memberId: string): Promise<{ success: boolean; error?: string }> => {
    const { userId, role: currentRole, tenantId } = await requireAdmin();

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 자신을 제거할 수 없음
    if (memberId === userId) {
      throw new AppError(
        "자신을 팀에서 제거할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 삭제 대상 확인
    const { data: targetMember } = await supabase
      .from("admin_users")
      .select("id, role, tenant_id")
      .eq("id", memberId)
      .maybeSingle();

    if (!targetMember) {
      throw new AppError(
        "팀원을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 일반 Admin은 같은 테넌트 팀원만 제거 가능
    if (currentRole === "admin" && targetMember.tenant_id !== tenantId) {
      throw new AppError(
        "다른 기관의 팀원은 제거할 수 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // Superadmin은 제거 불가
    if (targetMember.role === "superadmin") {
      throw new AppError(
        "슈퍼관리자는 제거할 수 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // 삭제 실행
    const { error: deleteError } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      throw new AppError(
        "팀원 제거에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: deleteError.message }
      );
    }

    return { success: true };
  }
);

/**
 * 팀원 역할 변경
 */
export const updateMemberRole = withErrorHandling(
  async (
    memberId: string,
    newRole: InvitationRole
  ): Promise<{ success: boolean; error?: string }> => {
    const { userId, role: currentRole, tenantId } = await requireAdmin();

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 역할 검증
    if (!["admin", "consultant"].includes(newRole)) {
      throw new AppError(
        "올바른 역할을 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    // 자신의 역할은 변경할 수 없음
    if (memberId === userId) {
      throw new AppError(
        "자신의 역할은 변경할 수 없습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 대상 확인
    const { data: targetMember } = await supabase
      .from("admin_users")
      .select("id, role, tenant_id")
      .eq("id", memberId)
      .maybeSingle();

    if (!targetMember) {
      throw new AppError(
        "팀원을 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    // 일반 Admin은 같은 테넌트 팀원만 수정 가능
    if (currentRole === "admin" && targetMember.tenant_id !== tenantId) {
      throw new AppError(
        "다른 기관의 팀원 역할은 변경할 수 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // Superadmin 역할은 변경 불가
    if (targetMember.role === "superadmin") {
      throw new AppError(
        "슈퍼관리자의 역할은 변경할 수 없습니다.",
        ErrorCode.FORBIDDEN,
        403,
        true
      );
    }

    // 역할 업데이트
    const { error: updateError } = await supabase
      .from("admin_users")
      .update({ role: newRole })
      .eq("id", memberId);

    if (updateError) {
      throw new AppError(
        "역할 변경에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true,
        { originalError: updateError.message }
      );
    }

    return { success: true };
  }
);
