import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { getSubjectGroups, getSubjectsByGroup, getSubjectTypes } from "@/lib/data/subjects";
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
  let initialSubjectsMap: Record<string, Subject[]> = {};
  let initialSubjectTypes: SubjectType[] = [];

  if (initialRevisionId) {
    // 첫 번째 개정교육과정의 교과 그룹과 과목구분 조회
    const [groups, subjectTypes] = await Promise.all([
      getSubjectGroups(initialRevisionId),
      getSubjectTypes(initialRevisionId),
    ]);

    initialGroups = groups;
    initialSubjectTypes = subjectTypes;

    // 각 교과 그룹의 과목 조회
    const subjectsPromises = groups.map(async (group) => {
      const subjects = await getSubjectsByGroup(group.id);
      return { groupId: group.id, subjects };
    });

    const subjectsResults = await Promise.all(subjectsPromises);
    subjectsResults.forEach(({ groupId, subjects }) => {
      initialSubjectsMap[groupId] = subjects;
    });
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
