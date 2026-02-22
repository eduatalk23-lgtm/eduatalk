"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllActiveCurriculumRevisions,
  getSubjectHierarchyOptimized,
} from "@/lib/data/subjects";
import {
  getInternalScoresByTerm,
  getMockScoresByPeriod,
} from "@/lib/data/scoreDetails";
import type { SubjectGroup, SubjectType } from "@/lib/data/subjects";
import type {
  InternalScoreWithRelations,
  MockScoreWithRelations,
} from "@/lib/types/scoreAnalysis";

export type CurriculumHierarchy = {
  curriculum: { id: string; name: string; year: number | null };
  subjectGroups: (SubjectGroup & {
    subjects: Array<{
      id: string;
      subject_group_id: string;
      name: string;
      subject_type_id?: string | null;
      subject_type?: string | null;
    }>;
  })[];
  subjectTypes: SubjectType[];
};

export type ScorePanelData = {
  tenantId: string;
  curriculumYear: number | null;
  subjectGroups: SubjectGroup[];
  internalScores: InternalScoreWithRelations[];
  mockScores: MockScoreWithRelations[];
  curriculumOptions: CurriculumHierarchy[];
};

export async function fetchScorePanelData(
  studentId: string
): Promise<ScorePanelData | null> {
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student?.tenant_id) return null;

  const activeCurricula = await getAllActiveCurriculumRevisions();
  if (activeCurricula.length === 0) return null;

  // list 탭용: 성적 + 매칭 교육과정의 과목 계층
  const [internalScores, mockScores] = await Promise.all([
    getInternalScoresByTerm(studentId, student.tenant_id),
    getMockScoresByPeriod(studentId, student.tenant_id),
  ]);

  const usedCurriculumId = internalScores[0]?.curriculum_revision_id;
  const matchedCurriculum = usedCurriculumId
    ? activeCurricula.find((c) => c.id === usedCurriculumId)
    : null;
  const activeCurriculum = matchedCurriculum ?? activeCurricula[0];

  // input 탭용: 모든 교육과정의 과목 계층 + list 탭용 매칭 교육과정 계층 (병렬)
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

  // list 탭의 subjectGroups는 매칭 교육과정에서 추출
  const matchedHierarchy = hierarchies.find(
    (h) => h.curriculum.id === activeCurriculum.id
  );

  return {
    tenantId: student.tenant_id,
    curriculumYear: activeCurriculum.year,
    subjectGroups: matchedHierarchy?.subjectGroups ?? [],
    internalScores,
    mockScores,
    curriculumOptions: hierarchies,
  };
}
