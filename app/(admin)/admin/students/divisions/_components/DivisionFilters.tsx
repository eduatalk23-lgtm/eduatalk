"use client";

import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { STUDENT_DIVISIONS, type StudentDivision } from "@/lib/constants/students";

export type GradeFilter = 1 | 2 | 3 | null | "all";

type DivisionFiltersProps = {
  divisionFilter: StudentDivision | null | "all";
  gradeFilter: GradeFilter;
  searchQuery: string;
  onDivisionFilterChange: (division: StudentDivision | null | "all") => void;
  onGradeFilterChange: (grade: GradeFilter) => void;
  onSearchChange: (query: string) => void;
};

const GRADE_OPTIONS: Array<{ value: GradeFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: 1, label: "1학년" },
  { value: 2, label: "2학년" },
  { value: 3, label: "3학년" },
  { value: null, label: "미설정" },
];

const filterButtonBase = "rounded-lg px-4 py-2 text-body-2 font-semibold transition";
const filterButtonActive = "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900";
const filterButtonInactive = "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";

export function DivisionFilters({
  divisionFilter,
  gradeFilter,
  searchQuery,
  onDivisionFilterChange,
  onGradeFilterChange,
  onSearchChange,
}: DivisionFiltersProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      {/* 1행: 학부 필터 + 검색 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className={cn("text-body-2 font-semibold shrink-0", textSecondary)}>학부</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDivisionFilterChange("all")}
              className={cn(filterButtonBase, divisionFilter === "all" ? filterButtonActive : filterButtonInactive)}
            >
              전체
            </button>
            {STUDENT_DIVISIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onDivisionFilterChange(option.value)}
                className={cn(filterButtonBase, divisionFilter === option.value ? filterButtonActive : filterButtonInactive)}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onDivisionFilterChange(null)}
              className={cn(filterButtonBase, divisionFilter === null ? filterButtonActive : filterButtonInactive)}
            >
              미설정
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="이름, 학교로 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border px-4 py-2 text-body-2 focus:outline-none focus:ring-2",
            borderInput,
            bgSurface,
            textPrimary,
            "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800 md:w-64"
          )}
        />
      </div>

      {/* 2행: 학년 필터 */}
      <div className="flex items-center gap-3">
        <span className={cn("text-body-2 font-semibold shrink-0", textSecondary)}>학년</span>
        <div className="flex gap-2">
          {GRADE_OPTIONS.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onGradeFilterChange(option.value)}
              className={cn(filterButtonBase, gradeFilter === option.value ? filterButtonActive : filterButtonInactive)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
