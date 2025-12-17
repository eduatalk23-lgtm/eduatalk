"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { UnifiedContentFilterProps, UnifiedFilterValues } from "./types";
import { useSubjectHierarchy } from "@/lib/contexts/SubjectHierarchyContext";
import { updateFilterParams, updateMultipleFilterParams, clearFilterParams } from "@/lib/utils/shallowRouting";
import type { SubjectGroup, Subject } from "@/lib/data/subjects";

// 기본 정렬 옵션
const DEFAULT_SORT_OPTIONS = [
  { value: "updated_at_desc", label: "최신순" },
  { value: "created_at_desc", label: "최신순" },
  { value: "created_at_asc", label: "오래된순" },
  { value: "title_asc", label: "제목 가나다순" },
  { value: "title_desc", label: "제목 역순" },
  { value: "difficulty_level_asc", label: "난이도 낮은순" },
  { value: "difficulty_level_desc", label: "난이도 높은순" },
];

export function UnifiedContentFilter({
  context,
  contentType,
  basePath,
  initialValues = {},
  filterOptions,
  showDifficulty = true,
  showSort = true,
  sortOptions = DEFAULT_SORT_OPTIONS,
  defaultSort = "updated_at_desc",
  className = "",
}: UnifiedContentFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hierarchy, loading: hierarchyLoading, getSubjectGroups, getSubjectsByGroup, loadHierarchy } = useSubjectHierarchy();

  // 필터 상태 (URL 파라미터와 동기화)
  const [values, setValues] = useState<UnifiedFilterValues>({
    curriculum_revision_id: initialValues.curriculum_revision_id || searchParams.get("curriculum_revision_id") || "",
    subject_group_id: initialValues.subject_group_id || searchParams.get("subject_group_id") || "",
    subject_id: initialValues.subject_id || searchParams.get("subject_id") || "",
    publisher_id: initialValues.publisher_id || searchParams.get("publisher_id") || "",
    platform_id: initialValues.platform_id || searchParams.get("platform_id") || "",
    content_type: initialValues.content_type || searchParams.get("content_type") || "",
    difficulty: initialValues.difficulty || searchParams.get("difficulty") || "",
    search: initialValues.search || searchParams.get("search") || "",
    sort: initialValues.sort || searchParams.get("sort") || defaultSort,
  });

  // Context에서 교과 목록 가져오기
  const subjectGroups = values.curriculum_revision_id
    ? getSubjectGroups(values.curriculum_revision_id)
    : [];

  // 현재 선택된 교과의 과목 목록 (Context에서 가져오기)
  const currentSubjects = values.subject_group_id
    ? getSubjectsByGroup(values.subject_group_id)
    : [];

  // 초기 마운트 시 계층 데이터 로드
  useEffect(() => {
    if (values.curriculum_revision_id) {
      loadHierarchy(values.curriculum_revision_id);
    }
  }, [values.curriculum_revision_id, loadHierarchy]);

  // 개정교육과정 변경 시 하위 필터 초기화 및 URL 업데이트
  const handleCurriculumRevisionChange = useCallback((curriculumRevisionId: string) => {
    setValues((prev) => ({
      ...prev,
      curriculum_revision_id: curriculumRevisionId,
      subject_group_id: "",
      subject_id: "",
    }));

    // URL 즉시 업데이트 (Shallow Routing)
    updateMultipleFilterParams(
      router,
      pathname,
      {
        curriculum_revision_id: curriculumRevisionId || null,
        subject_group_id: null,
        subject_id: null,
      },
      ["tab"]
    );

    // 계층 데이터 로드
    if (curriculumRevisionId) {
      loadHierarchy(curriculumRevisionId);
    }
  }, [router, pathname, loadHierarchy]);

  // 교과 변경 시 과목 초기화 및 URL 업데이트
  const handleSubjectGroupChange = useCallback((subjectGroupId: string) => {
    setValues((prev) => ({
      ...prev,
      subject_group_id: subjectGroupId,
      subject_id: "",
    }));

    // URL 즉시 업데이트 (Shallow Routing)
    updateMultipleFilterParams(
      router,
      pathname,
      {
        subject_group_id: subjectGroupId || null,
        subject_id: null,
      },
      ["tab"]
    );
  }, [router, pathname]);

  // 과목 변경 시 URL 업데이트
  const handleSubjectChange = useCallback((subjectId: string) => {
    setValues((prev) => ({
      ...prev,
      subject_id: subjectId,
    }));

    // URL 즉시 업데이트 (Shallow Routing)
    updateFilterParams(router, pathname, "subject_id", subjectId || null, ["tab"]);
  }, [router, pathname]);

  // 필터 변경 핸들러들 (즉시 URL 업데이트)
  const handlePublisherChange = useCallback((publisherId: string) => {
    setValues((prev) => ({ ...prev, publisher_id: publisherId }));
    updateFilterParams(router, pathname, "publisher_id", publisherId || null, ["tab"]);
  }, [router, pathname]);

  const handlePlatformChange = useCallback((platformId: string) => {
    setValues((prev) => ({ ...prev, platform_id: platformId }));
    updateFilterParams(router, pathname, "platform_id", platformId || null, ["tab"]);
  }, [router, pathname]);

  const handleContentTypeChange = useCallback((contentType: string) => {
    setValues((prev) => ({ ...prev, content_type: contentType }));
    updateFilterParams(router, pathname, "content_type", contentType || null, ["tab"]);
  }, [router, pathname]);

  const handleDifficultyChange = useCallback((difficulty: string) => {
    setValues((prev) => ({ ...prev, difficulty }));
    updateFilterParams(router, pathname, "difficulty", difficulty || null, ["tab"]);
  }, [router, pathname]);

  const handleSearchChange = useCallback((search: string) => {
    setValues((prev) => ({ ...prev, search }));
    // 검색어는 debounce 없이 즉시 업데이트하지 않고, submit 시에만 업데이트
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setValues((prev) => ({ ...prev, sort }));
    if (sort !== defaultSort) {
      updateFilterParams(router, pathname, "sort", sort, ["tab"]);
    } else {
      updateFilterParams(router, pathname, "sort", null, ["tab"]);
    }
  }, [router, pathname, defaultSort]);

  // 검색 제출 (검색어만 URL에 반영)
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const searchValue = values.search?.trim() || "";
    updateFilterParams(router, pathname, "search", searchValue || null, ["tab"]);
  }, [router, pathname, values.search]);

  // 필터 초기화
  const handleReset = useCallback(() => {
    setValues({
      curriculum_revision_id: "",
      subject_group_id: "",
      subject_id: "",
      publisher_id: "",
      platform_id: "",
      content_type: "",
      difficulty: "",
      search: "",
      sort: defaultSort,
    });
    clearFilterParams(router, pathname, ["tab"]);
  }, [router, pathname, defaultSort]);

  return (
    <form
      onSubmit={handleSubmit}
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 items-end ${className}`}
    >
      {/* 1열: 개정교육과정, 교과, 과목 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            개정교육과정
          </label>
          <select
            value={values.curriculum_revision_id || ""}
            onChange={(e) => handleCurriculumRevisionChange(e.target.value)}
            className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm"
            aria-label="개정교육과정 선택"
          >
            <option value="">전체</option>
            {filterOptions.curriculumRevisions.map((rev) => (
              <option key={rev.id} value={rev.id}>
                {rev.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-secondary)]">교과</label>
          <select
            value={values.subject_group_id || ""}
            onChange={(e) => handleSubjectGroupChange(e.target.value)}
            className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm disabled:bg-[rgb(var(--color-secondary-100))] disabled:cursor-not-allowed"
            disabled={!values.curriculum_revision_id || hierarchyLoading}
            aria-label="교과 선택"
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

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-secondary)]">과목</label>
          <select
            value={values.subject_id || ""}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm disabled:bg-[rgb(var(--color-secondary-100))] disabled:cursor-not-allowed"
            disabled={!values.subject_group_id || hierarchyLoading}
            aria-label="과목 선택"
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
      </div>

      {/* 2열: 출판사/플랫폼, 난이도 */}
      <div className="flex flex-col gap-4">
        {/* 출판사 (교재용) */}
        {contentType === "book" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">출판사</label>
            <select
              value={values.publisher_id || ""}
              onChange={(e) => handlePublisherChange(e.target.value)}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm"
              aria-label="출판사 선택"
            >
              <option value="">전체</option>
              {filterOptions.publishers?.map((publisher) => (
                <option key={publisher.id} value={publisher.id}>
                  {publisher.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 플랫폼 (강의용) */}
        {contentType === "lecture" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">플랫폼</label>
            <select
              value={values.platform_id || ""}
              onChange={(e) => handlePlatformChange(e.target.value)}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm"
              aria-label="플랫폼 선택"
            >
              <option value="">전체</option>
              {filterOptions.platforms?.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 콘텐츠 유형 (커스텀 콘텐츠용) */}
        {contentType === "custom" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">콘텐츠 유형</label>
            <select
              value={values.content_type || ""}
              onChange={(e) => handleContentTypeChange(e.target.value)}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm"
              aria-label="콘텐츠 유형 선택"
            >
              <option value="">전체</option>
              <option value="book">책</option>
              <option value="lecture">강의</option>
              <option value="worksheet">문제집</option>
              <option value="other">기타</option>
            </select>
          </div>
        )}

        {/* 난이도 */}
        {showDifficulty && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">난이도</label>
            <select
              value={values.difficulty || ""}
              onChange={(e) => handleDifficultyChange(e.target.value)}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm"
              aria-label="난이도 선택"
            >
              <option value="">전체</option>
              {filterOptions.difficulties?.map((diff) => (
                <option key={diff} value={diff}>
                  {diff}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3열: 제목 검색, 정렬, 검색 버튼, 초기화 버튼 */}
      <div className="flex flex-col gap-4">
        {/* 제목 검색 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            제목 검색
          </label>
            <input
            type="text"
            value={values.search || ""}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            placeholder={contentType === "book" ? "교재명 입력" : contentType === "lecture" ? "강의명 입력" : "콘텐츠명 입력"}
            className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm"
          />
        </div>

        {/* 정렬 */}
        {showSort && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">정렬</label>
            <select
              value={values.sort || defaultSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full rounded-md border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm"
              aria-label="정렬 순서 선택"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 검색 및 초기화 버튼 */}
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 rounded-lg border border-[rgb(var(--color-secondary-300))] bg-white dark:bg-secondary-900 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-base hover:bg-[rgb(var(--color-secondary-50))]"
          >
            초기화
          </button>
        </div>
      </div>
    </form>
  );
}

