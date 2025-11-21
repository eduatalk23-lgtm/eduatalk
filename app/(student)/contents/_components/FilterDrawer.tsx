"use client";

import { useState } from "react";
import { FilterBar } from "./FilterBar";

type FilterDrawerProps = {
  activeTab: "books" | "lectures";
  searchQuery?: string;
  subjectFilter?: string;
  subjectCategoryFilter?: string;
  semesterFilter?: string;
  revisionFilter?: string;
  publisherFilter?: string;
  platformFilter?: string;
  difficultyFilter?: string;
  sortBy: string;
  allSubjects: string[];
  allSubjectCategories: string[];
  allSemesters: string[];
  allRevisions: string[];
  allPublishers: string[];
  allPlatforms: string[];
  allDifficulties: string[];
};

export function FilterDrawer({
  activeTab,
  searchQuery,
  subjectFilter,
  subjectCategoryFilter,
  semesterFilter,
  revisionFilter,
  publisherFilter,
  platformFilter,
  difficultyFilter,
  sortBy,
  allSubjects,
  allSubjectCategories,
  allSemesters,
  allRevisions,
  allPublishers,
  allPlatforms,
  allDifficulties,
}: FilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 모바일: 필터 버튼 */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          🔍 필터 및 검색
        </button>
      </div>

      {/* 모바일: 드로어 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 모바일: 드로어 */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl transition-transform duration-300 sm:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <h2 className="text-lg font-semibold text-gray-900">필터 및 검색</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* 필터 내용 */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              <FilterBar
                activeTab={activeTab}
                searchQuery={searchQuery}
                subjectFilter={subjectFilter}
                subjectCategoryFilter={subjectCategoryFilter}
                semesterFilter={semesterFilter}
                revisionFilter={revisionFilter}
                publisherFilter={publisherFilter}
                platformFilter={platformFilter}
                difficultyFilter={difficultyFilter}
                sortBy={sortBy}
                allSubjects={allSubjects}
                allSubjectCategories={allSubjectCategories}
                allSemesters={allSemesters}
                allRevisions={allRevisions}
                allPublishers={allPublishers}
                allPlatforms={allPlatforms}
                allDifficulties={allDifficulties}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 데스크톱: 기본 필터 바 */}
      <div className="hidden sm:block">
        <FilterBar
          activeTab={activeTab}
          searchQuery={searchQuery}
          subjectFilter={subjectFilter}
          subjectCategoryFilter={subjectCategoryFilter}
          semesterFilter={semesterFilter}
          revisionFilter={revisionFilter}
          publisherFilter={publisherFilter}
          platformFilter={platformFilter}
          difficultyFilter={difficultyFilter}
          sortBy={sortBy}
          allSubjects={allSubjects}
          allSubjectCategories={allSubjectCategories}
          allSemesters={allSemesters}
          allRevisions={allRevisions}
          allPublishers={allPublishers}
          allPlatforms={allPlatforms}
          allDifficulties={allDifficulties}
        />
      </div>
    </>
  );
}

