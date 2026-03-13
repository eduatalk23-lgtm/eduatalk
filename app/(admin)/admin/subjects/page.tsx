export const dynamic = 'force-dynamic';

import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { getSubjectGroups, getSubjectsByRevision, getSubjectTypes } from "@/lib/data/subjects";
import SubjectsPageClient from "./_components/SubjectsPageClient";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup, Subject, SubjectType } from "@/lib/data/subjects";

export default async function SubjectsPage() {
  // 서버 사이드에서 초기 데이터 페칭
  const revisions = await getCurriculumRevisions();

  const sortedRevisions = [...revisions].sort(
    (a, b) => {
      const orderA = a.display_order ?? 0;
      const orderB = b.display_order ?? 0;
      const orderDiff = orderA - orderB;
      return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
    }
  );

  // 첫 번째 개정교육과정의 초기 데이터 준비
  const initialRevisionId = sortedRevisions.length > 0 ? sortedRevisions[0].id : null;
  
  let initialGroups: SubjectGroup[] = [];
  const initialSubjectsMap: Record<string, Subject[]> = {};
  let initialSubjectTypes: SubjectType[] = [];

  if (initialRevisionId) {
    // 교과 그룹 + 과목구분 + 전체 과목을 병렬 배치 조회 (N+1 제거)
    const [groups, subjectTypes, allSubjects] = await Promise.all([
      getSubjectGroups(initialRevisionId),
      getSubjectTypes(initialRevisionId),
      getSubjectsByRevision(initialRevisionId),
    ]);

    initialGroups = groups;
    initialSubjectTypes = subjectTypes;

    // 과목을 그룹별로 분류 (메모리 내 처리, 추가 쿼리 없음)
    for (const subject of allSubjects) {
      if (!initialSubjectsMap[subject.subject_group_id]) {
        initialSubjectsMap[subject.subject_group_id] = [];
      }
      initialSubjectsMap[subject.subject_group_id].push(subject);
    }
  }

  return (
    <SubjectsPageClient
      initialRevisions={sortedRevisions}
      initialGroups={initialGroups}
      initialSubjectsMap={initialSubjectsMap}
      initialSubjectTypes={initialSubjectTypes}
      initialRevisionId={initialRevisionId}
    />
  );
}
