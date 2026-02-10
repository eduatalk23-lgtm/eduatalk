"use server";

/**
 * 팀원 관리 Server Actions
 *
 * - removeTeamMember: 팀원 제거
 * - updateMemberRole: 팀원 역할 변경
 * - transferOwnership: 대표 관리자 권한 이양
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import type { InvitationRole } from "../types";

/**
 * 팀원 제거 (admin_users에서 삭제)
 */
export async function removeTeamMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, role: currentRole, tenantId } = await requireAdmin();

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // 자신을 제거할 수 없음
    if (memberId === userId) {
      return { success: false, error: "자신을 팀에서 제거할 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 현재 사용자 + 삭제 대상을 동시 조회
    const [{ data: currentUser }, { data: targetMember }] = await Promise.all([
      supabase
        .from("admin_users")
        .select("id, is_owner")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("admin_users")
        .select("id, role, tenant_id, is_owner")
        .eq("id", memberId)
        .maybeSingle(),
    ]);

    if (!targetMember) {
      return { success: false, error: "팀원을 찾을 수 없습니다." };
    }

    // 일반 Admin은 같은 테넌트 팀원만 제거 가능
    if (currentRole === "admin" && targetMember.tenant_id !== tenantId) {
      return { success: false, error: "다른 기관의 팀원은 제거할 수 없습니다." };
    }

    // Superadmin은 제거 불가
    if (targetMember.role === "superadmin") {
      return { success: false, error: "슈퍼관리자는 제거할 수 없습니다." };
    }

    // Owner 보호: 대표 관리자는 superadmin만 제거 가능
    if (targetMember.is_owner && currentRole !== "superadmin") {
      return { success: false, error: "대표 관리자는 제거할 수 없습니다." };
    }

    // Non-owner admin은 consultant만 제거 가능
    if (
      currentRole === "admin" &&
      !currentUser?.is_owner &&
      targetMember.role !== "consultant"
    ) {
      return {
        success: false,
        error: "관리자를 제거할 권한이 없습니다. 대표 관리자만 다른 관리자를 제거할 수 있습니다.",
      };
    }

    // 삭제 실행 (RLS에 DELETE 정책이 없으므로 admin client 사용)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "서버 오류가 발생했습니다." };
    }

    const { error: deleteError } = await adminClient
      .from("admin_users")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      return { success: false, error: "팀원 제거에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[removeTeamMember] Error:", error);
    const message =
      error instanceof AppError && error.isUserFacing
        ? error.message
        : "팀원 제거 중 오류가 발생했습니다.";
    return { success: false, error: message };
  }
}

/**
 * 팀원 역할 변경
 */
export async function updateMemberRole(
  memberId: string,
  newRole: InvitationRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, role: currentRole, tenantId } = await requireAdmin();

    // 일반 Admin은 tenant 필요
    if (currentRole === "admin" && !tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // 역할 검증
    if (!["admin", "consultant"].includes(newRole)) {
      return { success: false, error: "올바른 역할을 선택해주세요." };
    }

    // 자신의 역할은 변경할 수 없음
    if (memberId === userId) {
      return { success: false, error: "자신의 역할은 변경할 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 현재 사용자 + 대상을 동시 조회
    const [{ data: currentUser }, { data: targetMember }] = await Promise.all([
      supabase
        .from("admin_users")
        .select("id, is_owner")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("admin_users")
        .select("id, role, tenant_id, is_owner")
        .eq("id", memberId)
        .maybeSingle(),
    ]);

    if (!targetMember) {
      return { success: false, error: "팀원을 찾을 수 없습니다." };
    }

    // 일반 Admin은 같은 테넌트 팀원만 수정 가능
    if (currentRole === "admin" && targetMember.tenant_id !== tenantId) {
      return { success: false, error: "다른 기관의 팀원 역할은 변경할 수 없습니다." };
    }

    // Superadmin 역할은 변경 불가
    if (targetMember.role === "superadmin") {
      return { success: false, error: "슈퍼관리자의 역할은 변경할 수 없습니다." };
    }

    // Owner 보호: 대표 관리자의 역할은 변경 불가
    if (targetMember.is_owner) {
      return { success: false, error: "대표 관리자의 역할은 변경할 수 없습니다." };
    }

    // Non-owner admin은 consultant만 역할 변경 가능
    if (
      currentRole === "admin" &&
      !currentUser?.is_owner &&
      targetMember.role !== "consultant"
    ) {
      return {
        success: false,
        error: "관리자의 역할을 변경할 권한이 없습니다. 대표 관리자만 다른 관리자의 역할을 변경할 수 있습니다.",
      };
    }

    // 역할 업데이트 (RLS UPDATE 정책이 자기 자신만 허용하므로 admin client 사용)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "서버 오류가 발생했습니다." };
    }

    const { error: updateError } = await adminClient
      .from("admin_users")
      .update({ role: newRole })
      .eq("id", memberId);

    if (updateError) {
      return { success: false, error: "역할 변경에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[updateMemberRole] Error:", error);
    const message =
      error instanceof AppError && error.isUserFacing
        ? error.message
        : "역할 변경 중 오류가 발생했습니다.";
    return { success: false, error: message };
  }
}

/**
 * 대표 관리자 권한 이양
 */
export async function transferOwnership(
  targetMemberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, role: currentRole, tenantId } = await requireAdmin();

    // superadmin은 이 기능 사용 불가 (테넌트 소속이 아님)
    if (currentRole === "superadmin") {
      return { success: false, error: "슈퍼관리자는 대표 관리자 이양 기능을 사용할 수 없습니다." };
    }

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // 자기 자신에게 이양 불가
    if (targetMemberId === userId) {
      return { success: false, error: "자기 자신에게 권한을 이양할 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 현재 사용자 + 대상을 동시 조회
    const [{ data: currentUser }, { data: targetMember }] = await Promise.all([
      supabase
        .from("admin_users")
        .select("id, is_owner, tenant_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("admin_users")
        .select("id, role, tenant_id")
        .eq("id", targetMemberId)
        .maybeSingle(),
    ]);

    if (!currentUser?.is_owner) {
      return { success: false, error: "대표 관리자만 권한을 이양할 수 있습니다." };
    }

    if (!targetMember) {
      return { success: false, error: "대상 팀원을 찾을 수 없습니다." };
    }

    if (targetMember.tenant_id !== tenantId) {
      return { success: false, error: "같은 기관의 팀원에게만 권한을 이양할 수 있습니다." };
    }

    if (targetMember.role !== "admin") {
      return {
        success: false,
        error: "관리자 역할의 팀원에게만 대표 관리자 권한을 이양할 수 있습니다.",
      };
    }

    // Admin client로 트랜잭션 처리 (RLS 우회)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "서버 오류가 발생했습니다." };
    }

    // 기존 owner의 is_owner를 false로
    const { error: removeOwnerError } = await adminClient
      .from("admin_users")
      .update({ is_owner: false })
      .eq("id", userId);

    if (removeOwnerError) {
      return { success: false, error: "권한 이양에 실패했습니다." };
    }

    // 대상에게 is_owner를 true로
    const { error: setOwnerError } = await adminClient
      .from("admin_users")
      .update({ is_owner: true })
      .eq("id", targetMemberId);

    if (setOwnerError) {
      // 롤백: 기존 owner 복원
      await adminClient
        .from("admin_users")
        .update({ is_owner: true })
        .eq("id", userId);

      return { success: false, error: "권한 이양에 실패했습니다." };
    }

    return { success: true };
  } catch (error) {
    console.error("[transferOwnership] Error:", error);
    const message =
      error instanceof AppError && error.isUserFacing
        ? error.message
        : "권한 이양 중 오류가 발생했습니다.";
    return { success: false, error: message };
  }
}
