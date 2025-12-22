/**
 * Parent Domain Utilities
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LinkedStudent } from "./types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 부모가 연결된 학생 목록 조회
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
        .eq("parent_id", parentId);

    let { data: links, error } = await selectLinks();

    if (error && error.code === "42703") {
      ({ data: links, error } = await selectLinks());
    }

    if (error) {
      console.error("[parent] 연결된 학생 조회 실패", error);
      return [];
    }

    if (!links) return [];

    return links
      .map((link: any) => {
        const student = link.students;
        if (!student) return null;
        return {
          id: student.id,
          name: student.name,
          grade: student.grade,
          class: student.class,
          relation: link.relation,
        };
      })
      .filter((s): s is LinkedStudent => s !== null);
  } catch (error) {
    console.error("[parent] 연결된 학생 조회 실패", error);
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
        .maybeSingle();

    let { data: link, error } = await selectLink();

    if (error && error.code === "42703") {
      ({ data: link, error } = await selectLink());
    }

    if (error && error.code !== "PGRST116") {
      console.error("[parent] 학생 접근 권한 확인 실패", error);
      return false;
    }

    return link !== null;
  } catch (error) {
    console.error("[parent] 학생 접근 권한 확인 실패", error);
    return false;
  }
}
