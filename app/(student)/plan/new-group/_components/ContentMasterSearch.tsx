"use client";

import { useState, useTransition, useEffect } from "react";
import { searchContentMastersAction, copyMasterToStudentContentAction } from "@/app/(student)/actions/contentMasterActions";
import { ContentMaster } from "@/lib/types/plan";

type ContentMasterSearchProps = {
  contentType: "book" | "lecture";
  onContentAdded: (contentId: string, contentType: "book" | "lecture") => void;
  onClose: () => void;
};

export function ContentMasterSearch({
  contentType,
  onContentAdded,
  onClose,
}: ContentMasterSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [curriculumRevisionId, setCurriculumRevisionId] = useState("");
  const [subjectGroupId, setSubjectGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [results, setResults] = useState<ContentMaster[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [curriculumRevisions, setCurriculumRevisions] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectGroups, setSubjectGroups] = useState<Array<{ id: string; name: string }>>([]);
  // 교과별 과목을 Map으로 관리 (교과 ID → 과목 목록)
  const [subjectsMap, setSubjectsMap] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // 현재 선택된 교과의 과목 목록
  const currentSubjects = subjectGroupId 
    ? subjectsMap.get(subjectGroupId) || []
    : [];

  // 개정교육과정 목록 로드
  useEffect(() => {
    fetch("/api/curriculum-revisions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurriculumRevisions(data.data || []);
        }
      })
      .catch((err) => {
        console.error("개정교육과정 목록 로드 실패:", err);
      });
  }, []);

  // 개정교육과정 변경 시 교과와 과목 목록 병렬 로드
  useEffect(() => {
    if (curriculumRevisionId) {
      loadHierarchyData(curriculumRevisionId);
    } else {
      setSubjectGroups([]);
      setSubjectsMap(new Map());
      setSubjectGroupId("");
      setSubjectId("");
    }
  }, [curriculumRevisionId]);

  // 계층 구조 데이터 로드 (병렬 처리)
  const loadHierarchyData = async (curriculumRevisionId: string) => {
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
      const groups: Array<{ id: string; name: string }> = groupsWithSubjects.map(
        (group: { id: string; name: string; subjects?: Array<{ id: string; name: string }> }) => ({
          id: group.id,
          name: group.name,
        })
      );

      // 교과별 과목을 Map으로 변환
      const newSubjectsMap = new Map<string, Array<{ id: string; name: string }>>();
      groupsWithSubjects.forEach((group: { id: string; name: string; subjects?: Array<{ id: string; name: string }> }) => {
        if (group.subjects && group.subjects.length > 0) {
          newSubjectsMap.set(group.id, group.subjects);
        }
      });

      setSubjectGroups(groups);
      setSubjectsMap(newSubjectsMap);
      setSubjectGroupId("");
      setSubjectId("");
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

  const handleSearch = () => {
    if (!searchQuery.trim() && !curriculumRevisionId && !subjectGroupId && !subjectId) {
      return;
    }

    startSearch(async () => {
      try {
        const result = await searchContentMastersAction({
          content_type: contentType,
          curriculum_revision_id: curriculumRevisionId || undefined,
          subject_group_id: subjectGroupId || undefined,
          subject_id: subjectId || undefined,
          search: searchQuery.trim() || undefined,
          limit: 20,
        });
        setResults(result.data);
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "검색에 실패했습니다."
        );
      }
    });
  };

  const handleCopy = async (masterId: string) => {
    setCopyingId(masterId);
    try {
      const result = await copyMasterToStudentContentAction(masterId);
      const contentId = result.bookId || result.lectureId;
      if (contentId) {
        onContentAdded(contentId, contentType);
        onClose();
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "콘텐츠 복사에 실패했습니다."
      );
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {contentType === "book" ? "📚 교재 검색" : "🎧 강의 검색"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* 검색 폼 */}
        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              제목 검색
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:border-gray-900 focus:outline-none"
              placeholder="교재/강의 이름을 입력하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                개정교육과정
              </label>
              <select
                value={curriculumRevisionId}
                onChange={(e) => {
                  setCurriculumRevisionId(e.target.value);
                  setSubjectGroupId("");
                  setSubjectId("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              >
                <option value="">전체</option>
                {curriculumRevisions.map((rev) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                교과
              </label>
              <select
                value={subjectGroupId}
                onChange={(e) => {
                  setSubjectGroupId(e.target.value);
                  setSubjectId("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={!curriculumRevisionId || loadingGroups}
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                과목
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={!subjectGroupId || loadingSubjects}
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
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSearching ? "검색 중..." : "검색"}
          </button>
        </div>

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {results.map((master) => (
              <div
                key={master.id}
                className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{master.title}</h4>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
                    {master.publisher_or_academy && (
                      <span>{master.publisher_or_academy}</span>
                    )}
                    {master.subject && <span>· {master.subject}</span>}
                    {master.semester && <span>· {master.semester}</span>}
                    {master.revision && <span>· {master.revision}</span>}
                    {master.total_pages && (
                      <span>· {master.total_pages}페이지</span>
                    )}
                    {master.total_episodes && (
                      <span>· {master.total_episodes}회차</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(master.id)}
                  disabled={copyingId === master.id}
                  className="ml-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
                >
                  {copyingId === master.id ? "복사 중..." : "가져오기"}
                </button>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !isSearching && searchQuery && (
          <div className="py-8 text-center text-sm text-gray-500">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

