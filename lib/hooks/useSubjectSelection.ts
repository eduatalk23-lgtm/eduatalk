"use client";

import { useState, useEffect, useCallback } from "react";
import { getSubjectGroupsWithSubjectsAction } from "@/lib/domains/subject";
import type { Subject, SubjectGroup } from "@/lib/data/subjects";
import type { CurriculumRevision } from "@/lib/data/contentMetadata";

type UseSubjectSelectionOptions = {
  curriculumRevisions: CurriculumRevision[];
  initialRevisionId?: string;
  initialGroupId?: string;
  initialSubjectId?: string;
  onInitialLoad?: (revisionId: string) => Promise<void>;
};

export function useSubjectSelection({
  curriculumRevisions,
  initialRevisionId = "",
  initialGroupId = "",
  initialSubjectId = "",
  onInitialLoad,
}: UseSubjectSelectionOptions) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>(initialRevisionId);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<(SubjectGroup & { subjects: Subject[] })[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (initialRevisionId && onInitialLoad) {
      onInitialLoad(initialRevisionId);
    } else if (initialRevisionId) {
      loadSubjectGroups(initialRevisionId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 교과 그룹 로드 함수
  const loadSubjectGroups = useCallback(async (revisionId: string) => {
    if (!revisionId) {
      setSubjectGroups([]);
      setSelectedSubjects([]);
      return;
    }

    setLoadingGroups(true);
    try {
      const groups = await getSubjectGroupsWithSubjectsAction(revisionId);
      setSubjectGroups(groups);

      // 초기 그룹/과목 설정
      if (initialGroupId) {
        const currentGroup = groups.find(g => g.id === initialGroupId);
        if (currentGroup) {
          setSelectedSubjects(currentGroup.subjects || []);
          
          // 초기 과목 설정
          if (initialSubjectId) {
            const foundSubject = currentGroup.subjects.find(s => s.id === initialSubjectId);
            if (foundSubject) {
              setSelectedSubjectId(initialSubjectId);
            }
          }
        }
      }
    } catch (error) {
      console.error("교과 그룹 조회 실패:", error);
      setSubjectGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, [initialGroupId, initialSubjectId]);

  // 개정교육과정 선택 핸들러
  const handleCurriculumRevisionChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const revisionName = e.target.value;
    const selectedRevision = curriculumRevisions.find(r => r.name === revisionName);
    
    // 교과 그룹과 과목 선택 초기화 (먼저 수행)
    setSelectedGroupId("");
    setSelectedSubjectId("");
    setSelectedSubjects([]);
    
    if (selectedRevision) {
      // 상태를 먼저 업데이트하여 필드 활성화
      setSelectedRevisionId(selectedRevision.id);
      setLoadingGroups(true);
      
      try {
        await loadSubjectGroups(selectedRevision.id);
      } catch (error) {
        console.error("교과 그룹 로드 실패:", error);
        setSubjectGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    } else {
      setSelectedRevisionId("");
      setSubjectGroups([]);
      setLoadingGroups(false);
    }
  }, [curriculumRevisions, loadSubjectGroups]);

  // 교과 그룹 선택 핸들러
  const handleSubjectGroupChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const groupId = e.target.value;
    setSelectedGroupId(groupId);
    setSelectedSubjectId(""); // 과목 선택 초기화
    
    if (groupId) {
      const group = subjectGroups.find(g => g.id === groupId);
      setSelectedSubjects(group?.subjects || []);
    } else {
      setSelectedSubjects([]);
    }
  }, [subjectGroups]);

  // 과목 선택 핸들러
  const handleSubjectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const subjectName = e.target.value;
    const selectedSubject = selectedSubjects.find(s => s.name === subjectName);
    setSelectedSubjectId(selectedSubject?.id || "");
  }, [selectedSubjects]);

  // FormData에 과목 정보 추가 헬퍼
  const addSubjectDataToFormData = useCallback((formData: FormData) => {
    if (selectedGroupId) {
      const selectedGroup = subjectGroups.find(g => g.id === selectedGroupId);
      if (selectedGroup) {
        formData.set("subject_group_id", selectedGroup.id);
        formData.set("subject_category", selectedGroup.name);
      }
    }
    if (selectedSubjectId) {
      const selectedSubject = selectedSubjects.find(s => s.id === selectedSubjectId);
      if (selectedSubject) {
        formData.set("subject", selectedSubject.name);
      }
    }
    if (selectedRevisionId) {
      formData.set("curriculum_revision_id", selectedRevisionId);
    }
    if (selectedSubjectId) {
      formData.set("subject_id", selectedSubjectId);
    }
  }, [selectedGroupId, selectedSubjectId, selectedRevisionId, subjectGroups, selectedSubjects]);

  return {
    selectedRevisionId,
    selectedGroupId,
    selectedSubjectId,
    selectedSubjects,
    subjectGroups,
    loadingGroups,
    handleCurriculumRevisionChange,
    handleSubjectGroupChange,
    handleSubjectChange,
    addSubjectDataToFormData,
    // 내부 상태 업데이트를 위한 setter (필요한 경우)
    setSelectedRevisionId,
    setSelectedGroupId,
    setSelectedSubjectId,
    setSelectedSubjects,
  };
}

