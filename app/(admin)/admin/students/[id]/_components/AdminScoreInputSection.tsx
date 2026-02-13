import { getAllActiveCurriculumRevisions, getSubjectHierarchyOptimized } from "@/lib/data/subjects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminScoreInputClient from "./AdminScoreInputClient";

export async function AdminScoreInputSection({ studentId }: { studentId: string }) {
  // 학생의 tenant_id 조회
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student?.tenant_id) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-sm text-yellow-800">
          학생의 기관 정보가 설정되지 않았습니다. 학생 설정을 먼저 완료해주세요.
        </p>
      </div>
    );
  }

  // 모든 활성 교육과정 조회
  const activeCurricula = await getAllActiveCurriculumRevisions();
  if (activeCurricula.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <p className="text-sm text-yellow-800">
          개정교육과정 정보가 없습니다. 관리자에게 문의하세요.
        </p>
      </div>
    );
  }

  // 각 교육과정의 과목 계층 구조를 병렬 조회
  const hierarchies = await Promise.all(
    activeCurricula.map(async (c) => {
      const hierarchy = await getSubjectHierarchyOptimized(c.id);
      return {
        curriculum: { id: c.id, name: c.name, year: c.year },
        subjectGroups: hierarchy.subjectGroups,
        subjectTypes: hierarchy.subjectTypes,
      };
    })
  );

  return (
    <AdminScoreInputClient
      studentId={studentId}
      tenantId={student.tenant_id}
      curriculumOptions={hierarchies}
    />
  );
}
