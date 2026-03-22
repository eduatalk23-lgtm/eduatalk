"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "duplication" } as const;

export interface SameSchoolSetekEntry {
  studentName: string;
  content: string;
  grade: number;
  semester: number;
}

/**
 * 같은 학교 + 같은 과목의 다른 학생 세특 조회
 * 컨설턴트가 주제 중복을 직접 판단할 수 있도록 참고 정보 제공
 */
export async function findSameSchoolSeteksAction(input: {
  studentId: string;
  subjectId: string;
  schoolYear: number;
}): Promise<ActionResponse<SameSchoolSetekEntry[]>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return createErrorResponse("기관 정보를 찾을 수 없습니다.");
    }
    const supabase = await createSupabaseServerClient();

    // 1. 현재 학생의 school_name 조회
    const { data: student } = await supabase
      .from("students")
      .select("school_name")
      .eq("id", input.studentId)
      .single();

    if (!student?.school_name) {
      return createSuccessResponse([]);
    }

    // 2. 같은 tenant + school_name의 다른 학생 id 조회
    const { data: siblings } = await supabase
      .from("students")
      .select("id, name:user_profiles(display_name)")
      .eq("tenant_id", tenantId)
      .eq("school_name", student.school_name)
      .neq("id", input.studentId);

    if (!siblings || siblings.length === 0) {
      return createSuccessResponse([]);
    }

    const siblingIds = siblings.map((s) => s.id);
    const nameMap = new Map<string, string>();
    for (const s of siblings) {
      const profile = s.name as unknown as { display_name: string } | null;
      nameMap.set(s.id, profile?.display_name ?? "학생");
    }

    // 3. 같은 과목 + school_year의 세특 조회
    const { data: seteks } = await supabase
      .from("student_record_seteks")
      .select("student_id, content, grade, semester")
      .in("student_id", siblingIds)
      .eq("subject_id", input.subjectId)
      .eq("school_year", input.schoolYear)
      .is("deleted_at", null)
      .not("content", "is", null);

    if (!seteks || seteks.length === 0) {
      return createSuccessResponse([]);
    }

    const result: SameSchoolSetekEntry[] = seteks
      .filter((s) => s.content && s.content.trim().length > 0)
      .map((s) => ({
        studentName: nameMap.get(s.student_id) ?? "학생",
        content: s.content!.length > 100 ? s.content!.slice(0, 100) + "..." : s.content!,
        grade: s.grade,
        semester: s.semester,
      }));

    return createSuccessResponse(result);
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId: input.studentId });
    return createErrorResponse("같은 학교 세특 조회에 실패했습니다.");
  }
}
