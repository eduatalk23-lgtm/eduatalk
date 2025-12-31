/**
 * Parent Domain Utilities
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionError } from "@/lib/logging/actionLogger";
import type { LinkedStudent } from "./types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * Supabase 쿼리 결과 타입: parent_student_links with students join
 * Note: Supabase 조인 쿼리는 students를 배열로 반환할 수 있음
 */
type ParentStudentLinkWithStudent = {
  student_id: string;
  relation: string | null;
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
 * 부모가 연결된 학생 목록 조회
 * 주의: is_approved = true인 링크만 반환 (승인된 연결만)
 */
export async function getLinkedStudents(
  supabase: SupabaseServerClient,
  parentId: string
): Promise<LinkedStudent[]> {
  try {
    const selectLinks = () =>
      supabase
        .from("parent_student_links")
        .select("student_id, relation, students(id, name, grade, class)")
        .eq("parent_id", parentId)
        .eq("is_approved", true); // P0 보안: 승인된 링크만 조회

    let { data: links, error } = await selectLinks();

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data: links, error } = await selectLinks());
    }

    if (error) {
      logActionError(
        { domain: "parent", action: "getLinkedStudents" },
        error,
        { parentId }
      );
      return [];
    }

    if (!links) return [];

    return (links as ParentStudentLinkWithStudent[])
      .map((link) => {
        const student = extractJoinResult(link.students);
        if (!student) return null;
        return {
          id: student.id,
          name: student.name,
          grade: student.grade,
          class: student.class,
          relation: link.relation ?? "",
        };
      })
      .filter((s): s is LinkedStudent => s !== null);
  } catch (error) {
    logActionError(
      { domain: "parent", action: "getLinkedStudents" },
      error,
      { parentId }
    );
    return [];
  }
}

/**
 * 부모가 특정 학생에 접근 권한이 있는지 확인
 */
export async function canAccessStudent(
  supabase: SupabaseServerClient,
  parentId: string,
  studentId: string
): Promise<boolean> {
  try {
    const selectLink = () =>
      supabase
        .from("parent_student_links")
        .select("id")
        .eq("parent_id", parentId)
        .eq("student_id", studentId)
        .eq("is_approved", true) // P0 보안: 승인된 링크만 접근 허용
        .maybeSingle();

    let { data: link, error } = await selectLink();

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data: link, error } = await selectLink());
    }

    if (error && error.code !== "PGRST116") {
      logActionError(
        { domain: "parent", action: "canAccessStudent" },
        error,
        { parentId, studentId }
      );
      return false;
    }

    return link !== null;
  } catch (error) {
    logActionError(
      { domain: "parent", action: "canAccessStudent" },
      error,
      { parentId, studentId }
    );
    return false;
  }
}
