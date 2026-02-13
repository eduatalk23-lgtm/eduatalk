import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllActiveCurriculumRevisions, getSubjectHierarchyOptimized } from "@/lib/data/subjects";
import { getInternalScoresByTerm, getMockScoresByPeriod } from "@/lib/data/scoreDetails";
import AdminScoreListClient from "./AdminScoreListClient";

export async function AdminScoreListSection({ studentId }: { studentId: string }) {
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

  // 학생 성적에서 사용된 curriculum_revision_id를 기준으로 교육과정 판별
  const [internalScores, mockScores] = await Promise.all([
    getInternalScoresByTerm(studentId, student.tenant_id),
    getMockScoresByPeriod(studentId, student.tenant_id),
  ]);

  // 성적에 기록된 curriculum_revision_id에 매칭되는 교육과정 찾기
  // 없으면 최신 교육과정(첫 번째) 사용
  const usedCurriculumId = internalScores[0]?.curriculum_revision_id;
  const matchedCurriculum = usedCurriculumId
    ? activeCurricula.find((c) => c.id === usedCurriculumId)
    : null;
  const activeCurriculum = matchedCurriculum ?? activeCurricula[0];

  const hierarchy = await getSubjectHierarchyOptimized(activeCurriculum.id);

  return (
    <AdminScoreListClient
      studentId={studentId}
      tenantId={student.tenant_id}
      curriculumYear={activeCurriculum.year}
      subjectGroups={hierarchy.subjectGroups}
      internalScores={internalScores}
      mockScores={mockScores}
    />
  );
}
