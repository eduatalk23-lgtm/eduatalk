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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // 개정교육과정 변경 시 교과 목록 로드
  useEffect(() => {
    if (selectedCurriculumRevisionId) {
      setLoadingGroups(true);
      fetch(`/api/subject-groups?curriculum_revision_id=${selectedCurriculumRevisionId}`)
        .then((res) => res.json())
        .then((data) => {
          setSubjectGroups(data.data || []);
          setLoadingGroups(false);
          // 교과가 변경되면 과목 초기화
          setSelectedSubjectGroupId("");
          setSelectedSubjectId("");
          setSubjects([]);
        })
        .catch((err) => {
          console.error("교과 목록 로드 실패:", err);
          setLoadingGroups(false);
        });
    } else {
      setSubjectGroups([]);
      setSelectedSubjectGroupId("");
      setSelectedSubjectId("");
      setSubjects([]);
    }
  }, [selectedCurriculumRevisionId]);

  // 교과 변경 시 과목 목록 로드
  useEffect(() => {
    if (selectedSubjectGroupId) {
      setLoadingSubjects(true);
      fetch(`/api/subjects?subject_group_id=${selectedSubjectGroupId}`)
        .then((res) => res.json())
        .then((data) => {
          setSubjects(data.data || []);
          setLoadingSubjects(false);
          // 교과가 변경되면 과목 초기화
          setSelectedSubjectId("");
        })
        .catch((err) => {
          console.error("과목 목록 로드 실패:", err);
          setLoadingSubjects(false);
        });
    } else {
      setSubjects([]);
      setSelectedSubjectId("");
    }
  }, [selectedSubjectGroupId]);

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
            subjects.map((subject) => (
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

