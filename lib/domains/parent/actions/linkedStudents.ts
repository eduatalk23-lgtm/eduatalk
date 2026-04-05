"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LinkedStudent } from "../types";

export type LinkedStudentWithLinkId = LinkedStudent & {
  linkId: string;
};

export type GetLinkedStudentsResult = {
  success: boolean;
  data?: LinkedStudentWithLinkId[];
  error?: string;
};

/**
 * 학부모의 연결 학생 목록 조회 (linkId 포함)
 */
export async function getLinkedStudentsByParentAction(
  parentId: string
): Promise<GetLinkedStudentsResult> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // linkId 포함 버전으로 직접 조회
    const { data: links, error } = await supabase
      .from("parent_student_links")
      .select("id, student_id, relation, students(id, grade, class, school_name, user_profiles(name))")
      .eq("parent_id", parentId);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!links) {
      return { success: true, data: [] };
    }

    const { extractJoinResult } = await import("@/lib/supabase/queryHelpers");

    const result: LinkedStudentWithLinkId[] = links
      .map((link: { id: string; student_id: string; relation: string | null; students: unknown }) => {
        const student = extractJoinResult(link.students) as { id: string; grade: string | null; class: string | null; school_name: string | null; user_profiles: { name: string | null } | { name: string | null }[] | null } | null;
        if (!student) return null;
        const up = student.user_profiles;
        const upObj = Array.isArray(up) ? up[0] : up;
        return {
          linkId: link.id,
          id: student.id,
          name: upObj?.name ?? null,
          grade: student.grade,
          class: student.class,
          relation: link.relation ?? "",
          school_name: student.school_name ?? null,
        };
      })
      .filter((s): s is LinkedStudentWithLinkId => s !== null);

    return { success: true, data: result };
  } catch (error) {
    logActionError({ domain: "parent", action: "getLinkedStudentsAction" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "연결 학생 조회 중 오류가 발생했습니다.",
    };
  }
}
