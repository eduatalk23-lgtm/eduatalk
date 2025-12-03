"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CurriculumRevision = {
  id: string;
  name: string;
};

type SubjectGroup = {
  id: string;
  name: string;
};

type Subject = {
  id: string;
  name: string;
};

type HierarchicalFilterProps = {
  curriculumRevisions: CurriculumRevision[];
  initialCurriculumRevisionId?: string;
  initialSubjectGroupId?: string;
  initialSubjectId?: string;
  semesters: string[];
  initialSemester?: string;
  searchQuery?: string;
  basePath?: string;
};

export function HierarchicalFilter({
  curriculumRevisions,
  initialCurriculumRevisionId,
  initialSubjectGroupId,
  initialSubjectId,
  semesters,
  initialSemester,
  searchQuery = "",
  basePath = "/contents/master-books",
}: HierarchicalFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedCurriculumRevisionId, setSelectedCurriculumRevisionId] = useState(
    initialCurriculumRevisionId || ""
  );
  const [selectedSubjectGroupId, setSelectedSubjectGroupId] = useState(
    initialSubjectGroupId || ""
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId || "");
  const [selectedSemester, setSelectedSemester] = useState(initialSemester || "");
  const [search, setSearch] = useState(searchQuery);

  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  // 교과별 과목을 Map으로 관리 (교과 ID → 과목 목록)
  const [subjectsMap, setSubjectsMap] = useState<Map<string, Subject[]>>(new Map());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // 현재 선택된 교과의 과목 목록
  const currentSubjects = selectedSubjectGroupId 
    ? subjectsMap.get(selectedSubjectGroupId) || []
    : [];

  // 초기 마운트 시 초기값이 있을 경우 병렬로 데이터 로드
  useEffect(() => {
    if (initialCurriculumRevisionId) {
      // 초기값이 있으면 즉시 로드
      loadHierarchyData(initialCurriculumRevisionId, initialSubjectGroupId, initialSubjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 개정교육과정 변경 시 교과와 과목 목록 병렬 로드 (초기 로드 제외)
  useEffect(() => {
    // 초기값과 다른 경우에만 로드 (중복 로딩 방지)
    if (
      selectedCurriculumRevisionId &&
      selectedCurriculumRevisionId !== initialCurriculumRevisionId
    ) {
      loadHierarchyData(selectedCurriculumRevisionId);
    } else if (!selectedCurriculumRevisionId) {
      setSubjectGroups([]);
      setSubjectsMap(new Map());
      setSelectedSubjectGroupId("");
      setSelectedSubjectId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCurriculumRevisionId]);

  // 교과 변경 시 과목 초기화 (이미 로드된 데이터 사용)
  useEffect(() => {
    // 교과가 변경되고 초기값과 다르면 과목 초기화
    if (
      selectedSubjectGroupId &&
      selectedSubjectGroupId !== initialSubjectGroupId &&
      !subjectsMap.has(selectedSubjectGroupId)
    ) {
      // 모든 과목이 이미 로드되어야 하는데 없는 경우에만 개별 로드
      setLoadingSubjects(true);
      fetch(`/api/subjects?subject_group_id=${selectedSubjectGroupId}`)
        .then((res) => res.json())
        .then((data) => {
          const newSubjects = data.data || [];
          setSubjectsMap((prev) => {
            const next = new Map(prev);
            next.set(selectedSubjectGroupId, newSubjects);
            return next;
          });
          setLoadingSubjects(false);
        })
        .catch((err) => {
          console.error("과목 목록 로드 실패:", err);
          setLoadingSubjects(false);
        });
    }

    // 교과 변경 시 과목 초기화 (초기값이 아닌 경우)
    if (selectedSubjectGroupId !== initialSubjectGroupId) {
      setSelectedSubjectId("");
    }
  }, [selectedSubjectGroupId, initialSubjectGroupId, subjectsMap]);

  // 계층 구조 데이터 로드 (병렬 처리)
  const loadHierarchyData = async (
    curriculumRevisionId: string,
    preserveSubjectGroupId?: string,
    preserveSubjectId?: string
  ) => {
    setLoadingGroups(true);
    setLoadingSubjects(true);

    try {
      // 교과와 과목을 함께 조회 (병렬 처리)
      const response = await fetch(
        `/api/subject-groups?curriculum_revision_id=${curriculumRevisionId}&include_subjects=true`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "데이터 로드 실패");
      }

      const groupsWithSubjects = result.data || [];
      const groups: SubjectGroup[] = groupsWithSubjects.map(
        (group: SubjectGroup & { subjects?: Subject[] }) => ({
          id: group.id,
          name: group.name,
        })
      );

      // 교과별 과목을 Map으로 변환
      const newSubjectsMap = new Map<string, Subject[]>();
      groupsWithSubjects.forEach((group: SubjectGroup & { subjects?: Subject[] }) => {
        if (group.subjects && group.subjects.length > 0) {
          newSubjectsMap.set(group.id, group.subjects);
        }
      });

      setSubjectGroups(groups);
      setSubjectsMap(newSubjectsMap);

      // 초기값 보존
      if (preserveSubjectGroupId && newSubjectsMap.has(preserveSubjectGroupId)) {
        setSelectedSubjectGroupId(preserveSubjectGroupId);
        // 해당 교과의 과목 목록이 있고 preserveSubjectId가 있으면 설정
        const subjects = newSubjectsMap.get(preserveSubjectGroupId) || [];
        if (preserveSubjectId && subjects.some((s) => s.id === preserveSubjectId)) {
          setSelectedSubjectId(preserveSubjectId);
        }
      } else if (!preserveSubjectGroupId) {
        // 초기값이 없으면 초기화
        setSelectedSubjectGroupId("");
        setSelectedSubjectId("");
      }

      setLoadingGroups(false);
      setLoadingSubjects(false);
    } catch (err) {
      console.error("계층 구조 데이터 로드 실패:", err);
      setLoadingGroups(false);
      setLoadingSubjects(false);
      setSubjectGroups([]);
      setSubjectsMap(new Map());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    
    if (selectedCurriculumRevisionId) {
      params.set("curriculum_revision_id", selectedCurriculumRevisionId);
    }
    if (selectedSubjectGroupId) {
      params.set("subject_group_id", selectedSubjectGroupId);
    }
    if (selectedSubjectId) {
      params.set("subject_id", selectedSubjectId);
    }
    if (selectedSemester) {
      params.set("semester", selectedSemester);
    }
    if (search.trim()) {
      params.set("search", search.trim());
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  const handleReset = () => {
    router.push(basePath);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4"
    >
      {/* 개정교육과정 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">
          개정교육과정
        </label>
        <select
          value={selectedCurriculumRevisionId}
          onChange={(e) => setSelectedCurriculumRevisionId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">전체</option>
          {curriculumRevisions.map((rev) => (
            <option key={rev.id} value={rev.id}>
              {rev.name}
            </option>
          ))}
        </select>
      </div>

      {/* 교과 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">교과</label>
        <select
          value={selectedSubjectGroupId}
          onChange={(e) => setSelectedSubjectGroupId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!selectedCurriculumRevisionId || loadingGroups}
        >
          <option value="">전체</option>
          {loadingGroups ? (
            <option value="">로딩 중...</option>
          ) : (
            subjectGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* 과목 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">과목</label>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!selectedSubjectGroupId || loadingSubjects}
        >
          <option value="">전체</option>
          {loadingSubjects ? (
            <option value="">로딩 중...</option>
          ) : (
            currentSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* 학년/학기 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">
          학년/학기
        </label>
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">전체</option>
          {semesters.map((sem) => (
            <option key={sem} value={sem}>
              {sem}
            </option>
          ))}
        </select>
      </div>

      {/* 제목 검색 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">
          제목 검색
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="교재명 입력"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* 검색 버튼 */}
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        검색
      </button>

      {/* 초기화 버튼 */}
      <button
        type="button"
        onClick={handleReset}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
      >
        초기화
      </button>
    </form>
  );
}

