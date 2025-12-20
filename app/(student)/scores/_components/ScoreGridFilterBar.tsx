"use client";

import { Filter, ArrowUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { bgSurface, textPrimary, textSecondary, borderDefault } from "@/lib/utils/darkMode";

type FilterConfig = {
  grade?: string;
  semester?: string;
  examType?: string;
  month?: string;
  subjectGroup: string;
  subject: string;
  subjectType: string;
};

type FilterOptions = {
  availableGrades: number[];
  availableSemesters?: number[];
  availableExamTypes?: string[];
  availableMonths?: string[];
  availableSubjectGroups: string[];
  availableSubjects: string[];
  availableSubjectTypes: string[];
};

type ScoreGridFilterBarProps = {
  filters: FilterConfig;
  sortOrder: "asc" | "desc";
  showFilters: boolean;
  totalCount: number;
  filterOptions: FilterOptions;
  onFilterChange: (filters: Partial<FilterConfig>) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
  onShowFiltersToggle: () => void;
  onAddClick?: () => void;
  variant?: "internal" | "mock";
  darkMode?: boolean;
};

export function ScoreGridFilterBar({
  filters,
  sortOrder,
  showFilters,
  totalCount,
  filterOptions,
  onFilterChange,
  onSortOrderChange,
  onShowFiltersToggle,
  onAddClick,
  variant = "internal",
  darkMode = false,
}: ScoreGridFilterBarProps) {
  const handleFilterChange = (key: keyof FilterConfig, value: string) => {
    const updates: Partial<FilterConfig> = { [key]: value };
    
    // 교과 변경 시 과목 필터 초기화
    if (key === "subjectGroup") {
      updates.subject = "all";
    }
    
    onFilterChange(updates);
  };

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", bgSurface, borderDefault)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onShowFiltersToggle}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
              showFilters
                ? "border-indigo-500 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                : cn(bgSurface, borderDefault, textSecondary, "hover:bg-gray-50 dark:hover:bg-gray-800")
            )}
          >
            <Filter className="h-4 w-4" />
            필터
          </button>
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              성적 추가
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm", textSecondary)}>
            총 {totalCount}개
          </span>
        </div>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className={cn("grid gap-4 border-t pt-4", borderDefault, 
          variant === "internal" 
            ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" 
            : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        )}>
          {/* 학년 필터 */}
          <div className="flex flex-col gap-2">
            <label className={cn("block text-xs font-medium", textSecondary)}>
              학년
            </label>
            <select
              value={filters.grade || "all"}
              onChange={(e) => handleFilterChange("grade", e.target.value)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                bgSurface,
                borderDefault,
                textPrimary
              )}
            >
              <option value="all">전체</option>
              {filterOptions.availableGrades.map((grade) => (
                <option key={grade} value={grade.toString()}>
                  {grade}학년
                </option>
              ))}
            </select>
          </div>

          {/* 학기 필터 (내신만) */}
          {variant === "internal" && filterOptions.availableSemesters && (
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                학기
              </label>
              <select
                value={filters.semester || "all"}
                onChange={(e) => handleFilterChange("semester", e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {filterOptions.availableSemesters.map((semester) => (
                  <option key={semester} value={semester.toString()}>
                    {semester}학기
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 시험 유형 필터 (모의고사만) */}
          {variant === "mock" && filterOptions.availableExamTypes && (
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                시험 유형
              </label>
              <select
                value={filters.examType || "all"}
                onChange={(e) => handleFilterChange("examType", e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {filterOptions.availableExamTypes.map((examType) => (
                  <option key={examType} value={examType}>
                    {examType}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 회차 필터 (모의고사만) */}
          {variant === "mock" && filterOptions.availableMonths && (
            <div className="flex flex-col gap-2">
              <label className={cn("block text-xs font-medium", textSecondary)}>
                회차
              </label>
              <select
                value={filters.month || "all"}
                onChange={(e) => handleFilterChange("month", e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                  bgSurface,
                  borderDefault,
                  textPrimary
                )}
              >
                <option value="all">전체</option>
                {filterOptions.availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}월
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 교과 필터 */}
          <div className="flex flex-col gap-2">
            <label className={cn("block text-xs font-medium", textSecondary)}>
              교과
            </label>
            <select
              value={filters.subjectGroup}
              onChange={(e) => handleFilterChange("subjectGroup", e.target.value)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                bgSurface,
                borderDefault,
                textPrimary
              )}
            >
              <option value="all">전체</option>
              {filterOptions.availableSubjectGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          {/* 과목 필터 */}
          <div className="flex flex-col gap-2">
            <label className={cn("block text-xs font-medium", textSecondary)}>
              과목
            </label>
            <select
              value={filters.subject}
              onChange={(e) => handleFilterChange("subject", e.target.value)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                bgSurface,
                borderDefault,
                textPrimary
              )}
            >
              <option value="all">전체</option>
              {filterOptions.availableSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {/* 과목 유형 필터 */}
          <div className="flex flex-col gap-2">
            <label className={cn("block text-xs font-medium", textSecondary)}>
              과목 유형
            </label>
            <select
              value={filters.subjectType}
              onChange={(e) => handleFilterChange("subjectType", e.target.value)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 dark:focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-600",
                bgSurface,
                borderDefault,
                textPrimary
              )}
            >
              <option value="all">전체</option>
              {filterOptions.availableSubjectTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* 정렬 순서 */}
          <div className="flex flex-col gap-2">
            <label className={cn("block text-xs font-medium", textSecondary)}>
              정렬 순서
            </label>
            <button
              onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                bgSurface,
                borderDefault,
                textPrimary,
                "hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortOrder === "asc" ? "오름차순" : "내림차순"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

