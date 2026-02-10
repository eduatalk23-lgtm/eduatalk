"use server";

import { requireParent } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { revalidatePath } from "next/cache";
import { PARENT_STUDENT_LINK_MESSAGES } from "@/lib/constants/parentStudentLinkMessages";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { AppError, ErrorCode } from "@/lib/errors";
import { logActionError } from "@/lib/logging/actionLogger";
import { withActionResponse } from "@/lib/utils/serverActionHandler";
import type { SearchableStudent, LinkRequest, ParentRelation } from "../types";

/**
 * Supabase 쿼리 결과 타입: parent_student_links with students join
 */
type LinkRequestWithStudent = {
  id: string;
  student_id: string;
  relation: string | null;
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
};

/**
 * 학부모가 학생을 검색 (이름, 학년, 반)
 * 이미 연결된 학생은 제외
 */
async function _searchStudentsForLink(
  query: string,
  parentId: string
): Promise<SearchableStudent[]> {
  const { userId } = await requireParent();

  // 본인만 검색 가능
  if (userId !== parentId) {
    throw new AppError(
      PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // 최소 2글자 이상 검색
  if (!query || query.trim().length < 2) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const searchQuery = query.trim();

  // 이미 연결된 학생 ID 조회
  const { data: existingLinks, error: linksError } = await supabase
    .from("parent_student_links")
    .select("student_id")
    .eq("parent_id", parentId);

  if (linksError) {
    logActionError({ domain: "parent", action: "searchStudentsForLink" }, linksError);
  }

  const excludedStudentIds = new Set(
    (existingLinks || []).map((link) => link.student_id)
  );

  // 통합 검색 함수 사용 (이름 + 연락처 검색 지원)
  const { searchStudentsUnified } = await import("@/lib/data/studentSearch");

  const searchResult = await searchStudentsUnified({
    query: searchQuery,
    filters: {
      isActive: true,
    },
    limit: 10,
    role: "parent",
    excludeStudentIds: Array.from(excludedStudentIds),
  });

  if (!searchResult.students) {
    return [];
  }

  // 데이터 변환
  const searchResults: SearchableStudent[] = searchResult.students.map((student) => ({
    id: student.id,
    name: student.name ?? null,
    grade: student.grade != null ? String(student.grade) : null,
    class: student.class,
  }));

  return searchResults;
}

export const searchStudentsForLink = withActionResponse(_searchStudentsForLink);

/**
 * 연결 요청 생성 (즉시 연결 - 승인 워크플로우 제거됨)
 */
async function _createLinkRequest(
  studentId: string,
  parentId: string,
  relation: ParentRelation
): Promise<{ requestId: string }> {
  const { userId } = await requireParent();

  // 본인만 요청 가능
  if (userId !== parentId) {
    throw new AppError(
      PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  // relation 값 검증 및 매핑 ("other"는 "guardian"으로 매핑)
  const validRelations: ParentRelation[] = ["father", "mother", "guardian", "other"];
  if (!validRelations.includes(relation)) {
    throw new AppError(
      PARENT_STUDENT_LINK_MESSAGES.errors.INVALID_RELATION,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
  // DB 제약조건은 'father', 'mother', 'guardian'만 허용하므로 "other"를 "guardian"으로 매핑
  const dbRelation = relation === "other" ? "guardian" : relation;

  const supabase = await createSupabaseServerClient();

  // 중복 체크 (이미 연결된 경우)
  const { data: existing, error: checkError } = await supabase
    .from("parent_student_links")
    .select("id")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    logActionError({ domain: "parent", action: "createLinkRequest.checkDuplicate" }, checkError);
    throw new AppError(
      "연결 확인 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  if (existing) {
    throw new AppError(
      PARENT_STUDENT_LINK_MESSAGES.errors.ALREADY_LINKED,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  // tenant_id 조회 (학생의 tenant_id 사용)
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    throw new AppError(
      "서버 설정 오류가 발생했습니다.",
      ErrorCode.CONFIGURATION_ERROR,
      500,
      true
    );
  }

  const { data: student, error: studentError } = await adminClient
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    logActionError({ domain: "parent", action: "createLinkRequest.fetchStudent" }, studentError);
  }

  if (!student?.tenant_id) {
    throw new AppError(
      "학생 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 연결 생성 (즉시 연결)
  const { data, error } = await supabase
    .from("parent_student_links")
    .insert({
      student_id: studentId,
      parent_id: parentId,
      relation: dbRelation,
      tenant_id: student.tenant_id,
    })
    .select("id")
    .single();

  if (error) {
    // UNIQUE 제약조건 에러 처리
    if (error.code === "23505") {
      throw new AppError(
        PARENT_STUDENT_LINK_MESSAGES.errors.REQUEST_ALREADY_EXISTS,
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }

    logActionError({ domain: "parent", action: "createLinkRequest" }, error);
    throw new AppError(
      error.message || "연결 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/parent/settings");

  return { requestId: data.id };
}

export const createLinkRequest = withActionResponse(_createLinkRequest);

/**
 * 학부모의 연결 목록 조회
 */
async function _getLinkRequests(parentId: string): Promise<LinkRequest[]> {
  const { userId } = await requireParent();

  // 본인만 조회 가능
  if (userId !== parentId) {
    throw new AppError(
      PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  const selectLinks = () =>
    supabase
      .from("parent_student_links")
      .select(`
        id,
        student_id,
        relation,
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
  if (ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ data: links, error } = await selectLinks());
  }

  if (error) {
    logActionError({ domain: "parent", action: "getLinkRequests" }, error);
    throw new AppError(
      error.message || "연결 목록을 조회할 수 없습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  if (!links) {
    return [];
  }

  // 데이터 변환
  const requests: LinkRequest[] = (links as LinkRequestWithStudent[])
    .map((link) => {
      const student = extractJoinResult(link.students);
      if (!student) return null;

      return {
        id: link.id,
        studentId: link.student_id,
        studentName: student.name,
        grade: student.grade,
        class: student.class,
        relation: link.relation || "other",
        created_at: link.created_at,
      };
    })
    .filter((r): r is LinkRequest => r !== null);

  return requests;
}

export const getLinkRequests = withActionResponse(_getLinkRequests);

/**
 * 연결 해제 (삭제)
 */
async function _cancelLinkRequest(requestId: string, parentId: string): Promise<void> {
  const { userId } = await requireParent();

  // 본인만 해제 가능
  if (userId !== parentId) {
    throw new AppError(
      PARENT_STUDENT_LINK_MESSAGES.errors.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const supabase = await createSupabaseServerClient();

  // 본인 연결인지 확인
  const { data: link, error: fetchError } = await supabase
    .from("parent_student_links")
    .select("id, parent_id")
    .eq("id", requestId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (fetchError) {
    logActionError({ domain: "parent", action: "cancelLinkRequest.fetch" }, fetchError);
    throw new AppError(
      "연결 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  if (!link) {
    throw new AppError("연결을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 연결 삭제
  const { error } = await supabase
    .from("parent_student_links")
    .delete()
    .eq("id", requestId)
    .eq("parent_id", parentId);

  if (error) {
    logActionError({ domain: "parent", action: "cancelLinkRequest" }, error);
    throw new AppError(
      error.message || "연결 해제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/parent/settings");
}

export const cancelLinkRequest = withActionResponse(_cancelLinkRequest);
