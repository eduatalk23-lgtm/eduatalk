"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 학생의 교육과정 정보를 해결합니다.
 *
 * students.curriculum_revision(문자열 "2022 개정") →
 * curriculum_revisions 테이블에서 UUID + year를 조회합니다.
 *
 * 학생이 교육과정을 설정하지 않은 경우 is_active=true인
 * 최신 교육과정으로 fallback합니다.
 */
export type StudentCurriculumInfo = {
  curriculumRevisionId: string;
  curriculumYear: number;
  curriculumName: string;
};

export async function resolveStudentCurriculumId(
  studentId: string,
): Promise<StudentCurriculumInfo | null> {
  const supabase = await createSupabaseServerClient();

  // 1) 학생의 curriculum_revision 문자열 조회
  const { data: student } = await supabase
    .from("students")
    .select("curriculum_revision")
    .eq("id", studentId)
    .single();

  const curriculumName = student?.curriculum_revision as string | null;

  // 2) 문자열이 있으면 curriculum_revisions에서 name 매칭
  if (curriculumName) {
    const { data: matched } = await supabase
      .from("curriculum_revisions")
      .select("id, name, year")
      .eq("name", curriculumName)
      .single();

    if (matched?.id && matched.year != null) {
      return {
        curriculumRevisionId: matched.id,
        curriculumYear: matched.year,
        curriculumName: matched.name,
      };
    }
  }

  // 3) fallback: 활성 교육과정 중 최신 year
  const { data: fallback } = await supabase
    .from("curriculum_revisions")
    .select("id, name, year")
    .eq("is_active", true)
    .order("year", { ascending: false })
    .limit(1)
    .single();

  if (fallback?.id && fallback.year != null) {
    return {
      curriculumRevisionId: fallback.id,
      curriculumYear: fallback.year,
      curriculumName: fallback.name,
    };
  }

  return null;
}
