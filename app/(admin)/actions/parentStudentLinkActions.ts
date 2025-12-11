"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// 타입 정의
export type StudentParent = {
  linkId: string;
  parentId: string;
  parentName: string | null;
  parentEmail: string | null;
  relation: string;
};

export type SearchableParent = {
  id: string;
  name: string | null;
  email: string | null;
};

export type ParentRelation = "father" | "mother" | "guardian" | "other";

/**
 * 학생에 연결된 학부모 목록 조회
 */
export async function getStudentParents(
  studentId: string
): Promise<{ success: boolean; data?: StudentParent[]; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const selectLinks = () =>
      supabase
        .from("parent_student_links")
        .select(`
          id,
          relation,
          parent_id,
          parent_users:parent_id(
            id,
            users:id(
              id,
              name,
              email
            )
          )
        `)
        .eq("student_id", studentId);

    let { data: links, error } = await selectLinks();

    // 컬럼 없음 에러 처리 (42703)
    if (error && error.code === "42703") {
      ({ data: links, error } = await selectLinks());
    }

    if (error) {
      console.error("[admin/parentStudentLink] 학부모 목록 조회 실패", error);
      return {
        success: false,
        error: error.message || "학부모 목록을 조회할 수 없습니다.",
      };
    }

    if (!links) {
      return { success: true, data: [] };
    }

    // 데이터 변환
    const parents: StudentParent[] = links
      .map((link: any) => {
        const parentUser = link.parent_users;
        if (!parentUser) return null;

        const user = parentUser.users;
        if (!user) return null;

        return {
          linkId: link.id,
          parentId: link.parent_id,
          parentName: user.name,
          parentEmail: user.email,
          relation: link.relation || "other",
        };
      })
      .filter((p): p is StudentParent => p !== null);

    return { success: true, data: parents };
  } catch (error) {
    console.error("[admin/parentStudentLink] 학부모 목록 조회 중 오류", error);
    return {
      success: false,
      error: "학부모 목록을 조회하는 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학부모 검색 (이름 또는 이메일)
 */
export async function searchParents(
  query: string,
  tenantId?: string
): Promise<{ success: boolean; data?: SearchableParent[]; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  // 최소 2글자 이상 검색
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const searchQuery = query.trim();

    // parent_users와 users 조인하여 검색
    const selectParents = () =>
      supabase
        .from("parent_users")
        .select(`
          id,
          users:id(
            id,
            name,
            email
          )
        `)
        .or(`users.name.ilike.%${searchQuery}%,users.email.ilike.%${searchQuery}%`)
        .limit(10);

    // tenant_id 필터 추가 (있는 경우)
    let queryBuilder = selectParents();
    if (tenantId) {
      queryBuilder = queryBuilder.eq("tenant_id", tenantId);
    }

    let { data: parents, error } = await queryBuilder;

    // 컬럼 없음 에러 처리 (42703)
    if (error && error.code === "42703") {
      ({ data: parents, error } = await queryBuilder);
    }

    if (error) {
      console.error("[admin/parentStudentLink] 학부모 검색 실패", error);
      return {
        success: false,
        error: error.message || "학부모 검색에 실패했습니다.",
      };
    }

    if (!parents) {
      return { success: true, data: [] };
    }

    // 데이터 변환
    const searchResults: SearchableParent[] = parents
      .map((parent: any) => {
        const user = parent.users;
        if (!user) return null;

        return {
          id: parent.id,
          name: user.name,
          email: user.email,
        };
      })
      .filter((p): p is SearchableParent => p !== null);

    return { success: true, data: searchResults };
  } catch (error) {
    console.error("[admin/parentStudentLink] 학부모 검색 중 오류", error);
    return {
      success: false,
      error: "학부모 검색 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학생-학부모 연결 생성
 */
export async function createParentStudentLink(
  studentId: string,
  parentId: string,
  relation: ParentRelation
): Promise<{ success: boolean; linkId?: string; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  // relation 값 검증
  const validRelations: ParentRelation[] = ["father", "mother", "guardian", "other"];
  if (!validRelations.includes(relation)) {
    return { success: false, error: "올바른 관계를 선택해주세요." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 중복 체크
    const { data: existing, error: checkError } = await supabase
      .from("parent_student_links")
      .select("id")
      .eq("student_id", studentId)
      .eq("parent_id", parentId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[admin/parentStudentLink] 중복 체크 실패", checkError);
      return {
        success: false,
        error: "연결 확인 중 오류가 발생했습니다.",
      };
    }

    if (existing) {
      return { success: false, error: "이미 연결된 학부모입니다." };
    }

    // 연결 생성
    const { data, error } = await supabase
      .from("parent_student_links")
      .insert({
        student_id: studentId,
        parent_id: parentId,
        relation: relation,
      })
      .select("id")
      .single();

    if (error) {
      // UNIQUE 제약조건 에러 처리
      if (error.code === "23505") {
        return { success: false, error: "이미 연결된 학부모입니다." };
      }

      console.error("[admin/parentStudentLink] 연결 생성 실패", error);
      return {
        success: false,
        error: error.message || "연결 생성에 실패했습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true, linkId: data.id };
  } catch (error) {
    console.error("[admin/parentStudentLink] 연결 생성 중 오류", error);
    return {
      success: false,
      error: "연결 생성 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학생-학부모 연결 삭제
 */
export async function deleteParentStudentLink(
  linkId: string
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 먼저 student_id를 조회하여 revalidatePath에 사용
    const { data: link, error: fetchError } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("id", linkId)
      .maybeSingle();

    if (fetchError) {
      console.error("[admin/parentStudentLink] 연결 조회 실패", fetchError);
      return {
        success: false,
        error: "연결 정보를 찾을 수 없습니다.",
      };
    }

    if (!link) {
      return { success: false, error: "연결을 찾을 수 없습니다." };
    }

    const studentId = link.student_id;

    // 연결 삭제
    const { error } = await supabase
      .from("parent_student_links")
      .delete()
      .eq("id", linkId);

    if (error) {
      console.error("[admin/parentStudentLink] 연결 삭제 실패", error);
      return {
        success: false,
        error: error.message || "연결 삭제에 실패했습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    console.error("[admin/parentStudentLink] 연결 삭제 중 오류", error);
    return {
      success: false,
      error: "연결 삭제 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 연결의 관계 수정
 */
export async function updateLinkRelation(
  linkId: string,
  relation: ParentRelation
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  // relation 값 검증
  const validRelations: ParentRelation[] = ["father", "mother", "guardian", "other"];
  if (!validRelations.includes(relation)) {
    return { success: false, error: "올바른 관계를 선택해주세요." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 먼저 student_id를 조회하여 revalidatePath에 사용
    const { data: link, error: fetchError } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("id", linkId)
      .maybeSingle();

    if (fetchError) {
      console.error("[admin/parentStudentLink] 연결 조회 실패", fetchError);
      return {
        success: false,
        error: "연결 정보를 찾을 수 없습니다.",
      };
    }

    if (!link) {
      return { success: false, error: "연결을 찾을 수 없습니다." };
    }

    const studentId = link.student_id;

    // 관계 수정
    const { error } = await supabase
      .from("parent_student_links")
      .update({ relation })
      .eq("id", linkId);

    if (error) {
      console.error("[admin/parentStudentLink] 관계 수정 실패", error);
      return {
        success: false,
        error: error.message || "관계 수정에 실패했습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    console.error("[admin/parentStudentLink] 관계 수정 중 오류", error);
    return {
      success: false,
      error: "관계 수정 중 오류가 발생했습니다.",
    };
  }
}

