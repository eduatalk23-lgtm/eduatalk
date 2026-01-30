"use client";

import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
} from "@/lib/utils/darkMode";
import { STUDENT_DIVISIONS, type StudentDivision } from "@/lib/constants/students";

type DivisionFiltersProps = {
  divisionFilter: StudentDivision | null | "all";
  searchQuery: string;
  onDivisionFilterChange: (division: StudentDivision | null | "all") => void;
  onSearchChange: (query: string) => void;
};

export function DivisionFilters({
  divisionFilter,
  searchQuery,
  onDivisionFilterChange,
  onSearchChange,
}: DivisionFiltersProps) {

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-300 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
      {/* 구분 필터 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDivisionFilterChange("all")}
          className={cn(
            "rounded-lg px-4 py-2 text-body-2 font-semibold transition",
            divisionFilter === "all"
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          )}
        >
          전체
        </button>
        {STUDENT_DIVISIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onDivisionFilterChange(option.value)}
            className={cn(
              "rounded-lg px-4 py-2 text-body-2 font-semibold transition",
              divisionFilter === option.value
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onDivisionFilterChange(null)}
          className={cn(
            "rounded-lg px-4 py-2 text-body-2 font-semibold transition",
            divisionFilter === null
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          )}
        >
          미설정
        </button>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="이름, 학년, 반으로 검색..."
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
  );
}

