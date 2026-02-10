"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { logActionError } from "@/lib/logging/actionLogger";

export type DerivedSibling = {
  studentId: string;
  studentName: string | null;
  sharedParentId: string;
  sharedParentName: string | null;
  relation: string;
};

/**
 * 부모 공유로 자동 파생된 형제 관계 조회
 * 같은 부모에 연결된 다른 학생들을 형제로 간주
 */
export async function getDerivedSiblings(
  studentId: string
): Promise<{ success: boolean; data?: DerivedSibling[]; error?: string }> {
  const supabase = await createSupabaseServerClient();

  try {
    // 1. 이 학생에 연결된 부모 목록
    const { data: parentLinks, error: parentError } = await supabase
      .from("parent_student_links")
      .select("parent_id, relation")
      .eq("student_id", studentId);

    if (parentError) {
      logActionError(
        { domain: "invite", action: "getDerivedSiblings" },
        parentError,
        { studentId }
      );
      return { success: false, error: parentError.message };
    }

    if (!parentLinks || parentLinks.length === 0) {
      return { success: true, data: [] };
    }

    const parentIds = parentLinks.map((l) => l.parent_id);

    // 2. 같은 부모에 연결된 다른 학생 조회
    const { data: siblingLinks, error: siblingError } = await supabase
      .from("parent_student_links")
      .select(
        `
        student_id,
        parent_id,
        relation,
        students:student_id(name),
        parent_users:parent_id(name)
      `
      )
      .in("parent_id", parentIds)
      .neq("student_id", studentId);

    if (siblingError) {
      logActionError(
        { domain: "invite", action: "getDerivedSiblings" },
        siblingError,
        { studentId }
      );
      return { success: false, error: siblingError.message };
    }

    if (!siblingLinks) {
      return { success: true, data: [] };
    }

    // 중복 제거 (같은 학생이 여러 부모를 통해 나올 수 있음)
    const seen = new Set<string>();
    const siblings: DerivedSibling[] = [];

    for (const link of siblingLinks) {
      const key = `${link.student_id}-${link.parent_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const student = extractJoinResult(link.students);
      const parent = extractJoinResult(link.parent_users);

      siblings.push({
        studentId: link.student_id,
        studentName: student?.name ?? null,
        sharedParentId: link.parent_id,
        sharedParentName: parent?.name ?? null,
        relation: link.relation || "other",
      });
    }

    return { success: true, data: siblings };
  } catch (error) {
    logActionError(
      { domain: "invite", action: "getDerivedSiblings" },
      error,
      { studentId }
    );
    return {
      success: false,
      error: "형제 정보를 조회하는 중 오류가 발생했습니다.",
    };
  }
}
