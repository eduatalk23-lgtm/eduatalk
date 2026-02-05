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

export type PendingLinkRequest = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentGrade: string | null;
  studentClass: string | null;
  parentId: string;
  parentName: string | null;
  parentEmail: string | null;
  relation: string;
  created_at: string;
};

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

type ParentStudentLinkWithStudentRow = {
  id: string;
  student_id: string;
  parent_id: string;
  relation: string;
  created_at: string;
  students:
    | {
        id: string;
        name: string | null;
        grade: string | null;
        class: string | null;
      }
    | {
        id: string;
        name: string | null;
        grade: string | null;
        class: string | null;
      }[]
    | null;
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

/**
 * 승인 대기 중인 연결 요청 목록 조회
 */
export async function getPendingLinkRequests(tenantId?: string): Promise<{
  success: boolean;
  data?: PendingLinkRequest[];
  error?: string;
}> {
  // 권한 확인
  const { tenantId: userTenantId } = await requireAdminOrConsultant();

  const supabase = await createSupabaseServerClient();
  const targetTenantId = tenantId || userTenantId;

  try {
    // 테넌트 필터링: 먼저 해당 테넌트의 학생 ID 목록 조회
    let studentIds: string[] | undefined;
    if (targetTenantId) {
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", targetTenantId);

      if (studentsError) {
        logActionError(
          { domain: "student", action: "getPendingLinkRequests" },
          studentsError,
          { tenantId: targetTenantId }
        );
        return {
          success: false,
          error: "학생 목록을 조회할 수 없습니다.",
        };
      }

      studentIds = students?.map((s) => s.id) || [];
      if (studentIds.length === 0) {
        // 해당 테넌트에 학생이 없으면 빈 배열 반환
        return { success: true, data: [] };
      }
    }

    const selectLinks = () => {
      let query = supabase
        .from("parent_student_links")
        .select(
          `
          id,
          student_id,
          parent_id,
          relation,
          created_at,
          students:student_id(
            id,
            name,
            grade,
            class
          ),
          parent_users:parent_id(
            id,
            name
          )
        `
        )
        .or("is_approved.is.null,is_approved.eq.false")
        .order("created_at", { ascending: false });

      // 테넌트 필터링: 학생 ID 목록으로 필터링
      if (studentIds && studentIds.length > 0) {
        query = query.in("student_id", studentIds);
      }

      return query;
    };

    let { data: links, error } = await selectLinks();

    // 컬럼 없음 에러 처리 (42703)
    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data: links, error } = await selectLinks());
    }

    if (error) {
      logActionError(
        { domain: "student", action: "getPendingLinkRequests" },
        error,
        { tenantId: targetTenantId }
      );
      return {
        success: false,
        error: error.message || "승인 대기 요청을 조회할 수 없습니다.",
      };
    }

    if (!links) {
      return { success: true, data: [] };
    }

    // parent_users.id 목록 수집
    const parentIds = links
      .map((link) => {
        const parentUser = extractJoinResult(link.parent_users);
        return parentUser?.id;
      })
      .filter((id): id is string => id !== undefined);

    // auth.users에서 email 배치 조회 (N+1 문제 해결)
    const parentEmailsMap = new Map<string, string | null>();
    if (parentIds.length > 0) {
      const { getAuthUserMetadata } = await import("@/lib/utils/authUserMetadata");
      const adminClient = createSupabaseAdminClient();
      const userMetadata = await getAuthUserMetadata(adminClient, parentIds);
      
      // email만 추출하여 Map에 저장
      userMetadata.forEach((metadata, userId) => {
        parentEmailsMap.set(userId, metadata.email);
      });
    }

    // 데이터 변환
    const requests: PendingLinkRequest[] = links
      .map((link: ParentStudentLinkWithStudentRow) => {
        const student = extractJoinResult(link.students);
        if (!student) return null;

        const parentUser = extractJoinResult(link.parent_users);
        if (!parentUser) return null;

        return {
          id: link.id,
          studentId: link.student_id,
          studentName: student.name,
          studentGrade: student.grade,
          studentClass: student.class,
          parentId: link.parent_id,
          parentName: parentUser.name,
          parentEmail: parentEmailsMap.get(parentUser.id) || null,
          relation: link.relation || "other",
          created_at: link.created_at,
        };
      })
      .filter((r): r is PendingLinkRequest => r !== null);

    return { success: true, data: requests };
  } catch (error) {
    logActionError(
      { domain: "student", action: "getPendingLinkRequests" },
      error,
      { tenantId: targetTenantId }
    );
    return {
      success: false,
      error: "승인 대기 요청 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 연결 요청 승인
 */
export async function approveLinkRequest(
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
    // 먼저 요청 존재 여부 확인
    const { data: link, error: fetchError } = await supabase
      .from("parent_student_links")
      .select("id, student_id, parent_id, relation, is_approved")
      .eq("id", linkId)
      .maybeSingle();

    if (fetchError) {
      logActionError(
        { domain: "student", action: "approveLinkRequest" },
        fetchError,
        { linkId }
      );
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.FETCH_ERROR,
      };
    }

    if (!link) {
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_NOT_FOUND,
      };
    }

    // 이미 승인된 경우
    if (link.is_approved === true) {
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_ALREADY_APPROVED,
      };
    }

    // 승인 처리
    const { data: updatedRows, error } = await supabase
      .from("parent_student_links")
      .update({
        is_approved: true,
        approved_at: new Date().toISOString(),
      })
      .eq("id", linkId)
      .select();

    if (error) {
      logActionError(
        { domain: "student", action: "approveLinkRequest" },
        error,
        { linkId }
      );
      return {
        success: false,
        error: error.message || "요청 승인에 실패했습니다.",
      };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error: "연결 요청을 찾을 수 없습니다.",
      };
    }

    // 가족 통합 처리 (형제자매 자동 감지)
    try {
      const { handleParentLinkApproval } = await import("@/lib/domains/family");
      await handleParentLinkApproval(link.parent_id, link.student_id, link.relation);
    } catch (familyError) {
      // 가족 통합 실패는 연결 승인에 영향을 주지 않음
      logActionError(
        { domain: "student", action: "approveLinkRequest" },
        familyError,
        { linkId, context: "가족 통합 처리 실패 (무시됨)" }
      );
    }

    revalidatePath("/admin/parent-links");
    revalidatePath(`/admin/students/${link.student_id}`);
    revalidatePath("/admin/families");

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "student", action: "approveLinkRequest" },
      error,
      { linkId }
    );
    return {
      success: false,
      error: "요청 승인 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 연결 요청 거부 (삭제)
 */
export async function rejectLinkRequest(
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
    // 먼저 요청 존재 여부 확인
    const { data: link, error: fetchError } = await supabase
      .from("parent_student_links")
      .select("id, student_id")
      .eq("id", linkId)
      .maybeSingle();

    if (fetchError) {
      logActionError(
        { domain: "student", action: "rejectLinkRequest" },
        fetchError,
        { linkId }
      );
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.FETCH_ERROR,
      };
    }

    if (!link) {
      return {
        success: false,
        error: PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_NOT_FOUND,
      };
    }

    const studentId = link.student_id;

    // 요청 삭제 (거부)
    const { data: deletedRows, error } = await supabase
      .from("parent_student_links")
      .delete()
      .eq("id", linkId)
      .select();

    if (error) {
      logActionError(
        { domain: "student", action: "rejectLinkRequest" },
        error,
        { linkId }
      );
      return {
        success: false,
        error: error.message || "요청 거부에 실패했습니다.",
      };
    }

    if (!deletedRows || deletedRows.length === 0) {
      return {
        success: false,
        error: "연결 요청을 찾을 수 없습니다.",
      };
    }

    revalidatePath("/admin/parent-links");
    revalidatePath(`/admin/students/${studentId}`);

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "student", action: "rejectLinkRequest" },
      error,
      { linkId }
    );
    return {
      success: false,
      error: "요청 거부 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 여러 연결 요청을 한 번에 승인
 */
export async function approveLinkRequests(linkIds: string[]): Promise<{
  success: boolean;
  approvedCount?: number;
  errors?: Array<{ linkId: string; error: string }>;
}> {
  // 권한 확인
  await requireAdminOrConsultant();

  // 테넌트 컨텍스트 확인
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return {
      success: false,
      errors: [{ linkId: "", error: "기관 정보를 찾을 수 없습니다." }],
    };
  }

  if (!linkIds || linkIds.length === 0) {
    return { success: false, errors: [] };
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      success: false,
      errors: [
        {
          linkId: "",
          error:
            "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        },
      ],
    };
  }
  const errors: Array<{ linkId: string; error: string }> = [];
  let approvedCount = 0;
  const studentIds = new Set<string>();

  try {
    // 병렬 처리
    const updatePromises = linkIds.map(async (linkId) => {
      try {
        // 먼저 요청 존재 여부 확인
        const { data: link, error: fetchError } = await supabase
          .from("parent_student_links")
          .select("id, student_id, is_approved")
          .eq("id", linkId)
          .maybeSingle();

        if (fetchError || !link) {
          return {
            linkId,
            error: fetchError
              ? PARENT_STUDENT_LINK_MESSAGES.errors.FETCH_ERROR
              : PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_NOT_FOUND,
            link: null,
          };
        }

        // 이미 승인된 경우
        if (link.is_approved === true) {
          return {
            linkId,
            error: "이미 승인된 요청입니다.",
            link: null,
          };
        }

        // 승인 처리
        const { data: updatedRows, error } = await supabase
          .from("parent_student_links")
          .update({
            is_approved: true,
            approved_at: new Date().toISOString(),
          })
          .eq("id", linkId)
          .select();

        if (error) {
          return {
            linkId,
            error: error.message || "요청 승인에 실패했습니다.",
            link: null,
          };
        }

        if (!updatedRows || updatedRows.length === 0) {
          return {
            linkId,
            error: "연결 요청을 찾을 수 없습니다.",
            link: null,
          };
        }

        return { linkId, error: null, link };
      } catch (err) {
        logActionError(
          { domain: "student", action: "approveLinkRequests" },
          err,
          { linkId }
        );
        return {
          linkId,
          error: "요청 승인 중 오류가 발생했습니다.",
          link: null,
        };
      }
    });

    const results = await Promise.all(updatePromises);

    // 결과 집계
    for (const result of results) {
      if (result.error) {
        errors.push({ linkId: result.linkId, error: result.error });
      } else if (result.link) {
        approvedCount++;
        studentIds.add(result.link.student_id);
      }
    }

    // 성공한 항목이 있으면 경로 재검증
    if (approvedCount > 0) {
      revalidatePath("/admin/parent-links");
      for (const studentId of studentIds) {
        revalidatePath(`/admin/students/${studentId}`);
      }
    }

    return {
      success: errors.length === 0,
      approvedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    logActionError(
      { domain: "student", action: "approveLinkRequests" },
      error,
      { linkIds }
    );
    return {
      success: false,
      approvedCount: 0,
      errors: [{ linkId: "", error: "일괄 승인 중 오류가 발생했습니다." }],
    };
  }
}

/**
 * 여러 연결 요청을 한 번에 거부 (삭제)
 */
export async function rejectLinkRequests(linkIds: string[]): Promise<{
  success: boolean;
  rejectedCount?: number;
  errors?: Array<{ linkId: string; error: string }>;
}> {
  // 권한 확인
  await requireAdminOrConsultant();

  // 테넌트 컨텍스트 확인
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return {
      success: false,
      errors: [{ linkId: "", error: "기관 정보를 찾을 수 없습니다." }],
    };
  }

  if (!linkIds || linkIds.length === 0) {
    return { success: false, errors: [] };
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      success: false,
      errors: [
        {
          linkId: "",
          error:
            "관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.",
        },
      ],
    };
  }
  const errors: Array<{ linkId: string; error: string }> = [];
  let rejectedCount = 0;
  const studentIds = new Set<string>();

  try {
    // 병렬 처리
    const deletePromises = linkIds.map(async (linkId) => {
      try {
        // 먼저 요청 존재 여부 확인
        const { data: link, error: fetchError } = await supabase
          .from("parent_student_links")
          .select("id, student_id")
          .eq("id", linkId)
          .maybeSingle();

        if (fetchError || !link) {
          return {
            linkId,
            error: fetchError
              ? PARENT_STUDENT_LINK_MESSAGES.errors.FETCH_ERROR
              : PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_NOT_FOUND,
            studentId: null,
          };
        }

        const studentId = link.student_id;

        // 요청 삭제 (거부)
        const { data: deletedRows, error } = await supabase
          .from("parent_student_links")
          .delete()
          .eq("id", linkId)
          .select();

        if (error) {
          return {
            linkId,
            error: error.message || "요청 거부에 실패했습니다.",
            studentId: null,
          };
        }

        if (!deletedRows || deletedRows.length === 0) {
          return {
            linkId,
            error: "연결 요청을 찾을 수 없습니다.",
            studentId: null,
          };
        }

        return { linkId, error: null, studentId };
      } catch (err) {
        logActionError(
          { domain: "student", action: "rejectLinkRequests" },
          err,
          { linkId }
        );
        return {
          linkId,
          error: "요청 거부 중 오류가 발생했습니다.",
          studentId: null,
        };
      }
    });

    const results = await Promise.all(deletePromises);

    // 결과 집계
    for (const result of results) {
      if (result.error) {
        errors.push({ linkId: result.linkId, error: result.error });
      } else if (result.studentId) {
        rejectedCount++;
        studentIds.add(result.studentId);
      }
    }

    // 성공한 항목이 있으면 경로 재검증
    if (rejectedCount > 0) {
      revalidatePath("/admin/parent-links");
      for (const studentId of studentIds) {
        revalidatePath(`/admin/students/${studentId}`);
      }
    }

    return {
      success: errors.length === 0,
      rejectedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    logActionError(
      { domain: "student", action: "rejectLinkRequests" },
      error,
      { linkIds }
    );
    return {
      success: false,
      rejectedCount: 0,
      errors: [{ linkId: "", error: "일괄 거부 중 오류가 발생했습니다." }],
    };
  }
}
