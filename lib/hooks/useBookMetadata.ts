"use client";

import { useState, useEffect } from "react";
import {
  getCurriculumRevisionsAction,
  getPublishersAction,
  getSubjectGroupsAction,
  getSubjectsByGroupAction,
} from "@/app/(student)/actions/contentMetadataActions";
import type { SubjectGroup, Subject } from "@/lib/data/subjects";

type UseBookMetadataReturn = {
  // 메타데이터 목록
  revisions: Array<{ id: string; name: string }>;
  subjectGroups: SubjectGroup[];
  subjects: Subject[];
  publishers: Array<{ id: string; name: string }>;

  // 선택된 ID
  selectedRevisionId: string;
  selectedSubjectGroupId: string;
  selectedSubjectId: string;
  selectedPublisherId: string;

  // 선택 핸들러
  setSelectedRevisionId: (id: string) => void;
  setSelectedSubjectGroupId: (id: string) => void;
  setSelectedSubjectId: (id: string) => void;
  setSelectedPublisherId: (id: string) => void;

  // 로딩 상태
  isLoading: boolean;

  // FormData 변환 헬퍼
  populateFormDataWithMetadata: (formData: FormData) => void;
};

/**
 * 교재 등록 시 필요한 메타데이터를 로드하고 관리하는 커스텀 훅
 */
export function useBookMetadata(): UseBookMetadataReturn {
  const [revisions, setRevisions] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [publishers, setPublishers] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [selectedSubjectGroupId, setSelectedSubjectGroupId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedPublisherId, setSelectedPublisherId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);

  // 초기 메타데이터 로드 (개정교육과정, 출판사)
  useEffect(() => {
    async function loadMetadata() {
      try {
        setIsLoading(true);
        const [revs, pubs] = await Promise.all([
          getCurriculumRevisionsAction(),
          getPublishersAction(),
        ]);
        setRevisions(revs.filter((r) => r.is_active));
        setPublishers(pubs.filter((p) => p.is_active));
      } catch (error) {
        console.error("메타데이터 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMetadata();
  }, []);

  // 개정교육과정 선택 시 교과 그룹 로드
  useEffect(() => {
    async function loadSubjectGroups() {
      if (selectedRevisionId) {
        try {
          const groups = await getSubjectGroupsAction(selectedRevisionId);
          setSubjectGroups(groups);
          setSelectedSubjectGroupId("");
          setSubjects([]);
        } catch (error) {
          console.error("교과 그룹 로드 실패:", error);
        }
      } else {
        setSubjectGroups([]);
        setSubjects([]);
      }
    }

    loadSubjectGroups();
  }, [selectedRevisionId]);

  // 교과 그룹 선택 시 과목 로드
  useEffect(() => {
    async function loadSubjects() {
      if (selectedSubjectGroupId) {
        try {
          const subs = await getSubjectsByGroupAction(selectedSubjectGroupId);
          setSubjects(subs);
          setSelectedSubjectId("");
        } catch (error) {
          console.error("과목 로드 실패:", error);
        }
      } else {
        setSubjects([]);
      }
    }

    loadSubjects();
  }, [selectedSubjectGroupId]);

  // FormData에 선택된 메타데이터 이름 추가
  function populateFormDataWithMetadata(formData: FormData) {
    // 개정교육과정 이름 추가
    if (selectedRevisionId) {
      const revision = revisions.find((r) => r.id === selectedRevisionId);
      if (revision) {
        formData.set("revision", revision.name);
      }
    }

    // 교과 이름 추가
    if (selectedSubjectGroupId) {
      const group = subjectGroups.find((g) => g.id === selectedSubjectGroupId);
      if (group) {
        formData.set("subject_category", group.name);
      }
    }

    // 과목 이름 추가
    if (selectedSubjectId) {
      const subject = subjects.find((s) => s.id === selectedSubjectId);
      if (subject) {
        formData.set("subject", subject.name);
      }
    }

    // 출판사 이름 추가
    if (selectedPublisherId) {
      const publisher = publishers.find((p) => p.id === selectedPublisherId);
      if (publisher) {
        formData.set("publisher_name", publisher.name);
      }
    }
  }

  return {
    revisions,
    subjectGroups,
    subjects,
    publishers,
    selectedRevisionId,
    selectedSubjectGroupId,
    selectedSubjectId,
    selectedPublisherId,
    setSelectedRevisionId,
    setSelectedSubjectGroupId,
    setSelectedSubjectId,
    setSelectedPublisherId,
    isLoading,
    populateFormDataWithMetadata,
  };
}

