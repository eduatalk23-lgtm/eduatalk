"use client";

import Link from "next/link";
import { cn, bgSurface, borderInput, textPrimary, textSecondary } from "@/lib/utils/darkMode";

type TabKey = "books" | "lectures";

type FilterBarProps = {
  activeTab: TabKey;
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

export function FilterBar({
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
}: FilterBarProps) {
  const baseUrl =
    activeTab === "books" ? "/contents" : `/contents?tab=${activeTab}`;

  const hasAnyFilter =
    searchQuery ||
    subjectFilter ||
    subjectCategoryFilter ||
    semesterFilter ||
    revisionFilter ||
    publisherFilter ||
    platformFilter ||
    difficultyFilter;

  return (
    <form
      action={baseUrl}
      method="get"
      className="flex flex-wrap items-end gap-3"
    >
      {activeTab !== "books" && (
        <input type="hidden" name="tab" value={activeTab} />
      )}

      {/* 검색 */}
      <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[200px]">
        <label className={cn("text-xs font-medium", textSecondary)}>
          검색
        </label>
        <input
          type="text"
          name="search"
          defaultValue={searchQuery ?? ""}
          placeholder={activeTab === "books" ? "교재명으로 검색..." : "강의명으로 검색..."}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
        />
      </div>

      {/* 개정교육과정 */}
      <div className="flex flex-col gap-1">
        <label className={cn("text-xs font-medium", textSecondary)}>
          개정교육과정
        </label>
        <select
          name="revision"
          defaultValue={revisionFilter ?? ""}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
          aria-label="개정교육과정 선택"
        >
          <option value="">전체</option>
          {allRevisions.map((rev) => (
            <option key={rev} value={rev}>
              {rev}
            </option>
          ))}
        </select>
      </div>

      {/* 학년/학기 */}
      <div className="flex flex-col gap-1">
        <label className={cn("text-xs font-medium", textSecondary)}>학년/학기</label>
        <select
          name="semester"
          defaultValue={semesterFilter ?? ""}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
          aria-label="학년/학기 선택"
        >
          <option value="">전체</option>
          {allSemesters.map((sem) => (
            <option key={sem} value={sem}>
              {sem}
            </option>
          ))}
        </select>
      </div>

      {/* 교과 */}
      <div className="flex flex-col gap-1">
        <label className={cn("text-xs font-medium", textSecondary)}>교과</label>
        <select
          name="subject_category"
          defaultValue={subjectCategoryFilter ?? ""}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
          aria-label="교과 선택"
        >
          <option value="">전체</option>
          {allSubjectCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* 과목 */}
      <div className="flex flex-col gap-1">
        <label className={cn("text-xs font-medium", textSecondary)}>과목</label>
        <select
          name="subject"
          defaultValue={subjectFilter ?? ""}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
          aria-label="과목 선택"
        >
          <option value="">전체</option>
          {allSubjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      {/* 출판사 (교재만) */}
      {activeTab === "books" && (
        <div className="flex flex-col gap-1">
          <label className={cn("text-xs font-medium", textSecondary)}>출판사</label>
          <select
            name="publisher"
            defaultValue={publisherFilter ?? ""}
            className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
            aria-label="출판사 선택"
          >
            <option value="">전체</option>
            {allPublishers.map((pub) => (
              <option key={pub} value={pub}>
                {pub}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 플랫폼 (강의만) */}
      {activeTab === "lectures" && (
        <div className="flex flex-col gap-1">
          <label className={cn("text-xs font-medium", textSecondary)}>플랫폼</label>
          <select
            name="platform"
            defaultValue={platformFilter ?? ""}
            className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
            aria-label="플랫폼 선택"
          >
            <option value="">전체</option>
            {allPlatforms.map((plat) => (
              <option key={plat} value={plat}>
                {plat}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 난이도 */}
      <div className="flex flex-col gap-1">
        <label className={cn("text-xs font-medium", textSecondary)}>난이도</label>
        <select
          name="difficulty"
          defaultValue={difficultyFilter ?? ""}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
          aria-label="난이도 선택"
        >
          <option value="">전체</option>
          {allDifficulties.map((diff) => (
            <option key={diff} value={diff}>
              {diff}
            </option>
          ))}
        </select>
      </div>

      {/* 정렬 */}
      <div className="flex flex-col gap-1">
        <label className={cn("text-xs font-medium", textSecondary)}>정렬</label>
        <select
          name="sort"
          defaultValue={sortBy}
          className={cn("rounded-md border px-3 py-1.5 text-sm focus:outline-none", borderInput, bgSurface, textPrimary, "focus:border-gray-900 dark:focus:border-gray-400")}
          aria-label="정렬 순서 선택"
        >
          <option value="created_at_desc">최신순</option>
          <option value="created_at_asc">오래된순</option>
          <option value="title_asc">제목 가나다순</option>
          <option value="title_desc">제목 역순</option>
          <option value="difficulty_level_asc">난이도 낮은순</option>
          <option value="difficulty_level_desc">난이도 높은순</option>
        </select>
      </div>

      {/* 검색 버튼 */}
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600 whitespace-nowrap"
      >
        검색
      </button>

      {/* 필터 초기화 */}
      {hasAnyFilter && (
        <Link
          href={baseUrl}
          className={cn("rounded-lg border px-4 py-1.5 text-sm font-semibold transition", borderInput, bgSurface, textSecondary, "hover:bg-gray-50 dark:hover:bg-gray-700")}
        >
          초기화
        </Link>
      )}
    </form>
  );
}
