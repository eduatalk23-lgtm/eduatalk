import { useState, useEffect, useCallback } from "react";
import {
  getCurriculumRevisionsAction,
  getSubjectGroupsAction,
  getSubjectsByGroupAction,
} from "@/app/(student)/actions/contentMetadataActions";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";
import type { SubjectGroup } from "@/lib/data/subjects";

interface RequiredSubjectConstraint {
  subject_group_id: string;
  subject_category: string;
  min_count: number;
  subjects_by_curriculum?: Array<{
    curriculum_revision_id: string;
    subject_id?: string;
    subject_name?: string;
  }>;
}

interface SubjectConstraints {
  enable_required_subjects_validation?: boolean;
  required_subjects?: RequiredSubjectConstraint[];
  excluded_subjects?: string[];
  constraint_handling?: "strict" | "warning" | "auto_fix";
}

interface UseRequiredSubjectsProps {
  isTemplateMode: boolean;
  editable: boolean;
  subjectConstraints?: SubjectConstraints;
  onUpdate: (updates: { subject_constraints: SubjectConstraints }) => void;
}

/**
 * 필수 교과 설정 관련 상태 및 핸들러 관리
 *
 * 템플릿 모드에서만 활성화되는 필수 교과 설정 기능을 담당
 */
export function useRequiredSubjects({
  isTemplateMode,
  editable,
  subjectConstraints,
  onUpdate,
}: UseRequiredSubjectsProps) {
  // 메타데이터 상태
  const [availableSubjectGroups, setAvailableSubjectGroups] = useState<
    SubjectGroup[]
  >([]);
  const [curriculumRevisions, setCurriculumRevisions] = useState<
    CurriculumRevision[]
  >([]);
  const [loadingSubjectGroups, setLoadingSubjectGroups] = useState(false);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // 교과 그룹 목록 조회
  useEffect(() => {
    if (isTemplateMode) {
      setLoadingSubjectGroups(true);
      getSubjectGroupsAction()
        .then((groups) => {
          setAvailableSubjectGroups(groups || []);
        })
        .catch((error) => {
          console.error("교과 그룹 조회 실패:", error);
        })
        .finally(() => {
          setLoadingSubjectGroups(false);
        });
    }
  }, [isTemplateMode]);

  // 개정교육과정 목록 조회
  useEffect(() => {
    if (isTemplateMode) {
      setLoadingRevisions(true);
      getCurriculumRevisionsAction()
        .then((revisions) => {
          setCurriculumRevisions(revisions || []);
        })
        .catch((error) => {
          console.error("개정교육과정 조회 실패:", error);
        })
        .finally(() => {
          setLoadingRevisions(false);
        });
    }
  }, [isTemplateMode]);

  // 개정교육과정별 세부 과목 불러오기
  const handleLoadSubjects = useCallback(
    async (
      subjectGroupId: string,
      curriculumRevisionId: string
    ): Promise<Array<{ id: string; name: string }>> => {
      try {
        // 해당 개정교육과정의 교과 그룹 찾기
        const selectedGroup = availableSubjectGroups.find(
          (g) => g.id === subjectGroupId
        );
        if (!selectedGroup) {
          return [];
        }

        // 같은 이름의 교과 그룹 중 해당 개정교육과정의 것 찾기
        const curriculumGroup = availableSubjectGroups.find(
          (g) =>
            g.name === selectedGroup.name &&
            g.curriculum_revision_id === curriculumRevisionId
        );

        if (!curriculumGroup) {
          return [];
        }

        // 해당 교과 그룹의 과목 조회
        const subjects = await getSubjectsByGroupAction(curriculumGroup.id);
        return subjects.map((s) => ({ id: s.id, name: s.name }));
      } catch (error) {
        console.error("세부 과목 조회 실패:", error);
        return [];
      }
    },
    [availableSubjectGroups]
  );

  // 필수 교과 추가
  const handleAddRequiredSubject = useCallback(() => {
    if (!editable) return;

    const currentConstraints: SubjectConstraints = subjectConstraints || {
      enable_required_subjects_validation: true,
      required_subjects: [],
      excluded_subjects: [],
      constraint_handling: "warning",
    };

    const newRequirement: RequiredSubjectConstraint = {
      subject_group_id: "",
      subject_category: "",
      min_count: 1,
    };

    onUpdate({
      subject_constraints: {
        ...currentConstraints,
        enable_required_subjects_validation: true,
        required_subjects: [
          ...(currentConstraints.required_subjects || []),
          newRequirement,
        ],
      },
    });
  }, [editable, subjectConstraints, onUpdate]);

  // 필수 교과 업데이트
  const handleRequiredSubjectUpdate = useCallback(
    (index: number, updated: Partial<RequiredSubjectConstraint>) => {
      if (!subjectConstraints) return;

      const newRequirements = [...(subjectConstraints.required_subjects || [])];
      newRequirements[index] = { ...newRequirements[index], ...updated };

      onUpdate({
        subject_constraints: {
          ...subjectConstraints,
          required_subjects: newRequirements,
        },
      });
    },
    [subjectConstraints, onUpdate]
  );

  // 필수 교과 삭제
  const handleRequiredSubjectRemove = useCallback(
    (index: number) => {
      if (!subjectConstraints) return;

      const newRequirements = (subjectConstraints.required_subjects || []).filter(
        (_, i) => i !== index
      );

      onUpdate({
        subject_constraints: {
          ...subjectConstraints,
          required_subjects: newRequirements,
          enable_required_subjects_validation: newRequirements.length > 0,
        },
      });
    },
    [subjectConstraints, onUpdate]
  );

  // 제약 조건 처리 방식 변경
  const handleConstraintHandlingChange = useCallback(
    (handling: "strict" | "warning" | "auto_fix") => {
      if (!editable) return;
      if (!subjectConstraints) return;

      onUpdate({
        subject_constraints: {
          ...subjectConstraints,
          constraint_handling: handling,
        },
      });
    },
    [editable, subjectConstraints, onUpdate]
  );

  return {
    // 메타데이터
    availableSubjectGroups,
    curriculumRevisions,
    loadingSubjectGroups,
    loadingRevisions,
    // 핸들러
    handleLoadSubjects,
    handleAddRequiredSubject,
    handleRequiredSubjectUpdate,
    handleRequiredSubjectRemove,
    handleConstraintHandlingChange,
  };
}
