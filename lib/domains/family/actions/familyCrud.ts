"use server";

/**
 * Family CRUD Server Actions
 *
 * - createFamilyGroup: 가족 그룹 생성
 * - getFamilyWithMembers: 가족 상세 조회 (멤버 포함)
 * - listFamilies: 가족 목록 조회
 * - updateFamilyGroup: 가족 정보 수정
 * - deleteFamilyGroup: 가족 삭제
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionSuccess, logActionError } from "@/lib/logging/actionLogger";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { revalidatePath } from "next/cache";
import type {
  FamilyWithMembers,
  FamilyListItem,
  CreateFamilyInput,
  UpdateFamilyInput,
  CreateFamilyResult,
  FamilyActionResult,
  FamilyListFilter,
  PaginatedResult,
  FamilyMembershipRole,
} from "../types";

// ============================================
// Create Family Group
// ============================================

/**
 * 가족 그룹 생성
 */
export async function createFamilyGroup(
  input: CreateFamilyInput
): Promise<CreateFamilyResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "관리자 클라이언트를 초기화할 수 없습니다." };
    }

    const {
      familyName,
      primaryContactParentId,
      notes,
      studentIds,
      parentIds,
    } = input;

    // 1. 가족 그룹 생성
    const { data: family, error: createError } = await adminClient
      .from("family_groups")
      .insert({
        tenant_id: tenantId,
        family_name: familyName || null,
        primary_contact_parent_id: primaryContactParentId || null,
        notes: notes || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (createError || !family) {
      logActionError(
        { domain: "family", action: "createFamilyGroup", userId },
        createError,
        { input }
      );
      return {
        success: false,
        error: createError?.message || "가족 그룹 생성에 실패했습니다.",
      };
    }

    const familyId = family.id;

    // 2. 학생들을 가족에 추가
    if (studentIds && studentIds.length > 0) {
      const { error: studentError } = await adminClient
        .from("students")
        .update({ family_id: familyId })
        .in("id", studentIds)
        .eq("tenant_id", tenantId);

      if (studentError) {
        logActionError(
          { domain: "family", action: "createFamilyGroup", userId },
          studentError,
          { familyId, studentIds }
        );
        // 실패해도 가족은 생성됨 - 경고만 로깅
      }
    }

    // 3. 학부모 멤버십 추가
    if (parentIds && parentIds.length > 0) {
      const memberships = parentIds.map((parentId, index) => ({
        family_id: familyId,
        parent_id: parentId,
        role: index === 0 && primaryContactParentId === parentId ? "primary" : "member",
      }));

      const { error: membershipError } = await adminClient
        .from("family_parent_memberships")
        .insert(memberships);

      if (membershipError) {
        logActionError(
          { domain: "family", action: "createFamilyGroup", userId },
          membershipError,
          { familyId, parentIds }
        );
        // 실패해도 가족은 생성됨 - 경고만 로깅
      }

      // 첫 번째 부모의 primary_family_id 설정
      if (parentIds[0]) {
        await adminClient
          .from("parent_users")
          .update({ primary_family_id: familyId })
          .eq("id", parentIds[0])
          .is("primary_family_id", null);
      }
    }

    logActionSuccess(
      { domain: "family", action: "createFamilyGroup", userId },
      { familyId, studentIds, parentIds }
    );

    revalidatePath("/admin/families");
    revalidatePath("/admin/students");

    return { success: true, data: { familyId } };
  } catch (error) {
    logActionError(
      { domain: "family", action: "createFamilyGroup" },
      error,
      { input }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "가족 그룹 생성에 실패했습니다.",
    };
  }
}

// ============================================
// Get Family With Members
// ============================================

/**
 * 가족 상세 조회 (멤버 포함)
 */
export async function getFamilyWithMembers(
  familyId: string
): Promise<FamilyActionResult<FamilyWithMembers>> {
  try {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    // 1. 가족 정보 조회
    const { data: family, error: familyError } = await supabase
      .from("family_groups")
      .select(`
        id,
        tenant_id,
        family_name,
        primary_contact_parent_id,
        notes,
        created_at,
        updated_at,
        created_by
      `)
      .eq("id", familyId)
      .single();

    if (familyError || !family) {
      return {
        success: false,
        error: familyError?.message || "가족을 찾을 수 없습니다.",
      };
    }

    // 2. 가족에 속한 학생들 조회
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select(`
        id,
        name,
        grade,
        schools:school_id(name)
      `)
      .eq("family_id", familyId);

    if (studentsError) {
      logActionError(
        { domain: "family", action: "getFamilyWithMembers" },
        studentsError,
        { familyId }
      );
    }

    // 3. 가족 멤버십 조회 (학부모)
    const { data: memberships, error: membershipsError } = await supabase
      .from("family_parent_memberships")
      .select(`
        id,
        parent_id,
        role,
        parent_users:parent_id(
          id,
          name
        )
      `)
      .eq("family_id", familyId);

    if (membershipsError) {
      logActionError(
        { domain: "family", action: "getFamilyWithMembers" },
        membershipsError,
        { familyId }
      );
    }

    // 4. 데이터 변환
    type SchoolJoinResult = { name: string };
    type ParentJoinResult = { id: string; name: string | null };

    const familyStudents = (students || []).map((student) => {
      const schoolData = extractJoinResult<SchoolJoinResult>(student.schools);
      return {
        id: student.id,
        name: student.name,
        grade: student.grade,
        school: schoolData?.name || null,
      };
    });

    const familyParents = (memberships || []).map((membership) => {
      const parentData = extractJoinResult<ParentJoinResult>(membership.parent_users);
      return {
        id: membership.parent_id,
        name: parentData?.name || null,
        email: null, // auth.users에서 별도 조회 필요
        role: membership.role as FamilyMembershipRole,
      };
    });

    const primaryContactParent = family.primary_contact_parent_id
      ? familyParents.find((p) => p.id === family.primary_contact_parent_id) || null
      : null;

    const result: FamilyWithMembers = {
      id: family.id,
      tenantId: family.tenant_id,
      familyName: family.family_name,
      primaryContactParentId: family.primary_contact_parent_id,
      notes: family.notes,
      createdAt: family.created_at,
      updatedAt: family.updated_at,
      createdBy: family.created_by,
      students: familyStudents,
      parents: familyParents,
      primaryContactParent,
    };

    return { success: true, data: result };
  } catch (error) {
    logActionError(
      { domain: "family", action: "getFamilyWithMembers" },
      error,
      { familyId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "가족 조회에 실패했습니다.",
    };
  }
}

// ============================================
// List Families
// ============================================

/**
 * 가족 목록 조회
 */
export async function listFamilies(
  filter?: FamilyListFilter
): Promise<FamilyActionResult<PaginatedResult<FamilyListItem>>> {
  try {
    const { tenantId: userTenantId } = await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    const targetTenantId = filter?.tenantId || userTenantId;
    const limit = filter?.limit || 20;
    const offset = filter?.offset || 0;

    // 1. 가족 목록 조회
    let query = supabase
      .from("family_groups")
      .select(`
        id,
        family_name,
        tenant_id,
        primary_contact_parent_id,
        created_at,
        parent_users:primary_contact_parent_id(name)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (targetTenantId) {
      query = query.eq("tenant_id", targetTenantId);
    }

    if (filter?.search) {
      query = query.ilike("family_name", `%${filter.search}%`);
    }

    const { data: families, count, error: familiesError } = await query;

    if (familiesError) {
      logActionError(
        { domain: "family", action: "listFamilies" },
        familiesError,
        { filter }
      );
      return {
        success: false,
        error: familiesError.message || "가족 목록 조회에 실패했습니다.",
      };
    }

    if (!families || families.length === 0) {
      return {
        success: true,
        data: {
          items: [],
          totalCount: 0,
          hasMore: false,
        },
      };
    }

    const familyIds = families.map((f) => f.id);

    // 2. 각 가족의 학생 수 조회
    const { data: studentCounts } = await supabase
      .from("students")
      .select("family_id")
      .in("family_id", familyIds);

    const studentCountMap = new Map<string, number>();
    (studentCounts || []).forEach((s) => {
      if (s.family_id) {
        studentCountMap.set(s.family_id, (studentCountMap.get(s.family_id) || 0) + 1);
      }
    });

    // 3. 각 가족의 학부모 수 조회
    const { data: parentCounts } = await supabase
      .from("family_parent_memberships")
      .select("family_id")
      .in("family_id", familyIds);

    const parentCountMap = new Map<string, number>();
    (parentCounts || []).forEach((p) => {
      parentCountMap.set(p.family_id, (parentCountMap.get(p.family_id) || 0) + 1);
    });

    // 4. 데이터 변환
    type PrimaryContactJoinResult = { name: string | null };
    const items: FamilyListItem[] = families.map((family) => {
      const parentUserData = extractJoinResult<PrimaryContactJoinResult>(family.parent_users);
      return {
        id: family.id,
        familyName: family.family_name,
        tenantId: family.tenant_id,
        studentCount: studentCountMap.get(family.id) || 0,
        parentCount: parentCountMap.get(family.id) || 0,
        primaryContactName: parentUserData?.name || null,
        createdAt: family.created_at,
      };
    });

    // 5. 필터 적용 (hasStudents, hasParents)
    let filteredItems = items;
    if (filter?.hasStudents === true) {
      filteredItems = filteredItems.filter((f) => f.studentCount > 0);
    } else if (filter?.hasStudents === false) {
      filteredItems = filteredItems.filter((f) => f.studentCount === 0);
    }

    if (filter?.hasParents === true) {
      filteredItems = filteredItems.filter((f) => f.parentCount > 0);
    } else if (filter?.hasParents === false) {
      filteredItems = filteredItems.filter((f) => f.parentCount === 0);
    }

    return {
      success: true,
      data: {
        items: filteredItems,
        totalCount: count || 0,
        hasMore: offset + limit < (count || 0),
      },
    };
  } catch (error) {
    logActionError(
      { domain: "family", action: "listFamilies" },
      error,
      { filter }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "가족 목록 조회에 실패했습니다.",
    };
  }
}

// ============================================
// Update Family Group
// ============================================

/**
 * 가족 정보 수정
 */
export async function updateFamilyGroup(
  familyId: string,
  input: UpdateFamilyInput
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

    // 가족이 존재하고 같은 테넌트인지 확인
    const { data: existingFamily, error: checkError } = await adminClient
      .from("family_groups")
      .select("id, tenant_id")
      .eq("id", familyId)
      .single();

    if (checkError || !existingFamily) {
      return { success: false, error: "가족을 찾을 수 없습니다." };
    }

    if (existingFamily.tenant_id !== tenantId) {
      return { success: false, error: "접근 권한이 없습니다." };
    }

    // 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {};
    if (input.familyName !== undefined) {
      updateData.family_name = input.familyName;
    }
    if (input.primaryContactParentId !== undefined) {
      updateData.primary_contact_parent_id = input.primaryContactParentId;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true };
    }

    const { error: updateError } = await adminClient
      .from("family_groups")
      .update(updateData)
      .eq("id", familyId);

    if (updateError) {
      logActionError(
        { domain: "family", action: "updateFamilyGroup", userId },
        updateError,
        { familyId, input }
      );
      return {
        success: false,
        error: updateError.message || "가족 정보 수정에 실패했습니다.",
      };
    }

    logActionSuccess(
      { domain: "family", action: "updateFamilyGroup", userId },
      { familyId, input }
    );

    revalidatePath("/admin/families");
    revalidatePath(`/admin/families/${familyId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "family", action: "updateFamilyGroup" },
      error,
      { familyId, input }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "가족 정보 수정에 실패했습니다.",
    };
  }
}

// ============================================
// Delete Family Group
// ============================================

/**
 * 가족 삭제
 */
export async function deleteFamilyGroup(
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

    // 가족이 존재하고 같은 테넌트인지 확인
    const { data: existingFamily, error: checkError } = await adminClient
      .from("family_groups")
      .select("id, tenant_id")
      .eq("id", familyId)
      .single();

    if (checkError || !existingFamily) {
      return { success: false, error: "가족을 찾을 수 없습니다." };
    }

    if (existingFamily.tenant_id !== tenantId) {
      return { success: false, error: "접근 권한이 없습니다." };
    }

    // 1. 학생들의 family_id 초기화 (CASCADE 대신 명시적으로)
    await adminClient
      .from("students")
      .update({ family_id: null })
      .eq("family_id", familyId);

    // 2. 학부모들의 primary_family_id 초기화
    await adminClient
      .from("parent_users")
      .update({ primary_family_id: null })
      .eq("primary_family_id", familyId);

    // 3. 가족 삭제 (멤버십은 CASCADE로 자동 삭제)
    const { error: deleteError } = await adminClient
      .from("family_groups")
      .delete()
      .eq("id", familyId);

    if (deleteError) {
      logActionError(
        { domain: "family", action: "deleteFamilyGroup", userId },
        deleteError,
        { familyId }
      );
      return {
        success: false,
        error: deleteError.message || "가족 삭제에 실패했습니다.",
      };
    }

    logActionSuccess(
      { domain: "family", action: "deleteFamilyGroup", userId },
      { familyId }
    );

    revalidatePath("/admin/families");
    revalidatePath("/admin/students");

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "family", action: "deleteFamilyGroup" },
      error,
      { familyId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "가족 삭제에 실패했습니다.",
    };
  }
}
