"use client";

import { FormSelect } from "@/components/molecules/FormField";
import type { Subject, SubjectGroup } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

type SubjectSelectionFieldsProps = {
  curriculumRevisions: CurriculumRevision[];
  selectedRevisionId: string;
  selectedGroupId: string;
  selectedSubjectId: string;
  selectedSubjects: Subject[];
  subjectGroups: (SubjectGroup & { subjects: Subject[] })[];
  loadingGroups: boolean;
  onCurriculumRevisionChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectGroupChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  revisionName?: string;
  showHints?: boolean;
};

export function SubjectSelectionFields({
  curriculumRevisions,
  selectedRevisionId,
  selectedGroupId,
  selectedSubjectId,
  selectedSubjects,
  subjectGroups,
  loadingGroups,
  onCurriculumRevisionChange,
  onSubjectGroupChange,
  onSubjectChange,
  revisionName,
  showHints = true,
}: SubjectSelectionFieldsProps) {
  const currentRevisionName = revisionName || 
    curriculumRevisions.find(r => r.id === selectedRevisionId)?.name || "";

  return (
    <>
      {/* 개정교육과정 */}
      <FormSelect
        label="개정교육과정"
        name="revision"
        value={currentRevisionName}
        onChange={onCurriculumRevisionChange}
        options={curriculumRevisions.map((revision) => ({
          value: revision.name,
          label: revision.name,
        }))}
        placeholder="선택하세요"
      />
      {/* curriculum_revision_id를 hidden input으로 전송 */}
      <input type="hidden" name="curriculum_revision_id" value={selectedRevisionId} />

      {/* 교과 그룹 선택 */}
      <FormSelect
        label="교과 그룹"
        name="subject_group"
        value={selectedGroupId}
        onChange={onSubjectGroupChange}
        disabled={!selectedRevisionId || loadingGroups}
        options={[
          {
            value: "",
            label: loadingGroups
              ? "로딩 중..."
              : !selectedRevisionId
              ? "개정교육과정을 먼저 선택하세요"
              : "선택하세요",
            disabled: true,
          },
          ...subjectGroups.map((group) => ({
            value: group.id,
            label: group.name,
          })),
        ]}
        hint={showHints && !selectedRevisionId ? "개정교육과정을 먼저 선택하세요" : undefined}
      />

      {/* 과목 선택 */}
      <FormSelect
        label="과목"
        name="subject"
        value={selectedSubjects.find(s => s.id === selectedSubjectId)?.name || ""}
        onChange={onSubjectChange}
        disabled={!selectedGroupId}
        options={[
          {
            value: "",
            label: "선택하세요",
            disabled: true,
          },
          ...selectedSubjects.map((subject) => ({
            value: subject.name,
            label: subject.name,
          })),
        ]}
        hint={
          showHints
            ? !selectedRevisionId
              ? "개정교육과정과 교과 그룹을 먼저 선택하세요"
              : !selectedGroupId
              ? "교과 그룹을 먼저 선택하세요"
              : undefined
            : undefined
        }
      />
      {/* subject_id를 hidden input으로 전송 */}
      <input type="hidden" name="subject_id" value={selectedSubjectId} />
    </>
  );
}

