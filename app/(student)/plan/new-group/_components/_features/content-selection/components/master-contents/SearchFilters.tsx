"use client";

import { memo } from "react";
import { Search } from "lucide-react";
import type { SearchFiltersProps } from "./types";

/**
 * 마스터 콘텐츠 검색 필터
 */
export const SearchFilters = memo(function SearchFilters({
  searchQuery,
  onSearchQueryChange,
  curriculumRevisionId,
  onCurriculumRevisionChange,
  subjectGroupId,
  onSubjectGroupChange,
  subjectId,
  onSubjectChange,
  curriculumRevisions,
  subjectGroups,
  currentSubjects,
  loadingGroups,
  loadingSubjects,
  disabled = false,
  isSearching = false,
  onSearch,
  searchDisabled,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* 제목 검색 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">제목 검색</label>
        <input
          type="text"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-600 focus:border-gray-900 focus:outline-none"
          placeholder="교재/강의 이름을 입력하세요"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSearch();
            }
          }}
          disabled={disabled || isSearching}
        />
      </div>

      {/* 개정교육과정 선택 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">
          개정교육과정
        </label>
        <select
          value={curriculumRevisionId}
          onChange={(e) => onCurriculumRevisionChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={disabled || isSearching}
        >
          <option value="">전체</option>
          {curriculumRevisions.map((rev) => (
            <option key={rev.id} value={rev.id}>
              {rev.name}
            </option>
          ))}
        </select>
      </div>

      {/* 교과 선택 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">교과</label>
        <select
          value={subjectGroupId}
          onChange={(e) => onSubjectGroupChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={
            disabled || isSearching || !curriculumRevisionId || loadingGroups
          }
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

      {/* 과목 선택 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">과목</label>
        <select
          value={subjectId}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={disabled || isSearching || !subjectGroupId || loadingSubjects}
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

      {/* 검색 버튼 */}
      <button
        type="button"
        onClick={onSearch}
        disabled={disabled || isSearching || searchDisabled}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSearching ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            검색 중...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Search className="h-4 w-4" />
            검색
          </span>
        )}
      </button>
    </div>
  );
});
