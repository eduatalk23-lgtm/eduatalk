"use server";

/**
 * Family Member Actions
 *
 * - addParentToFamily: 학부모를 가족에 추가
 * - removeParentFromFamily: 학부모를 가족에서 제거
 * - updateParentRole: 학부모의 가족 내 역할 수정
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionSuccess, logActionError } from "@/lib/logging/actionLogger";
import { revalidatePath } from "next/cache";
import type { FamilyActionResult, FamilyMembershipRole } from "../types";

// ============================================
// Add Parent to Family
// ============================================

/**
 * 학부모를 가족에 추가
 */
export async function addParentToFamily(
  parentId: string,
  familyId: string,
  role: FamilyMembershipRole = "member"
): Promise<FamilyActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "관리자 클라이언트를 초기화할 수 없습니다." };
    }

    // 1. 가족 존재 및 권한 확인
    const { data: family, error: familyError } = await adminClient
      .from("family_groups")
      .select("id, tenant_id")
      .eq("id", familyId)
      .single();

    if (familyError || !family) {
      return { success: false, error: "가족을 찾을 수 없습니다." };
    }

    if (family.tenant_id !== tenantId) {
      return { success: false, error: "접근 권한이 없습니다." };
    }

    // 2. 학부모 존재 및 권한 확인
    const { data: parent, error: parentError } = await adminClient
      .from("parent_users")
      .select("id, tenant_id")
      .eq("id", parentId)
      .single();

    if (parentError || !parent) {
      return { success: false, error: "학부모를 찾을 수 없습니다." };
    }

    if (parent.tenant_id !== tenantId) {
      return { success: false, error: "학부모에 대한 접근 권한이 없습니다." };
    }

    // 3. 이미 멤버십이 있는지 확인
    const { data: existingMembership } = await adminClient
      .from("family_parent_memberships")
      .select("id")
      .eq("family_id", familyId)
      .eq("parent_id", parentId)
      .maybeSingle();

    if (existingMembership) {
      return { success: true }; // 이미 해당 가족의 멤버
    }

    // 4. 멤버십 생성
    const { error: insertError } = await adminClient
      .from("family_parent_memberships")
      .insert({
        family_id: familyId,
        parent_id: parentId,
        role: role,
      });

    if (insertError) {
      // UNIQUE 제약조건 에러 처리
      if (insertError.code === "23505") {
        return { success: true }; // 이미 존재
      }

      logActionError(
        { domain: "family", action: "addParentToFamily", userId },
        insertError,
        { parentId, familyId, role }
      );
      return {
        success: false,
        error: insertError.message || "학부모를 가족에 추가하는 데 실패했습니다.",
      };
    }

    // 5. primary_family_id가 없으면 설정
    await adminClient
      .from("parent_users")
      .update({ primary_family_id: familyId })
      .eq("id", parentId)
      .is("primary_family_id", null);

    // 6. primary 역할이면 가족의 primary_contact_parent_id도 업데이트
    if (role === "primary") {
      await adminClient
        .from("family_groups")
        .update({ primary_contact_parent_id: parentId })
        .eq("id", familyId);
    }

    logActionSuccess(
      { domain: "family", action: "addParentToFamily", userId },
      { parentId, familyId, role }
    );

    revalidatePath("/admin/families");
    revalidatePath(`/admin/families/${familyId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "family", action: "addParentToFamily" },
      error,
      { parentId, familyId, role }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "학부모를 가족에 추가하는 데 실패했습니다.",
    };
  }
}

// ============================================
// Remove Parent from Family
// ============================================

/**
 * 학부모를 가족에서 제거
 */
export async function removeParentFromFamily(
  parentId: string,
  familyId: string
): Promise<FamilyActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "관리자 클라이언트를 초기화할 수 없습니다." };
    }

    // 1. 가족 존재 및 권한 확인
    const { data: family, error: familyError } = await adminClient
      .from("family_groups")
      .select("id, tenant_id, primary_contact_parent_id")
      .eq("id", familyId)
      .single();

    if (familyError || !family) {
      return { success: false, error: "가족을 찾을 수 없습니다." };
    }

    if (family.tenant_id !== tenantId) {
      return { success: false, error: "접근 권한이 없습니다." };
    }

    // 2. 멤버십 삭제
    const { error: deleteError } = await adminClient
      .from("family_parent_memberships")
      .delete()
      .eq("family_id", familyId)
      .eq("parent_id", parentId);

    if (deleteError) {
      logActionError(
        { domain: "family", action: "removeParentFromFamily", userId },
        deleteError,
        { parentId, familyId }
      );
      return {
        success: false,
        error: deleteError.message || "학부모를 가족에서 제거하는 데 실패했습니다.",
      };
    }

    // 3. 이 학부모가 primary_contact였다면 null로 설정
    if (family.primary_contact_parent_id === parentId) {
      await adminClient
        .from("family_groups")
        .update({ primary_contact_parent_id: null })
        .eq("id", familyId);
    }

    // 4. 학부모의 primary_family_id가 이 가족이었다면 다른 가족으로 변경 또는 null
    const { data: otherMemberships } = await adminClient
      .from("family_parent_memberships")
      .select("family_id")
      .eq("parent_id", parentId)
      .limit(1);

    const newPrimaryFamilyId = otherMemberships && otherMemberships.length > 0
      ? otherMemberships[0].family_id
      : null;

    await adminClient
      .from("parent_users")
      .update({ primary_family_id: newPrimaryFamilyId })
      .eq("id", parentId)
      .eq("primary_family_id", familyId);

    logActionSuccess(
      { domain: "family", action: "removeParentFromFamily", userId },
      { parentId, familyId }
    );

    revalidatePath("/admin/families");
    revalidatePath(`/admin/families/${familyId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "family", action: "removeParentFromFamily" },
      error,
      { parentId, familyId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "학부모를 가족에서 제거하는 데 실패했습니다.",
    };
  }
}

// ============================================
// Update Parent Role
// ============================================

/**
 * 학부모의 가족 내 역할 수정
 */
export async function updateParentRole(
  parentId: string,
  familyId: string,
  newRole: FamilyMembershipRole
): Promise<FamilyActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // 역할 유효성 검증
    const validRoles: FamilyMembershipRole[] = ["primary", "member", "guardian"];
    if (!validRoles.includes(newRole)) {
      return { success: false, error: "유효하지 않은 역할입니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "관리자 클라이언트를 초기화할 수 없습니다." };
    }

    // 1. 가족 존재 및 권한 확인
    const { data: family, error: familyError } = await adminClient
      .from("family_groups")
      .select("id, tenant_id, primary_contact_parent_id")
      .eq("id", familyId)
      .single();

    if (familyError || !family) {
      return { success: false, error: "가족을 찾을 수 없습니다." };
    }

    if (family.tenant_id !== tenantId) {
      return { success: false, error: "접근 권한이 없습니다." };
    }

    // 2. 멤버십 존재 확인
    const { data: membership, error: membershipError } = await adminClient
      .from("family_parent_memberships")
      .select("id, role")
      .eq("family_id", familyId)
      .eq("parent_id", parentId)
      .single();

    if (membershipError || !membership) {
      return { success: false, error: "해당 학부모의 가족 멤버십을 찾을 수 없습니다." };
    }

    // 3. 역할 업데이트
    const { error: updateError } = await adminClient
      .from("family_parent_memberships")
      .update({ role: newRole })
      .eq("id", membership.id);

    if (updateError) {
      logActionError(
        { domain: "family", action: "updateParentRole", userId },
        updateError,
        { parentId, familyId, newRole }
      );
      return {
        success: false,
        error: updateError.message || "역할 수정에 실패했습니다.",
      };
    }

    // 4. primary 역할이면 가족의 primary_contact_parent_id도 업데이트
    if (newRole === "primary") {
      // 기존 primary_contact가 다른 사람이었다면 그 사람의 role을 member로 변경
      if (family.primary_contact_parent_id && family.primary_contact_parent_id !== parentId) {
        await adminClient
          .from("family_parent_memberships")
          .update({ role: "member" })
          .eq("family_id", familyId)
          .eq("parent_id", family.primary_contact_parent_id);
      }

      await adminClient
        .from("family_groups")
        .update({ primary_contact_parent_id: parentId })
        .eq("id", familyId);
    } else if (family.primary_contact_parent_id === parentId) {
      // primary에서 다른 역할로 변경되었으면 primary_contact 해제
      await adminClient
        .from("family_groups")
        .update({ primary_contact_parent_id: null })
        .eq("id", familyId);
    }

    logActionSuccess(
      { domain: "family", action: "updateParentRole", userId },
      { parentId, familyId, oldRole: membership.role, newRole }
    );

    revalidatePath("/admin/families");
    revalidatePath(`/admin/families/${familyId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "family", action: "updateParentRole" },
      error,
      { parentId, familyId, newRole }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "역할 수정에 실패했습니다.",
    };
  }
}
