"use server";

/**
 * Sibling Actions
 *
 * - addStudentToFamily: 학생을 가족에 추가
 * - removeStudentFromFamily: 학생을 가족에서 제거
 * - getSiblings: 특정 학생의 형제자매 조회
 * - findSiblingCandidates: 형제자매 후보 자동 감지
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionSuccess, logActionError } from "@/lib/logging/actionLogger";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { revalidatePath } from "next/cache";
import type {
  FamilyActionResult,
  FamilyStudent,
  SiblingCandidate,
  FindSiblingCandidatesResult,
} from "../types";

// ============================================
// Add Student to Family
// ============================================

/**
 * 학생을 가족에 추가
 */
export async function addStudentToFamily(
  studentId: string,
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
      .select("id, tenant_id")
      .eq("id", familyId)
      .single();

    if (familyError || !family) {
      return { success: false, error: "가족을 찾을 수 없습니다." };
    }

    if (family.tenant_id !== tenantId) {
      return { success: false, error: "접근 권한이 없습니다." };
    }

    // 2. 학생 존재 및 권한 확인
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, tenant_id, family_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return { success: false, error: "학생을 찾을 수 없습니다." };
    }

    if (student.tenant_id !== tenantId) {
      return { success: false, error: "학생에 대한 접근 권한이 없습니다." };
    }

    if (student.family_id === familyId) {
      return { success: true }; // 이미 해당 가족 소속
    }

    // 3. 학생의 family_id 업데이트
    const { error: updateError } = await adminClient
      .from("students")
      .update({ family_id: familyId })
      .eq("id", studentId);

    if (updateError) {
      logActionError(
        { domain: "family", action: "addStudentToFamily", userId },
        updateError,
        { studentId, familyId }
      );
      return {
        success: false,
        error: updateError.message || "학생을 가족에 추가하는 데 실패했습니다.",
      };
    }

    logActionSuccess(
      { domain: "family", action: "addStudentToFamily", userId },
      { studentId, familyId }
    );

    revalidatePath("/admin/families");
    revalidatePath(`/admin/families/${familyId}`);
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "family", action: "addStudentToFamily" },
      error,
      { studentId, familyId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "학생을 가족에 추가하는 데 실패했습니다.",
    };
  }
}

// ============================================
// Remove Student from Family
// ============================================

/**
 * 학생을 가족에서 제거
 */
export async function removeStudentFromFamily(
  studentId: string
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

    // 1. 학생 존재 및 권한 확인
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, tenant_id, family_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return { success: false, error: "학생을 찾을 수 없습니다." };
    }

    if (student.tenant_id !== tenantId) {
      return { success: false, error: "학생에 대한 접근 권한이 없습니다." };
    }

    if (!student.family_id) {
      return { success: true }; // 이미 가족 소속 없음
    }

    const oldFamilyId = student.family_id;

    // 2. 학생의 family_id 제거
    const { error: updateError } = await adminClient
      .from("students")
      .update({ family_id: null })
      .eq("id", studentId);

    if (updateError) {
      logActionError(
        { domain: "family", action: "removeStudentFromFamily", userId },
        updateError,
        { studentId }
      );
      return {
        success: false,
        error: updateError.message || "학생을 가족에서 제거하는 데 실패했습니다.",
      };
    }

    logActionSuccess(
      { domain: "family", action: "removeStudentFromFamily", userId },
      { studentId, oldFamilyId }
    );

    revalidatePath("/admin/families");
    revalidatePath(`/admin/families/${oldFamilyId}`);
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "family", action: "removeStudentFromFamily" },
      error,
      { studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "학생을 가족에서 제거하는 데 실패했습니다.",
    };
  }
}

// ============================================
// Get Siblings
// ============================================

/**
 * 특정 학생의 형제자매 조회
 */
export async function getSiblings(
  studentId: string
): Promise<FamilyActionResult<FamilyStudent[]>> {
  try {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    // 1. 학생의 family_id 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, family_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return { success: false, error: "학생을 찾을 수 없습니다." };
    }

    if (!student.family_id) {
      return { success: true, data: [] }; // 가족 소속 없음
    }

    // 2. 같은 가족의 다른 학생들 조회 (school_name 비정규화 컬럼 사용)
    const { data: siblings, error: siblingsError } = await supabase
      .from("students")
      .select("id, name, grade, school_name")
      .eq("family_id", student.family_id)
      .neq("id", studentId);

    if (siblingsError) {
      logActionError(
        { domain: "family", action: "getSiblings" },
        siblingsError,
        { studentId }
      );
      return {
        success: false,
        error: siblingsError.message || "형제자매 조회에 실패했습니다.",
      };
    }

    const result: FamilyStudent[] = (siblings || []).map((sibling) => {
      return {
        id: sibling.id,
        name: sibling.name,
        grade: sibling.grade != null ? String(sibling.grade) : null,
        school: sibling.school_name,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    logActionError(
      { domain: "family", action: "getSiblings" },
      error,
      { studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "형제자매 조회에 실패했습니다.",
    };
  }
}

// ============================================
// Search Students for Sibling
// ============================================

/**
 * 형제자매로 추가할 학생 검색
 */
export async function searchStudentsForSibling(
  query: string,
  currentStudentId: string
): Promise<FamilyActionResult<FamilyStudent[]>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    // Admin client 사용 (RLS 우회)
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "관리자 클라이언트를 초기화할 수 없습니다." };
    }

    // 현재 학생의 family_id 조회
    const { data: currentStudent } = await adminClient
      .from("students")
      .select("id, family_id")
      .eq("id", currentStudentId)
      .single();

    const currentFamilyId = currentStudent?.family_id;

    // 학생 검색 (같은 테넌트, 현재 학생 제외, school_name 비정규화 컬럼 사용)
    const { data: students, error } = await adminClient
      .from("students")
      .select("id, name, grade, family_id, school_name")
      .eq("tenant_id", tenantId)
      .neq("id", currentStudentId)
      .ilike("name", `%${query.trim()}%`)
      .limit(10);

    if (error) {
      logActionError(
        { domain: "family", action: "searchStudentsForSibling" },
        error,
        { query, currentStudentId }
      );
      return { success: false, error: "검색에 실패했습니다." };
    }

    // 이미 같은 가족인 학생 제외
    const filteredStudents = currentFamilyId
      ? (students || []).filter((s) => s.family_id !== currentFamilyId)
      : students || [];

    const result: FamilyStudent[] = filteredStudents.map((student) => ({
      id: student.id,
      name: student.name,
      grade: student.grade != null ? String(student.grade) : null,
      school: student.school_name,
    }));

    return { success: true, data: result };
  } catch (error) {
    logActionError(
      { domain: "family", action: "searchStudentsForSibling" },
      error,
      { query, currentStudentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "검색에 실패했습니다.",
    };
  }
}

// ============================================
// Find Sibling Candidates
// ============================================

/**
 * 형제자매 후보 자동 감지
 *
 * 감지 로직:
 * 1. 같은 부모에 연결된 학생들 (신뢰도 90%)
 * 2. 같은 전화번호를 가진 학생들 (신뢰도 70%) - 추후 구현
 */
export async function findSiblingCandidates(
  studentId: string
): Promise<FindSiblingCandidatesResult> {
  try {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    // 1. 학생 정보 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, tenant_id, family_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return { success: false, error: "학생을 찾을 수 없습니다." };
    }

    const candidates: SiblingCandidate[] = [];
    const addedStudentIds = new Set<string>([studentId]);

    // 2. 같은 부모에 연결된 학생들 찾기 (same_parent)
    // 먼저 이 학생의 부모 ID들 조회
    const { data: parentLinks, error: linksError } = await supabase
      .from("parent_student_links")
      .select("parent_id")
      .eq("student_id", studentId)
      .eq("is_approved", true);

    if (linksError) {
      logActionError(
        { domain: "family", action: "findSiblingCandidates" },
        linksError,
        { studentId }
      );
    }

    if (parentLinks && parentLinks.length > 0) {
      const parentIds = parentLinks.map((link) => link.parent_id);

      // 같은 부모에 연결된 다른 학생들 조회
      const { data: siblingLinks, error: siblingLinksError } = await supabase
        .from("parent_student_links")
        .select(`
          student_id,
          parent_id,
          students:student_id(
            id,
            name,
            grade,
            family_id,
            tenant_id
          )
        `)
        .in("parent_id", parentIds)
        .neq("student_id", studentId)
        .eq("is_approved", true);

      if (siblingLinksError) {
        logActionError(
          { domain: "family", action: "findSiblingCandidates" },
          siblingLinksError,
          { studentId, parentIds }
        );
      }

      if (siblingLinks) {
        // 학생별로 공유 부모 수 집계
        const studentParentMap = new Map<string, {
          student: {
            id: string;
            name: string | null;
            grade: string | null;
            family_id: string | null;
            tenant_id: string;
          };
          parentIds: string[];
        }>();

        type StudentJoinResult = {
          id: string;
          name: string | null;
          grade: string | null;
          family_id: string | null;
          tenant_id: string;
        };

        for (const link of siblingLinks) {
          const studentData = extractJoinResult<StudentJoinResult>(link.students);

          if (!studentData) continue;

          // 같은 테넌트 확인
          if (studentData.tenant_id !== student.tenant_id) continue;

          // 이미 같은 가족이면 제외
          if (studentData.family_id && studentData.family_id === student.family_id) continue;

          const existing = studentParentMap.get(studentData.id);
          if (existing) {
            existing.parentIds.push(link.parent_id);
          } else {
            studentParentMap.set(studentData.id, {
              student: studentData,
              parentIds: [link.parent_id],
            });
          }
        }

        // 후보 목록에 추가
        for (const [siblingId, data] of studentParentMap) {
          if (addedStudentIds.has(siblingId)) continue;

          addedStudentIds.add(siblingId);
          candidates.push({
            studentId: siblingId,
            studentName: data.student.name,
            grade: data.student.grade,
            source: "same_parent",
            confidence: 90, // 같은 부모는 높은 신뢰도
            sharedParentIds: data.parentIds,
          });
        }
      }
    }

    // 3. 같은 전화번호 기반 감지 (추후 구현)
    // TODO: phone 필드가 있다면 같은 전화번호 학생 검색

    // 신뢰도 높은 순으로 정렬
    candidates.sort((a, b) => b.confidence - a.confidence);

    return { success: true, data: { candidates } };
  } catch (error) {
    logActionError(
      { domain: "family", action: "findSiblingCandidates" },
      error,
      { studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "형제자매 후보 검색에 실패했습니다.",
    };
  }
}
