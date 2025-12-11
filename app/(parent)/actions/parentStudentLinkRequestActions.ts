"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAutoApproveSettings } from "@/app/(admin)/actions/tenantSettingsActions";
import { checkAutoApproveConditions } from "@/lib/utils/autoApprove";
import { PARENT_STUDENT_LINK_MESSAGES } from "@/lib/constants/parentStudentLinkMessages";

// 타입 정의
export type SearchableStudent = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
};

export type LinkRequest = {
  id: string;
  studentId: string;
  studentName: string | null;
  grade: string | null;
  class: string | null;
  relation: string;
  is_approved: boolean | null;
  created_at: string;
};

export type ParentRelation = "father" | "mother" | "guardian" | "other";

/**
 * 학부모가 학생을 검색 (이름, 학년, 반)
 * 이미 연결된 학생과 요청 중인 학생은 제외
 */
export async function searchStudentsForLink(
  query: string,
  parentId: string
): Promise<{ success: boolean; data?: SearchableStudent[]; error?: string }> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  // 본인만 검색 가능
  if (userId !== parentId) {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  // 최소 2글자 이상 검색
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const searchQuery = query.trim();

    // 이미 연결되거나 요청 중인 학생 ID 조회
    const { data: existingLinks, error: linksError } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", parentId);

    if (linksError) {
      console.error(
        "[parent/linkRequest] 기존 연결 조회 실패",
        linksError
      );
      // 에러가 있어도 계속 진행 (RLS 정책 문제일 수 있음)
    }

    const excludedStudentIds = new Set(
      (existingLinks || []).map((link) => link.student_id)
    );

    // 학생 검색 (이름으로 검색)
    const selectStudents = () =>
      supabase
        .from("students")
        .select("id, name, grade, class")
        .ilike("name", `%${searchQuery}%`)
        .limit(10);

    let { data: students, error } = await selectStudents();

    // 컬럼 없음 에러 처리 (42703)
    if (error && error.code === "42703") {
      ({ data: students, error } = await selectStudents());
    }

    if (error) {
      console.error("[parent/linkRequest] 학생 검색 실패", error);
      return {
        success: false,
        error: error.message || "학생 검색에 실패했습니다.",
      };
    }

    if (!students) {
      return { success: true, data: [] };
    }

    // 이미 연결되거나 요청 중인 학생 제외
    const filtered = students.filter(
      (student) => !excludedStudentIds.has(student.id)
    );

    // 데이터 변환
    const searchResults: SearchableStudent[] = filtered.map((student) => ({
      id: student.id,
      name: student.name,
      grade: student.grade,
      class: student.class,
    }));

    return { success: true, data: searchResults };
  } catch (error) {
    console.error("[parent/linkRequest] 학생 검색 중 오류", error);
    return {
      success: false,
      error: "학생 검색 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 연결 요청 생성
 */
export async function createLinkRequest(
  studentId: string,
  parentId: string,
  relation: ParentRelation
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  // 본인만 요청 가능
  if (userId !== parentId) {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  // relation 값 검증
  const validRelations: ParentRelation[] = ["father", "mother", "guardian", "other"];
  if (!validRelations.includes(relation)) {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.INVALID_RELATION };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 중복 체크 (이미 연결되거나 요청 중인 경우)
    const { data: existing, error: checkError } = await supabase
      .from("parent_student_links")
      .select("id, is_approved")
      .eq("student_id", studentId)
      .eq("parent_id", parentId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[parent/linkRequest] 중복 체크 실패", checkError);
      return {
        success: false,
        error: "연결 확인 중 오류가 발생했습니다.",
      };
    }

    if (existing) {
      // 이미 승인된 경우
      if (existing.is_approved === true) {
        return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.ALREADY_LINKED };
      }
      // 대기 중인 경우
      return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_ALREADY_EXISTS };
    }

    // 자동 승인 로직: 학생과 학부모의 tenant_id 조회 (병렬 처리)
    const [studentResult, parentResult] = await Promise.all([
      supabase
        .from("students")
        .select("tenant_id")
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("parent_users")
        .select("tenant_id")
        .eq("id", parentId)
        .maybeSingle(),
    ]);

    const { data: student, error: studentError } = studentResult;
    const { data: parent, error: parentError } = parentResult;

    if (studentError) {
      console.error("[parent/linkRequest] 학생 정보 조회 실패", studentError);
      // 에러가 있어도 계속 진행 (자동 승인 실패 시 수동 승인으로 폴백)
    }

    if (parentError) {
      console.error("[parent/linkRequest] 학부모 정보 조회 실패", parentError);
      // 에러가 있어도 계속 진행 (자동 승인 실패 시 수동 승인으로 폴백)
    }

    // 자동 승인 설정 조회 및 조건 확인
    let shouldAutoApprove = false;
    if (student?.tenant_id) {
      try {
        const autoApproveResult = await getAutoApproveSettings(
          student.tenant_id
        );

        if (
          autoApproveResult.success &&
          autoApproveResult.data &&
          student?.tenant_id &&
          parent?.tenant_id
        ) {
          shouldAutoApprove = checkAutoApproveConditions(
            autoApproveResult.data,
            student.tenant_id,
            parent.tenant_id,
            relation
          );
        }
      } catch (error) {
        console.error(
          "[parent/linkRequest] 자동 승인 설정 조회 실패",
          error
        );
        // 에러 발생 시 수동 승인으로 폴백
      }
    }

    // 연결 요청 생성 (자동 승인 조건 만족 시 is_approved: true)
    const insertData: {
      student_id: string;
      parent_id: string;
      relation: string;
      is_approved: boolean;
      approved_at?: string;
    } = {
      student_id: studentId,
      parent_id: parentId,
      relation: relation,
      is_approved: shouldAutoApprove,
    };

    if (shouldAutoApprove) {
      insertData.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("parent_student_links")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      // UNIQUE 제약조건 에러 처리
      if (error.code === "23505") {
        return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_ALREADY_EXISTS };
      }

      console.error("[parent/linkRequest] 연결 요청 생성 실패", error);
      return {
        success: false,
        error: error.message || "연결 요청 생성에 실패했습니다.",
      };
    }

    revalidatePath("/parent/settings");

    return { success: true, requestId: data.id };
  } catch (error) {
    console.error("[parent/linkRequest] 연결 요청 생성 중 오류", error);
    return {
      success: false,
      error: "연결 요청 생성 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학부모의 연결 요청 목록 조회
 */
export async function getLinkRequests(
  parentId: string
): Promise<{ success: boolean; data?: LinkRequest[]; error?: string }> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  // 본인만 조회 가능
  if (userId !== parentId) {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const selectLinks = () =>
      supabase
        .from("parent_student_links")
        .select(`
          id,
          student_id,
          relation,
          is_approved,
          created_at,
          students:student_id(
            id,
            name,
            grade,
            class
          )
        `)
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false });

    let { data: links, error } = await selectLinks();

    // 컬럼 없음 에러 처리 (42703)
    if (error && error.code === "42703") {
      ({ data: links, error } = await selectLinks());
    }

    if (error) {
      console.error("[parent/linkRequest] 요청 목록 조회 실패", error);
      return {
        success: false,
        error: error.message || "요청 목록을 조회할 수 없습니다.",
      };
    }

    if (!links) {
      return { success: true, data: [] };
    }

    // 데이터 변환
    const requests: LinkRequest[] = links
      .map((link: any) => {
        const student = link.students;
        if (!student) return null;

        return {
          id: link.id,
          studentId: link.student_id,
          studentName: student.name,
          grade: student.grade,
          class: student.class,
          relation: link.relation || "other",
          is_approved: link.is_approved,
          created_at: link.created_at,
        };
      })
      .filter((r): r is LinkRequest => r !== null);

    // 상태별 정렬: 대기 중(null/false) → 승인됨(true) → 거부됨(false, 최신순)
    requests.sort((a, b) => {
      // 대기 중인 요청을 먼저
      if (a.is_approved === null || a.is_approved === false) {
        if (b.is_approved === true) return -1;
      }
      if (b.is_approved === null || b.is_approved === false) {
        if (a.is_approved === true) return 1;
      }
      // 같은 상태면 최신순
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return { success: true, data: requests };
  } catch (error) {
    console.error("[parent/linkRequest] 요청 목록 조회 중 오류", error);
    return {
      success: false,
      error: "요청 목록 조회 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 대기 중인 연결 요청 취소
 */
export async function cancelLinkRequest(
  requestId: string,
  parentId: string
): Promise<{ success: boolean; error?: string }> {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  // 본인만 취소 가능
  if (userId !== parentId) {
    return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 먼저 요청 정보 조회 (본인 요청인지, 대기 중인지 확인)
    const { data: link, error: fetchError } = await supabase
      .from("parent_student_links")
      .select("id, parent_id, is_approved")
      .eq("id", requestId)
      .eq("parent_id", parentId)
      .maybeSingle();

    if (fetchError) {
      console.error("[parent/linkRequest] 요청 조회 실패", fetchError);
      return {
        success: false,
        error: "요청 정보를 찾을 수 없습니다.",
      };
    }

    if (!link) {
      return { success: false, error: "요청을 찾을 수 없습니다." };
    }

    // 대기 중인 요청만 취소 가능
    if (link.is_approved === true) {
      return { success: false, error: PARENT_STUDENT_LINK_MESSAGES.errors.CANNOT_CANCEL_APPROVED };
    }

    // 요청 삭제
    const { error } = await supabase
      .from("parent_student_links")
      .delete()
      .eq("id", requestId)
      .eq("parent_id", parentId);

    if (error) {
      console.error("[parent/linkRequest] 요청 취소 실패", error);
      return {
        success: false,
        error: error.message || "요청 취소에 실패했습니다.",
      };
    }

    revalidatePath("/parent/settings");

    return { success: true };
  } catch (error) {
    console.error("[parent/linkRequest] 요청 취소 중 오류", error);
    return {
      success: false,
      error: "요청 취소 중 오류가 발생했습니다.",
    };
  }
}

