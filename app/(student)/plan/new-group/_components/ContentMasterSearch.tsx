"use client";

import { useState, useTransition, useEffect } from "react";
import { searchContentMastersAction, copyMasterToStudentContentAction } from "@/app/(student)/actions/contentMasterActions";
import { ContentMaster } from "@/lib/types/plan";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

type ContentMasterSearchProps = {
  contentType: "book" | "lecture";
  onContentAdded: (contentId: string, contentType: "book" | "lecture") => void;
  onClose: () => void;
  studentId?: string; // 관리자 모드에서 사용 시
};

export function ContentMasterSearch({
  contentType,
  onContentAdded,
  onClose,
  studentId,
}: ContentMasterSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [curriculumRevisionId, setCurriculumRevisionId] = useState("");
  const [subjectGroupId, setSubjectGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("updated_at_desc");
  const [results, setResults] = useState<ContentMaster[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [curriculumRevisions, setCurriculumRevisions] = useState<Array<{ id: string; name: string }>>([]);
  const [subjectGroups, setSubjectGroups] = useState<Array<{ id: string; name: string }>>([]);
  // 교과별 과목을 Map으로 관리 (교과 ID → 과목 목록)
  const [subjectsMap, setSubjectsMap] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [publishers, setPublishers] = useState<Array<{ id: string; name: string }>>([]);
  const [platforms, setPlatforms] = useState<Array<{ id: string; name: string }>>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // 현재 선택된 교과의 과목 목록
  const currentSubjects = subjectGroupId 
    ? subjectsMap.get(subjectGroupId) || []
    : [];

  // 개정교육과정, 출판사, 플랫폼, 난이도 목록 로드
  useEffect(() => {
    Promise.all([
      fetch("/api/curriculum-revisions").then((res) => res.json()),
      contentType === "book" 
        ? fetch("/api/publishers").then((res) => res.json())
        : Promise.resolve({ success: true, data: [] }),
      contentType === "lecture"
        ? fetch("/api/platforms").then((res) => res.json())
        : Promise.resolve({ success: true, data: [] }),
      contentType === "book"
        ? fetch("/api/master-books/difficulties").then((res) => res.json()).catch(() => ({ success: true, data: [] }))
        : fetch("/api/master-lectures/difficulties").then((res) => res.json()).catch(() => ({ success: true, data: [] })),
    ])
      .then(([revisionsRes, publishersRes, platformsRes, difficultiesRes]) => {
        if (revisionsRes.success) {
          setCurriculumRevisions(revisionsRes.data || []);
        }
        if (publishersRes.success) {
          setPublishers(publishersRes.data || []);
        }
        if (platformsRes.success) {
          setPlatforms(platformsRes.data || []);
        }
        if (difficultiesRes.success) {
          setDifficulties(difficultiesRes.data || []);
        }
      })
      .catch((err) => {
        console.error("필터 옵션 로드 실패:", err);
      });
  }, [contentType]);

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
    if (!searchQuery.trim() && !curriculumRevisionId && !subjectGroupId && !subjectId && !publisherId && !platformId && !difficulty) {
      return;
    }

    startSearch(async () => {
      try {
        const result = await searchContentMastersAction({
          content_type: contentType,
          curriculum_revision_id: curriculumRevisionId || undefined,
          subject_group_id: subjectGroupId || undefined,
          subject_id: subjectId || undefined,
          publisher_id: contentType === "book" ? (publisherId || undefined) : undefined,
          platform_id: contentType === "lecture" ? (platformId || undefined) : undefined,
          search: searchQuery.trim() || undefined,
          difficulty: difficulty || undefined,
          sort: sort || undefined,
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
      const result = await copyMasterToStudentContentAction(masterId, studentId);
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
    <Dialog
      open={true}
      onOpenChange={onClose}
      title={contentType === "book" ? "📚 교재 검색" : "🎧 강의 검색"}
      maxWidth="2xl"
    >
      <DialogContent>
        {/* 검색 폼 */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-800">
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-800">
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
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-800">
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
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-800">
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
            {/* 출판사 (교재용) */}
            {contentType === "book" && publishers.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-800">
                  출판사
                </label>
                <select
                  value={publisherId}
                  onChange={(e) => setPublisherId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                >
                  <option value="">전체</option>
                  {publishers.map((publisher) => (
                    <option key={publisher.id} value={publisher.id}>
                      {publisher.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* 플랫폼 (강의용) */}
            {contentType === "lecture" && platforms.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-800">
                  플랫폼
                </label>
                <select
                  value={platformId}
                  onChange={(e) => setPlatformId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                >
                  <option value="">전체</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* 난이도 */}
            {difficulties.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-800">
                  난이도
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                >
                  <option value="">전체</option>
                  {difficulties.map((diff) => (
                    <option key={diff} value={diff}>
                      {diff}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* 정렬 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-800">
                정렬
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              >
                <option value="updated_at_desc">최신순</option>
                <option value="created_at_desc">최신순</option>
                <option value="created_at_asc">오래된순</option>
                <option value="title_asc">제목 가나다순</option>
                <option value="title_desc">제목 역순</option>
                <option value="difficulty_level_asc">난이도 낮은순</option>
                <option value="difficulty_level_desc">난이도 높은순</option>
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
                  className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{master.title}</h4>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {master.publisher_or_academy && (
                        <span>{master.publisher_or_academy}</span>
                      )}
                      {master.subject && <span>· {master.subject}</span>}
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
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
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
      </DialogContent>
    </Dialog>
  );
}

