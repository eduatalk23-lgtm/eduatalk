"use server";

/**
 * Family Integration Actions
 *
 * - handleParentLinkApproval: 학부모-학생 연결 승인 시 가족 통합 로직
 * - mergeFamilies: 두 가족 그룹 병합
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionSuccess, logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { revalidatePath } from "next/cache";
import type {
  FamilyActionResult,
  MergeFamiliesResult,
  FamilyMembershipRole,
} from "../types";

// ============================================
// Handle Parent Link Approval
// ============================================

/**
 * 학부모-학생 연결 승인 시 가족 통합 로직
 *
 * 로직:
 * 1. 학생에 family_id 있으면 → 부모를 해당 가족에 추가
 * 2. 없으면 → 부모의 다른 연결 학생 중 가족 있는지 확인
 * 3. 있으면 → 이 학생을 그 가족에 추가
 * 4. 없으면 → 미배정 상태 유지 (관리자가 수동으로 가족 생성)
 *
 * @param parentId 승인된 학부모 ID
 * @param studentId 연결된 학생 ID
 * @param relation 관계 (father, mother, guardian, other)
 */
export async function handleParentLinkApproval(
  parentId: string,
  studentId: string,
  relation?: string
): Promise<FamilyActionResult<{ familyId: string | null; action: string }>> {
  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "관리자 클라이언트를 초기화할 수 없습니다." };
    }

    // 1. 학생 정보 조회
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, tenant_id, family_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      logActionError(
        { domain: "family", action: "handleParentLinkApproval" },
        studentError || new Error("Student not found"),
        { parentId, studentId }
      );
      return { success: false, error: "학생을 찾을 수 없습니다." };
    }

    const tenantId = student.tenant_id;

    // 2. 학생에 이미 family_id가 있는 경우
    if (student.family_id) {
      // 부모를 해당 가족에 추가
      const membershipResult = await addParentToFamilyInternal(
        adminClient,
        parentId,
        student.family_id,
        getMembershipRole(relation)
      );

      if (!membershipResult.success) {
        return { success: false, error: membershipResult.error };
      }

      logActionSuccess(
        { domain: "family", action: "handleParentLinkApproval" },
        { parentId, studentId, familyId: student.family_id, action: "added_parent_to_existing_family" }
      );

      return {
        success: true,
        data: { familyId: student.family_id, action: "added_parent_to_existing_family" },
      };
    }

    // 3. 학생에 family_id가 없는 경우 - 부모의 다른 연결 학생 확인
    const { data: parentOtherLinks, error: linksError } = await adminClient
      .from("parent_student_links")
      .select(`
        student_id,
        students:student_id(id, family_id)
      `)
      .eq("parent_id", parentId)
      .eq("is_approved", true)
      .neq("student_id", studentId);

    if (linksError) {
      logActionDebug(
        { domain: "family", action: "handleParentLinkApproval" },
        "다른 연결 학생 조회 실패",
        { error: linksError.message }
      );
    }

    // 부모의 다른 연결된 학생 중 가족이 있는 학생 찾기
    let existingFamilyId: string | null = null;
    if (parentOtherLinks) {
      for (const link of parentOtherLinks) {
        const linkedStudent = link.students as { id: string; family_id: string | null } | null;
        if (linkedStudent?.family_id) {
          existingFamilyId = linkedStudent.family_id;
          break;
        }
      }
    }

    // 4. 부모의 다른 학생에 가족이 있는 경우 - 이 학생을 그 가족에 추가
    if (existingFamilyId) {
      // 학생을 가족에 추가
      const { error: updateError } = await adminClient
        .from("students")
        .update({ family_id: existingFamilyId })
        .eq("id", studentId);

      if (updateError) {
        logActionError(
          { domain: "family", action: "handleParentLinkApproval" },
          updateError,
          { parentId, studentId, existingFamilyId }
        );
        return {
          success: false,
          error: updateError.message || "학생을 가족에 추가하는 데 실패했습니다.",
        };
      }

      // 부모도 가족에 추가 (아직 아니라면)
      await addParentToFamilyInternal(
        adminClient,
        parentId,
        existingFamilyId,
        getMembershipRole(relation)
      );

      logActionSuccess(
        { domain: "family", action: "handleParentLinkApproval" },
        { parentId, studentId, familyId: existingFamilyId, action: "added_student_to_existing_family" }
      );

      revalidatePath(`/admin/families/${existingFamilyId}`);
      revalidatePath(`/admin/students/${studentId}`);

      return {
        success: true,
        data: { familyId: existingFamilyId, action: "added_student_to_existing_family" },
      };
    }

    // 5. 가족이 없는 경우 - 미배정 상태 유지
    // 부모의 primary_family_id 확인
    const { data: parent } = await adminClient
      .from("parent_users")
      .select("primary_family_id")
      .eq("id", parentId)
      .single();

    if (parent?.primary_family_id) {
      // 부모가 이미 가족에 속해있다면, 학생을 그 가족에 추가
      const { error: updateError } = await adminClient
        .from("students")
        .update({ family_id: parent.primary_family_id })
        .eq("id", studentId);

      if (!updateError) {
        logActionSuccess(
          { domain: "family", action: "handleParentLinkApproval" },
          { parentId, studentId, familyId: parent.primary_family_id, action: "added_student_to_parent_primary_family" }
        );

        revalidatePath(`/admin/families/${parent.primary_family_id}`);
        revalidatePath(`/admin/students/${studentId}`);

        return {
          success: true,
          data: { familyId: parent.primary_family_id, action: "added_student_to_parent_primary_family" },
        };
      }
    }

    // 6. 완전히 새로운 연결 - 미배정 상태
    logActionDebug(
      { domain: "family", action: "handleParentLinkApproval" },
      "가족 미배정 상태 유지",
      { parentId, studentId }
    );

    return {
      success: true,
      data: { familyId: null, action: "no_family_assigned" },
    };
  } catch (error) {
    logActionError(
      { domain: "family", action: "handleParentLinkApproval" },
      error,
      { parentId, studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "가족 통합 처리에 실패했습니다.",
    };
  }
}

/**
 * 내부 헬퍼: 부모를 가족에 추가
 */
async function addParentToFamilyInternal(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  parentId: string,
  familyId: string,
  role: FamilyMembershipRole
): Promise<FamilyActionResult> {
  // 이미 멤버십이 있는지 확인
  const { data: existingMembership } = await adminClient
    .from("family_parent_memberships")
    .select("id")
    .eq("family_id", familyId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (existingMembership) {
    return { success: true }; // 이미 존재
  }

  // 멤버십 생성
  const { error: insertError } = await adminClient
    .from("family_parent_memberships")
    .insert({
      family_id: familyId,
      parent_id: parentId,
      role: role,
    });

  if (insertError && insertError.code !== "23505") {
    return {
      success: false,
      error: insertError.message || "학부모를 가족에 추가하는 데 실패했습니다.",
    };
  }

  // primary_family_id가 없으면 설정
  await adminClient
    .from("parent_users")
    .update({ primary_family_id: familyId })
    .eq("id", parentId)
    .is("primary_family_id", null);

  return { success: true };
}

/**
 * 관계에 따른 멤버십 역할 결정
 */
function getMembershipRole(relation?: string): FamilyMembershipRole {
  switch (relation) {
    case "father":
    case "mother":
      return "primary";
    case "guardian":
      return "guardian";
    default:
      return "member";
  }
}

// ============================================
// Merge Families
// ============================================

/**
 * 두 가족 그룹 병합
 *
 * secondaryFamily의 모든 학생과 부모를 primaryFamily로 이동
 * 후 secondaryFamily 삭제
 */
export async function mergeFamilies(
  primaryFamilyId: string,
  secondaryFamilyId: string
): Promise<MergeFamiliesResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (primaryFamilyId === secondaryFamilyId) {
      return { success: false, error: "같은 가족을 병합할 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "관리자 클라이언트를 초기화할 수 없습니다." };
    }

    // 1. 두 가족이 모두 존재하고 같은 테넌트인지 확인
    const { data: families, error: familiesError } = await adminClient
      .from("family_groups")
      .select("id, tenant_id, family_name")
      .in("id", [primaryFamilyId, secondaryFamilyId]);

    if (familiesError || !families || families.length !== 2) {
      return { success: false, error: "가족 정보를 확인할 수 없습니다." };
    }

    const primaryFamily = families.find((f) => f.id === primaryFamilyId);
    const secondaryFamily = families.find((f) => f.id === secondaryFamilyId);

    if (!primaryFamily || !secondaryFamily) {
      return { success: false, error: "가족을 찾을 수 없습니다." };
    }

    if (primaryFamily.tenant_id !== tenantId || secondaryFamily.tenant_id !== tenantId) {
      return { success: false, error: "접근 권한이 없습니다." };
    }

    // 2. secondary 가족의 학생들을 primary 가족으로 이동
    const { data: movedStudents } = await adminClient
      .from("students")
      .update({ family_id: primaryFamilyId })
      .eq("family_id", secondaryFamilyId)
      .select("id");

    const movedStudentCount = movedStudents?.length || 0;

    // 3. secondary 가족의 부모 멤버십을 primary 가족으로 이동 (중복 제외)
    const { data: secondaryMemberships } = await adminClient
      .from("family_parent_memberships")
      .select("parent_id, role")
      .eq("family_id", secondaryFamilyId);

    let movedParentCount = 0;

    if (secondaryMemberships && secondaryMemberships.length > 0) {
      // 이미 primary에 있는 부모 확인
      const { data: primaryMemberships } = await adminClient
        .from("family_parent_memberships")
        .select("parent_id")
        .eq("family_id", primaryFamilyId);

      const existingParentIds = new Set(
        (primaryMemberships || []).map((m) => m.parent_id)
      );

      // 새로 추가할 멤버십
      const newMemberships = secondaryMemberships
        .filter((m) => !existingParentIds.has(m.parent_id))
        .map((m) => ({
          family_id: primaryFamilyId,
          parent_id: m.parent_id,
          role: m.role,
        }));

      if (newMemberships.length > 0) {
        const { data: inserted } = await adminClient
          .from("family_parent_memberships")
          .insert(newMemberships)
          .select("id");

        movedParentCount = inserted?.length || 0;
      }

      // 이동한 부모들의 primary_family_id 업데이트
      const parentIdsToUpdate = secondaryMemberships.map((m) => m.parent_id);
      await adminClient
        .from("parent_users")
        .update({ primary_family_id: primaryFamilyId })
        .in("id", parentIdsToUpdate)
        .eq("primary_family_id", secondaryFamilyId);
    }

    // 4. secondary 가족 삭제 (멤버십은 CASCADE로 자동 삭제)
    const { error: deleteError } = await adminClient
      .from("family_groups")
      .delete()
      .eq("id", secondaryFamilyId);

    if (deleteError) {
      logActionError(
        { domain: "family", action: "mergeFamilies", userId },
        deleteError,
        { primaryFamilyId, secondaryFamilyId }
      );
      return {
        success: false,
        error: deleteError.message || "가족 병합에 실패했습니다.",
      };
    }

    logActionSuccess(
      { domain: "family", action: "mergeFamilies", userId },
      {
        primaryFamilyId,
        secondaryFamilyId,
        movedStudentCount,
        movedParentCount,
      }
    );

    revalidatePath("/admin/families");
    revalidatePath(`/admin/families/${primaryFamilyId}`);

    return {
      success: true,
      data: {
        mergedFamilyId: primaryFamilyId,
        movedStudentCount,
        movedParentCount,
      },
    };
  } catch (error) {
    logActionError(
      { domain: "family", action: "mergeFamilies" },
      error,
      { primaryFamilyId, secondaryFamilyId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "가족 병합에 실패했습니다.",
    };
  }
}
