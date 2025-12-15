"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSubjectHierarchy } from "@/lib/contexts/SubjectHierarchyContext";
import { updateFilterParams, updateMultipleFilterParams, clearFilterParams } from "@/lib/utils/shallowRouting";
import type { SubjectGroup, Subject } from "@/lib/data/subjects";

type CurriculumRevision = {
  id: string;
  name: string;
};

type Publisher = {
  id: string;
  name: string;
};

type Platform = {
  id: string;
  name: string;
};

type HierarchicalFilterProps = {
  curriculumRevisions: CurriculumRevision[];
  initialCurriculumRevisionId?: string;
  initialSubjectGroupId?: string;
  initialSubjectId?: string;
  publishers?: Publisher[]; // 교재용
  platforms?: Platform[]; // 강의용
  initialPublisherId?: string; // 교재용
  initialPlatformId?: string; // 강의용
  contentType?: "book" | "lecture"; // 교재/강의 구분
  searchQuery?: string;
  basePath?: string;
};

export function HierarchicalFilter({
  curriculumRevisions,
  initialCurriculumRevisionId,
  initialSubjectGroupId,
  initialSubjectId,
  publishers = [],
  platforms = [],
  initialPublisherId,
  initialPlatformId,
  contentType = "book",
  searchQuery = "",
  basePath = "/contents/master-books",
}: HierarchicalFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hierarchy, loading: hierarchyLoading, getSubjectGroups, getSubjectsByGroup, loadHierarchy } = useSubjectHierarchy();

  // 필터 상태 (URL 파라미터와 동기화)
  const [selectedCurriculumRevisionId, setSelectedCurriculumRevisionId] = useState(
    initialCurriculumRevisionId || searchParams.get("curriculum_revision_id") || ""
  );
  const [selectedSubjectGroupId, setSelectedSubjectGroupId] = useState(
    initialSubjectGroupId || searchParams.get("subject_group_id") || ""
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialSubjectId || searchParams.get("subject_id") || ""
  );
  const [selectedPublisherId, setSelectedPublisherId] = useState(
    initialPublisherId || searchParams.get("publisher_id") || ""
  );
  const [selectedPlatformId, setSelectedPlatformId] = useState(
    initialPlatformId || searchParams.get("platform_id") || ""
  );
  const [search, setSearch] = useState(searchQuery || searchParams.get("search") || "");

  // Context에서 교과 목록 가져오기
  const subjectGroups = selectedCurriculumRevisionId
    ? getSubjectGroups(selectedCurriculumRevisionId)
    : [];

  // 현재 선택된 교과의 과목 목록 (Context에서 가져오기)
  const currentSubjects = selectedSubjectGroupId
    ? getSubjectsByGroup(selectedSubjectGroupId)
    : [];

  // 초기 마운트 시 계층 데이터 로드
  useEffect(() => {
    if (selectedCurriculumRevisionId) {
      loadHierarchy(selectedCurriculumRevisionId);
    }
  }, [selectedCurriculumRevisionId, loadHierarchy]);

  // 개정교육과정 변경 핸들러
  const handleCurriculumRevisionChange = useCallback((curriculumRevisionId: string) => {
    setSelectedCurriculumRevisionId(curriculumRevisionId);
    setSelectedSubjectGroupId("");
    setSelectedSubjectId("");

    // URL 즉시 업데이트 (Shallow Routing)
    updateMultipleFilterParams(
      router,
      pathname,
      {
        curriculum_revision_id: curriculumRevisionId || null,
        subject_group_id: null,
        subject_id: null,
      }
    );

    // 계층 데이터 로드
    if (curriculumRevisionId) {
      loadHierarchy(curriculumRevisionId);
    }
  }, [router, pathname, loadHierarchy]);

  // 교과 변경 핸들러
  const handleSubjectGroupChange = useCallback((subjectGroupId: string) => {
    setSelectedSubjectGroupId(subjectGroupId);
    setSelectedSubjectId("");

    // URL 즉시 업데이트 (Shallow Routing)
    updateMultipleFilterParams(
      router,
      pathname,
      {
        subject_group_id: subjectGroupId || null,
        subject_id: null,
      }
    );
  }, [router, pathname]);

  // 과목 변경 핸들러
  const handleSubjectChange = useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);

    // URL 즉시 업데이트 (Shallow Routing)
    updateFilterParams(router, pathname, "subject_id", subjectId || null);
  }, [router, pathname]);

  // 출판사 변경 핸들러
  const handlePublisherChange = useCallback((publisherId: string) => {
    setSelectedPublisherId(publisherId);
    updateFilterParams(router, pathname, "publisher_id", publisherId || null);
  }, [router, pathname]);

  // 플랫폼 변경 핸들러
  const handlePlatformChange = useCallback((platformId: string) => {
    setSelectedPlatformId(platformId);
    updateFilterParams(router, pathname, "platform_id", platformId || null);
  }, [router, pathname]);

  // 검색어 변경 핸들러
  const handleSearchChange = useCallback((searchValue: string) => {
    setSearch(searchValue);
    // 검색어는 submit 시에만 URL에 반영
  }, []);

  // 검색 제출
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const searchValue = search.trim() || "";
    updateFilterParams(router, pathname, "search", searchValue || null);
  }, [router, pathname, search]);

  // 필터 초기화
  const handleReset = useCallback(() => {
    setSelectedCurriculumRevisionId("");
    setSelectedSubjectGroupId("");
    setSelectedSubjectId("");
    setSelectedPublisherId("");
    setSelectedPlatformId("");
    setSearch("");
    clearFilterParams(router, pathname);
  }, [router, pathname]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4 sm:gap-4"
    >
      {/* 개정교육과정 */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <label className="text-xs font-medium text-gray-700">
          개정교육과정
        </label>
        <select
          value={selectedCurriculumRevisionId}
          onChange={(e) => handleCurriculumRevisionChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs font-medium text-gray-700">교과</label>
        <select
          value={selectedSubjectGroupId}
          onChange={(e) => handleSubjectGroupChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!selectedCurriculumRevisionId || hierarchyLoading}
        >
          <option value="">전체</option>
          {hierarchyLoading ? (
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
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs font-medium text-gray-700">과목</label>
        <select
          value={selectedSubjectId}
          onChange={(e) => handleSubjectChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!selectedSubjectGroupId || hierarchyLoading}
        >
          <option value="">전체</option>
          {hierarchyLoading ? (
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
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-700">출판사</label>
          <select
            value={selectedPublisherId}
            onChange={(e) => handlePublisherChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-700">플랫폼</label>
          <select
            value={selectedPlatformId}
            onChange={(e) => handlePlatformChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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

      {/* 제목 검색 */}
      <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-[300px]">
        <label className="text-xs font-medium text-gray-700">
          제목 검색
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
          placeholder={contentType === "book" ? "교재명 입력" : "강의명 입력"}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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

