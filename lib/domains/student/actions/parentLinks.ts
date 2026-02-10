"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { revalidatePath } from "next/cache";
import { PARENT_STUDENT_LINK_MESSAGES } from "@/lib/constants/parentStudentLinkMessages";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionError } from "@/lib/logging/actionLogger";

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

// PendingLinkRequest type removed - approval workflow eliminated

// Supabase 쿼리 결과 타입
type ParentStudentLinkRow = {
  id: string;
  parent_id: string;
  relation: string;
  parent_users:
    | {
        id: string;
        name: string | null;
      }
    | {
        id: string;
        name: string | null;
      }[]
    | null;
};

// ParentStudentLinkWithStudentRow removed - was only used by approval workflow

type SearchableParentRow = {
  id: string;
  name: string | null;
};

/**
 * 학생에 연결된 학부모 목록 조회
 */
export async function getStudentParents(
  studentId: string
): Promise<{ success: boolean; data?: StudentParent[]; error?: string }> {
  // 권한 확인
  await requireAdminOrConsultant();

  const supabase = await createSupabaseServerClient();

  try {
    const selectLinks = () =>
      supabase
        .from("parent_student_links")
        .select(
          `
          id,
          relation,
          parent_id,
          parent_users:parent_id(
            id,
            name
          )
        `
        )
        .eq("student_id", studentId);

    let { data: links, error } = await selectLinks();

    // 컬럼 없음 에러 처리 (42703)
    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data: links, error } = await selectLinks());
    }

    if (error) {
      logActionError(
        { domain: "student", action: "getStudentParents" },
        error,
        { studentId }
      );
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
      .map((link: ParentStudentLinkRow): StudentParent | null => {
        const parentUser = extractJoinResult(link.parent_users);
        if (!parentUser) return null;

        return {
          linkId: link.id,
          parentId: link.parent_id,
          parentName: parentUser.name,
          parentEmail: null,
          relation: link.relation || "other",
        };
      })
      .filter((p): p is StudentParent => p !== null);

    return { success: true, data: parents };
  } catch (error) {
    logActionError(
      { domain: "student", action: "getStudentParents" },
      error,
      { studentId }
    );
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
  // 권한 확인
  await requireAdminOrConsultant();

  // 최소 2글자 이상 검색
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const searchQuery = query.trim();

    // parent_users에서 직접 검색 (name만 사용, email은 auth.users에 있어 조회 불가)
    const selectParents = () =>
      supabase
        .from("parent_users")
        .select(
          `
          id,
          name
        `
        )
        .ilike("name", `%${searchQuery}%`)
        .limit(10);

    // tenant_id 필터 추가 (있는 경우)
    let queryBuilder = selectParents();
    if (tenantId) {
      queryBuilder = queryBuilder.eq("tenant_id", tenantId);
    }

    let { data: parents, error } = await queryBuilder;

    // 컬럼 없음 에러 처리 (42703)
    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data: parents, error } = await queryBuilder);
    }

    if (error) {
      logActionError(
        { domain: "student", action: "searchParents" },
        error,
        { query, tenantId }
      );
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
      .map((parent: SearchableParentRow): SearchableParent | null => {
        if (!parent.name) return null;

        return {
          id: parent.id,
          name: parent.name,
          email: null,
        };
      })
      .filter((p): p is SearchableParent => p !== null);

    return { success: true, data: searchResults };
  } catch (error) {
    logActionError(
      { domain: "student", action: "searchParents" },
      error,
      { query, tenantId }
    );
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
  // 권한 확인
  await requireAdminOrConsultant();

  // relation 값 검증
  const validRelations: ParentRelation[] = [
    "father",
    "mother",
    "guardian",
    "other",
  ];
  if (!validRelations.includes(relation)) {
    return {
      success: false,
      error: PARENT_STUDENT_LINK_MESSAGES.errors.INVALID_RELATION,
    };
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
      logActionError(
        { domain: "student", action: "createParentStudentLink" },
        checkError,
        { studentId, parentId, relation }
      );
      return {
        success: false,
        error: "연결 확인 중 오류가 발생했습니다.",
      };
    }

    if (existing) {
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.LINK_ALREADY_EXISTS,
      };
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
        return {
          success: false,
          error: PARENT_STUDENT_LINK_MESSAGES.errors.LINK_ALREADY_EXISTS,
        };
      }

      logActionError(
        { domain: "student", action: "createParentStudentLink" },
        error,
        { studentId, parentId, relation }
      );
      return {
        success: false,
        error: error.message || "연결 생성에 실패했습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true, linkId: data.id };
  } catch (error) {
    logActionError(
      { domain: "student", action: "createParentStudentLink" },
      error,
      { studentId, parentId, relation }
    );
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
  // 권한 확인
  await requireAdminOrConsultant();

  // 테넌트 컨텍스트 확인
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      success: false,
      error:
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
    };
  }

  try {
    // 먼저 student_id를 조회하여 revalidatePath에 사용
    const { data: link, error: fetchError } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("id", linkId)
      .maybeSingle();

    if (fetchError) {
      logActionError(
        { domain: "student", action: "deleteParentStudentLink" },
        fetchError,
        { linkId }
      );
      return {
        success: false,
        error: "연결 정보를 찾을 수 없습니다.",
      };
    }

    if (!link) {
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.LINK_NOT_FOUND,
      };
    }

    const studentId = link.student_id;

    // 연결 삭제
    const { data: deletedRows, error } = await supabase
      .from("parent_student_links")
      .delete()
      .eq("id", linkId)
      .select();

    if (error) {
      logActionError(
        { domain: "student", action: "deleteParentStudentLink" },
        error,
        { linkId }
      );
      return {
        success: false,
        error: error.message || "연결 삭제에 실패했습니다.",
      };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return {
        success: false,
        error: "연결을 찾을 수 없습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "student", action: "deleteParentStudentLink" },
      error,
      { linkId }
    );
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
  // 권한 확인
  await requireAdminOrConsultant();

  // relation 값 검증
  const validRelations: ParentRelation[] = [
    "father",
    "mother",
    "guardian",
    "other",
  ];
  if (!validRelations.includes(relation)) {
    return {
      success: false,
      error: PARENT_STUDENT_LINK_MESSAGES.errors.INVALID_RELATION,
    };
  }

  // 테넌트 컨텍스트 확인
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return { success: false, error: "기관 정보를 찾을 수 없습니다." };
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      success: false,
      error:
        "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
    };
  }

  try {
    // 먼저 student_id를 조회하여 revalidatePath에 사용
    const { data: link, error: fetchError } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("id", linkId)
      .maybeSingle();

    if (fetchError) {
      logActionError(
        { domain: "student", action: "updateLinkRelation" },
        fetchError,
        { linkId, relation }
      );
      return {
        success: false,
        error: "연결 정보를 찾을 수 없습니다.",
      };
    }

    if (!link) {
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.LINK_NOT_FOUND,
      };
    }

    const studentId = link.student_id;

    // 관계 수정
    const { data: updatedRows, error } = await supabase
      .from("parent_student_links")
      .update({ relation })
      .eq("id", linkId)
      .select();

    if (error) {
      logActionError(
        { domain: "student", action: "updateLinkRelation" },
        error,
        { linkId, relation }
      );
      return {
        success: false,
        error: error.message || "관계 수정에 실패했습니다.",
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error: "연결을 찾을 수 없습니다.",
      };
    }

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "student", action: "updateLinkRelation" },
      error,
      { linkId, relation }
    );
    return {
      success: false,
      error: "관계 수정 중 오류가 발생했습니다.",
    };
  }
}

// Approval workflow functions removed:
// getPendingLinkRequests, approveLinkRequest, rejectLinkRequest,
// approveLinkRequests, rejectLinkRequests
// The new system uses invite_codes for instant connection (no approval needed)
