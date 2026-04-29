import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { resolveStudentCurriculumId } from "@/lib/domains/student/resolveStudentCurriculum";
import { StudentRecordClient } from "./StudentRecordClient";

type StudentRecordSectionProps = {
  studentId: string;
  studentName?: string | null;
};

export async function StudentRecordSection({ studentId, studentName }: StudentRecordSectionProps) {
  const supabase = await createSupabaseServerClient();

  // 학생의 tenant_id, grade, 학교명 조회
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("tenant_id, grade, school_name, class, student_number")
    .eq("id", studentId)
    .single();

  if (studentError || !student) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/20 dark:text-error-400"
      >
        학생 정보를 불러올 수 없습니다.
      </div>
    );
  }

  // 과목 목록 조회 (세특 과목 드롭다운 + 유형분류용)
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, subject_group:subject_group_id(name), subject_type:subject_type_id(name, is_achievement_only)")
    .order("name");

  const initialSchoolYear = calculateSchoolYear();

  // 교육과정 문자열 → UUID resolve
  const curriculumInfo = await resolveStudentCurriculumId(studentId);

  return (
    <StudentRecordClient
      studentId={studentId}
      tenantId={student.tenant_id}
      subjects={(subjects ?? []) as unknown as { id: string; name: string; subject_group?: { name: string } | null; subject_type?: { name: string; is_achievement_only: boolean } | null }[]}
      initialSchoolYear={initialSchoolYear}
      studentGrade={student.grade ?? 1}
      studentName={studentName ?? undefined}
      schoolName={student.school_name ?? undefined}
      studentClass={student.class ?? undefined}
      studentNumber={student.student_number ?? undefined}
      curriculumRevisionId={curriculumInfo?.curriculumRevisionId}
      curriculumYear={curriculumInfo?.curriculumYear}
    />
  );
}
